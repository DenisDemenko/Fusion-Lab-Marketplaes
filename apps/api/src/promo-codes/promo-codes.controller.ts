import { Body, Controller, Post } from '@nestjs/common';
import { IsInt, IsString, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PromoCodesService } from './promo-codes.service';

class PreviewPromoCodeDto {
  @IsString()
  @MinLength(3)
  code!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  subtotalMinor!: number;
}

// Public: previewing a code needs no identity, only its own validity and
// the subtotal the client already knows from its own cart. The real,
// authoritative discount is recomputed server-side again inside
// OrdersService.checkout — this endpoint only powers the live "-50 грн"
// line the buyer sees before committing to anything.
@Controller('promo-codes')
export class PromoCodesController {
  constructor(private readonly promoCodes: PromoCodesService) {}

  @Post('preview')
  preview(@Body() dto: PreviewPromoCodeDto) {
    return this.promoCodes.preview(dto.code, dto.subtotalMinor);
  }
}
