import { Controller, Get, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard, type AuthUser } from '../auth/firebase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { LoyaltyService } from './loyalty.service';

@Controller('me/loyalty')
@UseGuards(FirebaseAuthGuard)
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get()
  history(@CurrentUser() user: AuthUser) {
    return this.loyalty.history(user.id);
  }
}
