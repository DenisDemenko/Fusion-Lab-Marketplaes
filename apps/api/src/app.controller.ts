import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { FirebaseAuthGuard, type AuthUser } from './auth/firebase-auth.guard';
import { CurrentUser } from './auth/current-user.decorator';
import { UsersService } from './users/users.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly users: UsersService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Who am I: the frontend calls this right after Firebase sign-in to
  // learn the role and seller status the marketplace granted — neither of
  // which the ID token knows about.
  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  async getMe(@CurrentUser() user: AuthUser) {
    const full = await this.users.findById(user.id);

    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      role: user.role,
      displayName: full?.displayName ?? null,
      referralCode: full?.referralCode ?? null,
      seller: full?.sellerProfile
        ? {
            id: full.sellerProfile.id,
            slug: full.sellerProfile.slug,
            displayName: full.sellerProfile.displayName,
            status: full.sellerProfile.status,
          }
        : null,
    };
  }
}
