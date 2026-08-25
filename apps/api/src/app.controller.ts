import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { FirebaseAuthGuard } from './auth/firebase-auth.guard';
import { CurrentUser } from './auth/current-user.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Smoke-test route for the Firebase Auth guard: call with
  // `Authorization: Bearer <Firebase ID token>` and it echoes back the
  // synced Postgres user. Remove once real seller/buyer endpoints exist.
  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  getMe(@CurrentUser() user: { firebaseUid: string; email: string }) {
    return user;
  }
}
