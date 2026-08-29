import { IsEmail } from 'class-validator';

export class InviteSalesManagerDto {
  @IsEmail()
  email!: string;
}
