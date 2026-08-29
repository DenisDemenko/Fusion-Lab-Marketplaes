import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { formatUah } from '../common/money';

export interface LedgerEntry {
  type: 'sale' | 'payout';
  date: Date;
  amountMinor: number;
  description: string;
}

@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // The seller's outstanding balance is never stored (see the Payout model
  // comment in schema.prisma) — every read recomputes it from the order
  // history and the payout history, which is cheap at this project's scale
  // and impossible to let drift out of sync with reality.
  async ledger(sellerId: string) {
    const [items, payouts] = await Promise.all([
      this.prisma.orderItem.findMany({
        where: { sellerId, order: { status: 'paid' } },
        select: {
          titleSnapshot: true,
          unitPriceMinor: true,
          quantity: true,
          commissionMinor: true,
          order: { select: { number: true, paidAt: true } },
        },
      }),
      this.prisma.payout.findMany({
        where: { sellerId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const earnedMinor = items.reduce(
      (sum, item) =>
        sum + item.unitPriceMinor * item.quantity - item.commissionMinor,
      0,
    );
    const paidOutMinor = payouts.reduce(
      (sum, payout) => sum + payout.amountMinor,
      0,
    );

    const entries: LedgerEntry[] = [
      ...items.map((item) => ({
        type: 'sale' as const,
        date: item.order.paidAt ?? new Date(0),
        amountMinor: item.unitPriceMinor * item.quantity - item.commissionMinor,
        description: `Продаж «${item.titleSnapshot}» — замовлення ${item.order.number}`,
      })),
      ...payouts.map((payout) => ({
        type: 'payout' as const,
        date: payout.createdAt,
        amountMinor: -payout.amountMinor,
        description: payout.note || 'Виплата',
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    return {
      earnedMinor,
      earnedLabel: formatUah(earnedMinor),
      paidOutMinor,
      paidOutLabel: formatUah(paidOutMinor),
      outstandingMinor: earnedMinor - paidOutMinor,
      outstandingLabel: formatUah(earnedMinor - paidOutMinor),
      entries,
    };
  }

  // Admin-only action: transfers real money outside this system (bank
  // transfer, card payout) and simply records that it happened. Refuses
  // to record more than the seller is actually owed — a typo here would
  // otherwise silently let a seller's outstanding balance go negative,
  // which "how much do we owe this person" should never be able to do.
  async record(
    sellerId: string,
    input: {
      amountMinor: number;
      note?: string;
      periodStart?: string;
      periodEnd?: string;
    },
  ) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { id: sellerId },
    });
    if (!seller) throw new NotFoundException('Продавця не знайдено');

    if (input.amountMinor <= 0) {
      throw new BadRequestException('Сума виплати має бути більшою за нуль');
    }

    const { outstandingMinor } = await this.ledger(sellerId);
    if (input.amountMinor > outstandingMinor) {
      throw new BadRequestException(
        `Сума перевищує заборгованість: доступно ${formatUah(outstandingMinor)}`,
      );
    }

    const payout = await this.prisma.payout.create({
      data: {
        sellerId,
        amountMinor: input.amountMinor,
        note: input.note,
        periodStart: input.periodStart
          ? new Date(input.periodStart)
          : undefined,
        periodEnd: input.periodEnd ? new Date(input.periodEnd) : undefined,
      },
    });

    await this.notifications.notify({
      userId: seller.userId,
      type: 'payout_recorded',
      title: 'Зареєстровано виплату',
      body: `${formatUah(input.amountMinor)}${input.note ? ` — ${input.note}` : ''}`,
    });

    return payout;
  }
}
