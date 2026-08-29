import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CheckoutDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  promoCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  loyaltyPointsToSpend?: number;
}
