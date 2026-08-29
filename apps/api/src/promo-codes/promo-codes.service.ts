import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PromoCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromoCodeDto } from './promo-codes.dto';

type Tx = Prisma.TransactionClient;

@Injectable()
export class PromoCodesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(dto: CreatePromoCodeDto) {
    if (dto.type === 'percent' && dto.value > 100) {
      throw new BadRequestException(
        'Відсоткова знижка не може перевищувати 100',
      );
    }

    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.promoCode.findUnique({
      where: { code },
    });
    if (existing) {
      throw new ConflictException(`Промокод "${code}" уже існує`);
    }

    return this.prisma.promoCode.create({
      data: {
        code,
        type: dto.type,
        value: dto.value,
        maxRedemptions: dto.maxRedemptions,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  async setActive(id: string, active: boolean) {
    const promoCode = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!promoCode) throw new NotFoundException('Промокод не знайдено');

    return this.prisma.promoCode.update({ where: { id }, data: { active } });
  }

  // Read-only check used by the cart/checkout screen before the buyer
  // commits — same validity rules as resolveForCheckout, but without
  // touching redemptionCount, so previewing a code twice can't itself
  // exhaust it.
  async preview(codeRaw: string, subtotalMinor: number) {
    const promoCode = await this.findValid(codeRaw);
    return {
      code: promoCode.code,
      discountMinor: this.discountFor(promoCode, subtotalMinor),
    };
  }

  // Called from inside OrdersService.checkout's transaction. Redemption is
  // an `updateMany` guarded by the same conditions that made the code
  // valid a moment ago (active, not expired, under its cap) rather than a
  // plain increment: two buyers racing for the very last use of a
  // maxRedemptions=1 code must not both succeed just because both read a
  // valid state before either wrote.
  async resolveForCheckout(
    tx: Tx,
    codeRaw: string,
    subtotalMinor: number,
  ): Promise<{ promoCode: PromoCode; discountMinor: number }> {
    const promoCode = await this.findValid(codeRaw, tx);
    const discountMinor = this.discountFor(promoCode, subtotalMinor);

    const redeemed = await tx.promoCode.updateMany({
      where: {
        id: promoCode.id,
        active: true,
        OR: [
          { maxRedemptions: null },
          { redemptionCount: { lt: promoCode.maxRedemptions ?? 0 } },
        ],
      },
      data: { redemptionCount: { increment: 1 } },
    });

    if (redeemed.count === 0) {
      throw new ConflictException(
        `Промокод "${promoCode.code}" щойно вичерпано — спробуйте оформити без нього`,
      );
    }

    return { promoCode, discountMinor };
  }

  private async findValid(
    codeRaw: string,
    client: Tx | PrismaService = this.prisma,
  ) {
    const code = codeRaw.trim().toUpperCase();
    const promoCode = await client.promoCode.findUnique({ where: { code } });

    if (!promoCode || !promoCode.active) {
      throw new NotFoundException(`Промокод "${code}" не знайдено`);
    }

    if (promoCode.expiresAt && promoCode.expiresAt < new Date()) {
      throw new BadRequestException(
        `Термін дії промокоду "${code}" закінчився`,
      );
    }

    if (
      promoCode.maxRedemptions !== null &&
      promoCode.redemptionCount >= promoCode.maxRedemptions
    ) {
      throw new BadRequestException(`Промокод "${code}" вичерпано`);
    }

    return promoCode;
  }

  private discountFor(promoCode: PromoCode, subtotalMinor: number): number {
    const raw =
      promoCode.type === 'percent'
        ? Math.floor((subtotalMinor * promoCode.value) / 100)
        : promoCode.value;

    // Capped at the subtotal: a fixed-amount code bigger than the cart, or
    // a 100% code stacked with anything else, must never push the total
    // below zero once a loyalty-points discount is subtracted too.
    return Math.min(raw, subtotalMinor);
  }
}
