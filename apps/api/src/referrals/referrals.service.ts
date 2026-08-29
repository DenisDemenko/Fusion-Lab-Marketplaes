import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { formatUah } from '../common/money';

type Tx = Prisma.TransactionClient;

// The flagship domain model — see docs/adr/0005-referral-program.md for
// why the state machine is shaped the way it is (one Referral row per
// referred user, claimed once, awarded once, no way to backdate).
@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loyalty: LoyaltyService,
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
  ) {}

  async myInfo(userId: string) {
    const [asReferrer, asReferred] = await Promise.all([
      this.prisma.referral.findMany({
        where: { referrerId: userId },
        include: { referred: { select: { email: true, displayName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.referral.findUnique({ where: { referredId: userId } }),
    ]);

    const user = await this.users.findById(userId);

    return {
      referralCode: user?.referralCode ?? null,
      invited: asReferrer.map((row) => ({
        email: maskEmail(row.referred.email),
        displayName: row.referred.displayName,
        bonusAwarded: row.bonusAwarded,
        joinedAt: row.createdAt,
      })),
      referredBy: asReferred ? { claimedAt: asReferred.createdAt } : null,
      totalBonusPoints: asReferrer.filter((r) => r.bonusAwarded).length * 500,
    };
  }

  // Claiming is a one-time, one-way action: it ties a brand-new account to
  // whoever invited them, before that account has bought anything. Allowed
  // any time up to the first purchase (not just "right after signup") so a
  // frontend bug or a slow network on day one doesn't permanently cost
  // someone their referral — but a purchase closes the window, because
  // awarding a referrer for someone who already paid without a referral
  // link would be paying for a sale the link had nothing to do with.
  async claim(userId: string, code: string) {
    const referrer = await this.users.findByReferralCode(
      code.trim().toUpperCase(),
    );

    if (!referrer) {
      throw new NotFoundException('Реферальний код не знайдено');
    }

    if (referrer.id === userId) {
      throw new BadRequestException(
        'Не можна використати власний реферальний код',
      );
    }

    const existing = await this.prisma.referral.findUnique({
      where: { referredId: userId },
    });
    if (existing) {
      throw new ConflictException(
        'Реферальний код вже застосовано до цього акаунту',
      );
    }

    const paidOrders = await this.prisma.order.count({
      where: { buyerId: userId, status: 'paid' },
    });
    if (paidOrders > 0) {
      throw new ConflictException(
        'Реферальний код можна застосувати лише до першої покупки',
      );
    }

    return this.prisma.referral.create({
      data: { referrerId: referrer.id, referredId: userId },
    });
  }

  // Called from inside OrdersService.markPaid's transaction, right after
  // the order row flips to 'paid'. Awards at most once per referral,
  // enforced by the bonusAwarded flag guard in the WHERE clause below —
  // LiqPay's callback retries are exactly the case this has to survive.
  async maybeAwardBonus(
    tx: Tx,
    buyerId: string,
    orderId: string,
  ): Promise<{ awarded: boolean; referrerId?: string }> {
    const referral = await tx.referral.findUnique({
      where: { referredId: buyerId },
    });
    if (!referral || referral.bonusAwarded) return { awarded: false };

    const paidOrderCount = await tx.order.count({
      where: { buyerId, status: 'paid' },
    });
    // This order was already flipped to 'paid' earlier in the same
    // transaction, so "1" here means "this is the buyer's first ever paid
    // order" — exactly the trigger CONTEXT.md specifies.
    if (paidOrderCount !== 1) return { awarded: false };

    const updated = await tx.referral.updateMany({
      where: { id: referral.id, bonusAwarded: false },
      data: { bonusAwarded: true, awardedAt: new Date() },
    });
    if (updated.count === 0) return { awarded: false };

    await this.loyalty.awardReferralBonus(tx, referral.referrerId, orderId);

    return { awarded: true, referrerId: referral.referrerId };
  }

  // Deliberately outside the transaction (same reasoning as
  // OrdersService.notifyPaid): a notification is a side effect of a
  // committed fact, not part of the fact itself, and a slow/failed
  // websocket push must never roll back a payment.
  async notifyBonusAwarded(referrerId: string) {
    await this.notifications.notify({
      userId: referrerId,
      type: 'referral_bonus',
      title: 'Запрошений друг зробив першу покупку',
      body: `Вам нараховано 500 балів (${formatUah(500)}) за запрошення`,
    });
  }
}

// Shown to the inviter in their referral list — enough to recognise who
// joined, not enough to leak a full email address to someone who only
// knows it from having sent the invite.
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain || local.length <= 2) return email;
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
}
