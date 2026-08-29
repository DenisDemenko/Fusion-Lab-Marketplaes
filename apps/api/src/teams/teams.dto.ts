import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MediaKind } from '@prisma/client';

export class CreateTeamDto {
  @IsString()
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  direction?: string;

  @IsString()
  @MaxLength(2000)
  description!: string;

  // The consent checkbox from the old page ("маю згоду всіх зображених
  // осіб... на публікацію фото") — required, not just recorded, since
  // there is no photo review step separate from the team's own
  // moderation to catch a missing consent later.
  @Equals(true)
  consent!: boolean;

  // Owner counts as the 5th seat, so at most 4 more at creation time —
  // TeamsService.invite is how a team fills the rest later.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsEmail({}, { each: true })
  memberEmails?: string[];
}

export class InviteMemberDto {
  @IsEmail()
  email!: string;
}

export class UploadTeamMediaDto {
  @IsIn(['cover', 'attachment'] satisfies MediaKind[])
  kind!: 'cover' | 'attachment';
}
