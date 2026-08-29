import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard, type AuthUser } from '../auth/firebase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ReferralsService } from './referrals.service';
import { ClaimReferralDto } from './referrals.dto';

@Controller('referrals')
@UseGuards(FirebaseAuthGuard)
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('me')
  myInfo(@CurrentUser() user: AuthUser) {
    return this.referrals.myInfo(user.id);
  }

  @Post('claim')
  claim(@CurrentUser() user: AuthUser, @Body() dto: ClaimReferralDto) {
    return this.referrals.claim(user.id, dto.code);
  }
}
