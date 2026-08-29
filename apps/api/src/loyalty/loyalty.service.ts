import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// 1 point = 1 kopeck of redemption value — chosen so no conversion table
// or rounding step exists between "points spent" and "money off", the two
// numbers are simply the same integer. Earn rate is separate: buying
// something for 1000.00 грн earns 500 points (5% = 5.00 грн of future
// value), which is the "Кешбек" mechanism from CONTEXT.md — cashback is
// not a distinct feature, it is this earn step under another name.
export const EARN_RATE_PERCENT = 5;
export const REFERRAL_BONUS_POINTS = 500;

// Every write here takes a Prisma.TransactionClient, never PrismaService
// directly: earning and spending points must commit or roll back together
// with the order row they belong to (see OrdersService.checkout/markPaid),
// so there is deliberately no path that lets a caller run one of these
// outside a surrounding $transaction.
type Tx = Prisma.TransactionClient;

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  async balance(userId: string): Promise<number> {
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { userId },
    });
    return account?.balance ?? 0;
  }

  async history(userId: string) {
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { userId },
    });

    if (!account) return { balance: 0, transactions: [] };

    const transactions = await this.prisma.loyaltyTransaction.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { order: { select: { number: true } } },
    });

    return {
      balance: account.balance,
      transactions: transactions.map((row) => ({
        id: row.id,
        type: row.type,
        points: row.points,
        note: row.note,
        orderNumber: row.order?.number ?? null,
        createdAt: row.createdAt,
      })),
    };
  }

  // Lazily creates the account on first use, the same pattern as Cart —
  // most users never touch loyalty points, so there is no reason to
  // provision a row for every signup.
  private async ensureAccount(tx: Tx, userId: string) {
    return tx.loyaltyAccount.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  // Spending is validated against the live balance inside the same
  // transaction as the order it pays for, so two concurrent checkouts
  // both trying to spend a buyer's last points cannot both succeed —
  // the second sees the balance the first has already debited.
  async spend(
    tx: Tx,
    userId: string,
    points: number,
    orderId: string,
  ): Promise<void> {
    if (points <= 0) return;

    const account = await this.ensureAccount(tx, userId);

    if (points > account.balance) {
      throw new BadRequestException(
        `Недостатньо балів: доступно ${account.balance}, потрібно ${points}`,
      );
    }

    await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: { balance: { decrement: points } },
    });

    await tx.loyaltyTransaction.create({
      data: {
        accountId: account.id,
        type: 'spent_order',
        points: -points,
        orderId,
      },
    });
  }

  // Called once, from OrdersService.markPaid, when an order transitions to
  // paid — not at checkout, so a payment that never completes never grants
  // points for it.
  async earnForPurchase(
    tx: Tx,
    userId: string,
    orderId: string,
    amountMinor: number,
  ) {
    const points = Math.floor((amountMinor * EARN_RATE_PERCENT) / 100);
    if (points <= 0) return;

    const account = await this.ensureAccount(tx, userId);

    await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: { balance: { increment: points } },
    });

    await tx.loyaltyTransaction.create({
      data: {
        accountId: account.id,
        type: 'earned_purchase',
        points,
        orderId,
        note: `Кешбек 5% за замовлення`,
      },
    });
  }

  async awardReferralBonus(tx: Tx, referrerId: string, orderId: string) {
    const account = await this.ensureAccount(tx, referrerId);

    await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: { balance: { increment: REFERRAL_BONUS_POINTS } },
    });

    await tx.loyaltyTransaction.create({
      data: {
        accountId: account.id,
        type: 'earned_referral',
        points: REFERRAL_BONUS_POINTS,
        orderId,
        note: 'Бонус за запрошеного друга',
      },
    });
  }

  // Not called anywhere in the request path — a deliberate escape hatch.
  // LoyaltyAccount.balance is a cache of this ledger's sum, kept for a
  // cheap read on the checkout screen; if it were ever suspected to have
  // drifted (a bug, a manual DB fix, a restored backup), this recomputes
  // it from the transactions themselves, which are the actual source of
  // truth.
  async recompute(userId: string): Promise<number> {
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { userId },
    });
    if (!account) return 0;

    const total = await this.prisma.loyaltyTransaction.aggregate({
      where: { accountId: account.id },
      _sum: { points: true },
    });

    const balance = total._sum.points ?? 0;
    await this.prisma.loyaltyAccount.update({
      where: { id: account.id },
      data: { balance },
    });

    return balance;
  }
}
