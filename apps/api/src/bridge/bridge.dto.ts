import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class PublishBookDto {
  // The id the book has in Book_Creality. Together with the source it
  // makes re-publishing idempotent.
  @IsString()
  @MinLength(1)
  externalId!: string;

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

  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMinor!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[];

  @IsOptional()
  @IsString()
  sellerSlug?: string;
}

export class PublishCourseDto {
  // The id the course has in Nova/Book_Creality, suffixed `:course` by the
  // studio. Together with the source it makes re-publishing idempotent.
  @IsString()
  @MinLength(1)
  externalId!: string;

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

  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMinor!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[];

  @IsOptional()
  @IsString()
  sellerSlug?: string;

  // The studio publishes course metadata today: counts now, the full nested
  // curriculum (same shape as the seller cabinet) later.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  moduleCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lessonCount?: number;

  @IsOptional()
  curriculum?: unknown;
}
