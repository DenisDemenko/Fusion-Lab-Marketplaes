import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LiqpayService } from '../payments/liqpay.service';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { ReferralsService } from '../referrals/referrals.service';
import { commissionFor, formatUah } from '../common/money';

const orderInclude = {
  items: { include: { listing: { select: { slug: true, kind: true } } } },
  payment: true,
  promoCode: { select: { code: true } },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly notifications: NotificationsService,
    private readonly liqpay: LiqpayService,
    private readonly promoCodes: PromoCodesService,
    private readonly loyalty: LoyaltyService,
    private readonly referrals: ReferralsService,
  ) {}

  // Checkout. Everything that must be true at once — stock is available,
  // the listings are still published, the promo code is still valid, the
  // totals add up — is decided inside one transaction, so two simultaneous
  // checkouts of the last item (or the last use of a capped promo code)
  // cannot both succeed.
  async checkout(
    userId: string,
    options: { promoCode?: string; loyaltyPointsToSpend?: number } = {},
  ) {
    const cart = await this.cart.requireNonEmpty(userId);

    const unavailable = cart.items.filter(
      (item) => item.listing.status !== 'published',
    );
    if (unavailable.length > 0) {
      throw new ConflictException({
        message: 'Деякі позиції більше не доступні — видаліть їх із кошика',
        listings: unavailable.map((item) => item.listing.title),
      });
    }

    const owned = await this.prisma.entitlement.findMany({
      where: {
        userId,
        listingId: { in: cart.items.map((item) => item.listingId) },
      },
      select: { listingId: true },
    });
    if (owned.length > 0) {
      throw new ConflictException({
        message: 'Ви вже володієте частиною позицій у кошику',
        listingIds: owned.map((row) => row.listingId),
      });
    }

    const lines = cart.items.map((item) => {
      const gross = item.listing.priceMinor * item.quantity;
      return {
        listingId: item.listingId,
        sellerId: item.listing.sellerId,
        titleSnapshot: item.listing.title,
        kind: item.listing.kind,
        unitPriceMinor: item.listing.priceMinor,
        quantity: item.quantity,
        commissionMinor: commissionFor(
          gross,
          item.listing.seller.commissionPercent,
        ),
        stock: item.listing.stock,
      };
    });

    const subtotalMinor = lines.reduce(
      (sum, line) => sum + line.unitPriceMinor * line.quantity,
      0,
    );
    const commissionMinor = lines.reduce(
      (sum, line) => sum + line.commissionMinor,
      0,
    );

    if (subtotalMinor <= 0) {
      throw new BadRequestException('Сума замовлення має бути більшою за нуль');
    }

    const order = await this.prisma.$transaction(async (tx) => {
      // Stock is reserved here, not at payment time: the buyer is about to
      // be sent to a bank page, and the item has to still be theirs when
      // they come back. A conditional updateMany is what makes it safe —
      // if another checkout got there first, it updates zero rows and this
      // one fails instead of overselling.
      for (const line of lines) {
        if (line.stock === null) continue;

        const reserved = await tx.listing.updateMany({
          where: { id: line.listingId, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });

        if (reserved.count === 0) {
          throw new ConflictException(
            `Недостатньо товару: "${line.titleSnapshot}"`,
          );
        }
      }

      // Both discounts, and stock, are decided inside this one transaction:
      // if anything downstream throws, Postgres rolls back the promo
      // code's redemption count right along with the stock decrement —
      // there is no window where a code is "spent" against an order that
      // never actually happened.
      let promoCodeId: string | undefined;
      let promoDiscountMinor = 0;
      if (options.promoCode) {
        const resolved = await this.promoCodes.resolveForCheckout(
          tx,
          options.promoCode,
          subtotalMinor,
        );
        promoCodeId = resolved.promoCode.id;
        promoDiscountMinor = resolved.discountMinor;
      }

      const afterPromoMinor = subtotalMinor - promoDiscountMinor;

      // Capped silently rather than rejected: a buyer asking to spend more
      // points than the order can absorb just gets the maximum useful
      // discount instead of an error interrupting checkout over a number
      // that was never going to matter past this point anyway.
      const requestedPoints = options.loyaltyPointsToSpend ?? 0;
      const loyaltyBalance = await this.loyalty.balance(userId);
      const loyaltyPointsSpent = Math.max(
        0,
        Math.min(requestedPoints, loyaltyBalance, afterPromoMinor),
      );
      const loyaltyDiscountMinor = loyaltyPointsSpent;

      const totalMinor = afterPromoMinor - loyaltyDiscountMinor;

      const created = await tx.order.create({
        data: {
          number: orderNumber(),
          buyerId: userId,
          subtotalMinor,
          totalMinor,
          commissionMinor,
          promoCodeId,
          promoDiscountMinor,
          loyaltyPointsSpent,
          loyaltyDiscountMinor,
          items: {
            create: lines.map((line) => ({
              listingId: line.listingId,
              sellerId: line.sellerId,
              titleSnapshot: line.titleSnapshot,
              kind: line.kind,
              unitPriceMinor: line.unitPriceMinor,
              quantity: line.quantity,
              commissionMinor: line.commissionMinor,
            })),
          },
          payment: {
            create: { amountMinor: totalMinor, provider: 'liqpay' },
          },
        },
        include: orderInclude,
      });

      if (loyaltyPointsSpent > 0) {
        await this.loyalty.spend(tx, userId, loyaltyPointsSpent, created.id);
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return created;
    });

    await this.notifySellersOfNewOrder(order);

    return this.render(order);
  }

  async listForUser(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { buyerId: userId },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((order) => this.render(order));
  }

  async getForUser(userId: string, number: string) {
    const order = await this.prisma.order.findFirst({
      where: { number, buyerId: userId },
      include: orderInclude,
    });

    if (!order) {
      throw new NotFoundException('Замовлення не знайдено');
    }

    return this.render(order);
  }

  // Called by the LiqPay callback and by the dev confirmation endpoint.
  // Idempotent by design: LiqPay retries its callback, and a payment
  // processed twice would grant duplicate entitlements and double-count
  // every seller's revenue.
  async markPaid(
    orderNumber: string,
    details: { providerPaymentId?: string; raw?: Prisma.InputJsonValue },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { number: orderNumber },
      include: orderInclude,
    });

    if (!order) {
      throw new NotFoundException(`Замовлення ${orderNumber} не знайдено`);
    }

    if (order.status === 'paid') {
      return { ...this.render(order), alreadyProcessed: true };
    }

    const paid = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: order.id },
        data: { status: 'paid', paidAt: new Date() },
        include: orderInclude,
      });

      await tx.payment.update({
        where: { orderId: order.id },
        data: {
          status: 'success',
          providerPaymentId: details.providerPaymentId,
          raw: details.raw,
        },
      });

      // The purchase becomes access here and nowhere else. skipDuplicates
      // covers the buyer who already owned one line through a gift or an
      // admin grant — that must not abort the rest of the order.
      await tx.entitlement.createMany({
        data: updated.items.map((item) => ({
          userId: order.buyerId,
          listingId: item.listingId,
          orderId: order.id,
        })),
        skipDuplicates: true,
      });

      // Cashback is earned on what the buyer actually paid (totalMinor,
      // after any promo/loyalty discount) — never on the pre-discount
      // subtotal, which would let stacking a promo code with points
      // manufacture more points than the money that changed hands.
      await this.loyalty.earnForPurchase(
        tx,
        order.buyerId,
        order.id,
        updated.totalMinor,
      );

      const referralAward = await this.referrals.maybeAwardBonus(
        tx,
        order.buyerId,
        order.id,
      );

      return { order: updated, referralAward };
    });

    await this.notifyPaid(paid.order);
    if (paid.referralAward.awarded && paid.referralAward.referrerId) {
      await this.referrals.notifyBonusAwarded(paid.referralAward.referrerId);
    }

    return this.render(paid.order);
  }

  async markFailed(orderNumber: string, reason?: string) {
    const order = await this.prisma.order.findUnique({
      where: { number: orderNumber },
      include: orderInclude,
    });

    if (!order) {
      throw new NotFoundException(`Замовлення ${orderNumber} не знайдено`);
    }

    if (order.status === 'paid') {
      throw new ConflictException(
        'Замовлення вже оплачене — статус не змінюється',
      );
    }

    if (order.status === 'failed') {
      return this.render(order);
    }

    const failed = await this.prisma.$transaction(async (tx) => {
      // Give the reserved stock back: an abandoned or declined payment must
      // not keep a physical item off the shelf.
      for (const item of order.items) {
        await tx.listing.updateMany({
          where: { id: item.listingId, stock: { not: null } },
          data: { stock: { increment: item.quantity } },
        });
      }

      await tx.payment.update({
        where: { orderId: order.id },
        data: { status: 'failure', raw: reason ? { reason } : undefined },
      });

      return tx.order.update({
        where: { id: order.id },
        data: { status: 'failed' },
        include: orderInclude,
      });
    });

    return this.render(failed);
  }

  // The payload the frontend needs to send the buyer to LiqPay. When no
  // keys are configured the API says so plainly instead of returning a
  // signature made with an empty secret — the frontend then offers the
  // sandbox confirmation path (see PaymentsController.devConfirm).
  checkoutPayload(order: {
    number: string;
    totalMinor: number;
    currency: string;
  }) {
    if (!this.liqpay.enabled) {
      return {
        provider: 'liqpay' as const,
        configured: false,
        message:
          'LIQPAY_PUBLIC_KEY/LIQPAY_PRIVATE_KEY не налаштовані — оплата в демо-режимі',
      };
    }

    const apiUrl = process.env.API_PUBLIC_URL ?? 'http://localhost:3001';
    const webUrl =
      process.env.WEB_ORIGIN?.split(',')[0]?.trim() ?? 'http://localhost:3000';

    return {
      provider: 'liqpay' as const,
      configured: true,
      ...this.liqpay.buildCheckout({
        amountMinor: order.totalMinor,
        currency: order.currency,
        description: `Fusion Lab — замовлення ${order.number}`,
        orderNumber: order.number,
        resultUrl: `${webUrl}/account/orders/${order.number}`,
        serverUrl: `${apiUrl}/payments/liqpay/callback`,
      }),
    };
  }

  private async notifySellersOfNewOrder(order: OrderWithRelations) {
    const sellerIds = [...new Set(order.items.map((item) => item.sellerId))];

    const sellers = await this.prisma.sellerProfile.findMany({
      where: { id: { in: sellerIds } },
      select: { id: true, userId: true },
    });

    await Promise.all(
      sellers.map((seller) => {
        const items = order.items.filter((item) => item.sellerId === seller.id);
        const amount = items.reduce(
          (sum, item) => sum + item.unitPriceMinor * item.quantity,
          0,
        );

        return this.notifications.notify({
          userId: seller.userId,
          type: 'order_placed',
          title: 'Нове замовлення',
          body: `${items.length} позиц. на ${formatUah(amount)} — очікує оплати`,
          payload: { orderNumber: order.number },
        });
      }),
    );
  }

  private async notifyPaid(order: OrderWithRelations) {
    await this.notifications.notify({
      userId: order.buyerId,
      type: 'order_paid',
      title: `Замовлення ${order.number} оплачено`,
      body: 'Матеріали вже доступні в розділі «Мої матеріали»',
      payload: { orderNumber: order.number },
    });

    const sellers = await this.prisma.sellerProfile.findMany({
      where: { id: { in: order.items.map((item) => item.sellerId) } },
      select: { id: true, userId: true },
    });

    await Promise.all(
      sellers.map((seller) => {
        const items = order.items.filter((item) => item.sellerId === seller.id);
        const payout = items.reduce(
          (sum, item) =>
            sum + item.unitPriceMinor * item.quantity - item.commissionMinor,
          0,
        );

        return this.notifications.notify({
          userId: seller.userId,
          type: 'order_paid',
          title: `Оплачено замовлення ${order.number}`,
          body: `До виплати: ${formatUah(payout)}`,
          payload: { orderNumber: order.number },
        });
      }),
    );
  }

  private render(order: OrderWithRelations) {
    return {
      id: order.id,
      number: order.number,
      status: order.status,
      currency: order.currency,
      subtotalMinor: order.subtotalMinor,
      totalMinor: order.totalMinor,
      totalLabel: formatUah(order.totalMinor),
      commissionMinor: order.commissionMinor,
      promoCode: order.promoCode?.code ?? null,
      promoDiscountMinor: order.promoDiscountMinor,
      loyaltyPointsSpent: order.loyaltyPointsSpent,
      loyaltyDiscountMinor: order.loyaltyDiscountMinor,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      payment: order.payment
        ? {
            provider: order.payment.provider,
            status: order.payment.status,
            providerPaymentId: order.payment.providerPaymentId,
          }
        : null,
      items: order.items.map((item) => ({
        id: item.id,
        title: item.titleSnapshot,
        kind: item.kind,
        listingId: item.listingId,
        listingSlug: item.listing.slug,
        quantity: item.quantity,
        unitPriceMinor: item.unitPriceMinor,
        lineTotalMinor: item.unitPriceMinor * item.quantity,
      })),
    };
  }
}

// Human-readable and unguessable: the date makes support conversations
// easy, the random tail keeps one buyer from enumerating another's orders
// through the LiqPay result URL.
function orderNumber(): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `FL-${today}-${randomBytes(3).toString('hex').toUpperCase()}`;
}
