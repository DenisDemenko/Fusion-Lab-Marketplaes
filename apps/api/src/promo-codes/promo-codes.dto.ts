import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { PromoCodeType } from '@prisma/client';

export class CreatePromoCodeDto {
  @IsString()
  @MinLength(3)
  code!: string;

  @IsEnum(PromoCodeType)
  type!: PromoCodeType;

  // percent: 1-100; fixed: minor units. Validated against `type` in the
  // service, since class-validator checks one field in isolation.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  value!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdatePromoCodeDto {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
