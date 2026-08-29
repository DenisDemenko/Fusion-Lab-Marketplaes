import { IsString, Length } from 'class-validator';

export class ClaimReferralDto {
  @IsString()
  @Length(4, 12)
  code!: string;
}
