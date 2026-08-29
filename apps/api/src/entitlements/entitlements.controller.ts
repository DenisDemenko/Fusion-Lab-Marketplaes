import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard, type AuthUser } from '../auth/firebase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EntitlementsService } from './entitlements.service';

@Controller('me/library')
@UseGuards(FirebaseAuthGuard)
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Get()
  library(@CurrentUser() user: AuthUser) {
    return this.entitlements.library(user.id);
  }

  @Get(':slug')
  item(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.entitlements.item(user.id, slug);
  }

  @Post(':slug/progress')
  setProgress(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Body()
    body: { moduleIndex: number; lessonIndex: number; completed: boolean },
  ) {
    return this.entitlements.setLessonProgress(user.id, slug, body);
  }
}
