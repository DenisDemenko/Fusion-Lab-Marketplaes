import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard, type AuthUser } from '../auth/firebase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ScheduleService } from './schedule.service';

@Controller()
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @Get('schedule')
  list() {
    return this.schedule.list();
  }

  @Get('me/bookings')
  @UseGuards(FirebaseAuthGuard)
  mine(@CurrentUser() user: AuthUser) {
    return this.schedule.mine(user.id);
  }

  @Post('schedule/:id/book')
  @UseGuards(FirebaseAuthGuard)
  book(@CurrentUser() user: AuthUser, @Param('id') scheduleId: string) {
    return this.schedule.book(user.id, scheduleId);
  }

  @Delete('schedule/:id/book')
  @UseGuards(FirebaseAuthGuard)
  cancel(@CurrentUser() user: AuthUser, @Param('id') scheduleId: string) {
    return this.schedule.cancel(user.id, scheduleId);
  }
}
