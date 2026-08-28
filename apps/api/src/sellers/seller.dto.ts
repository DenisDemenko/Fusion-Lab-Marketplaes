import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ListingKind, MediaAccess, MediaKind } from '@prisma/client';

export class ApplySellerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;
}

export class CreateListingDto {
  @IsEnum(ListingKind)
  kind!: ListingKind;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40000)
  description?: string;

  // Minor units (копійки) all the way from the form to the database — see
  // src/common/money.ts for why no float ever enters the domain.
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMinor!: number;

  @IsOptional()
  @IsString()
  categorySlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[];

  // Free-form nested modules/lessons for courses; validated as JSON, not
  // as a schema, because the shape is the seller's editorial choice.
  @IsOptional()
  curriculum?: unknown;
}

export class UpdateListingDto extends CreateListingDto {
  @IsOptional()
  @IsEnum(ListingKind)
  declare kind: ListingKind;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  declare title: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  declare priceMinor: number;
}

export class UploadMediaDto {
  @IsEnum(MediaKind)
  kind!: MediaKind;

  @IsOptional()
  @IsEnum(MediaAccess)
  access?: MediaAccess;
}
