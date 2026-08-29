import { IsString, MaxLength, MinLength } from 'class-validator';

export class OpenThreadDto {
  @IsString()
  listingId!: string;
}

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}
