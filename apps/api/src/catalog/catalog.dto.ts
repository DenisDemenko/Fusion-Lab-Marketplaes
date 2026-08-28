import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ListingKind } from '@prisma/client';

export class CatalogQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsEnum(ListingKind)
  kind?: ListingKind;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  seller?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPriceMinor?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPriceMinor?: number;

  @IsOptional()
  @IsEnum({
    relevance: 'relevance',
    newest: 'newest',
    price_asc: 'price_asc',
    price_desc: 'price_desc',
  })
  sort?: 'relevance' | 'newest' | 'price_asc' | 'price_desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  perPage?: number;
}
