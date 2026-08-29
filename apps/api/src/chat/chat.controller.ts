import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard, type AuthUser } from '../auth/firebase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ChatService } from './chat.service';
import { OpenThreadDto, SendMessageDto } from './chat.dto';

@Controller('chat')
@UseGuards(FirebaseAuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('threads')
  myThreads(@CurrentUser() user: AuthUser) {
    return this.chat.myThreads(user.id);
  }

  // Wrapped in an object rather than returning the bare number: Express's
  // res.send() special-cases a numeric argument as an HTTP status code,
  // not a body, so `return 3` here would not reliably serialize as `3`.
  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthUser) {
    return { count: await this.chat.unreadCount(user.id) };
  }

  @Post('threads')
  openThread(@CurrentUser() user: AuthUser, @Body() dto: OpenThreadDto) {
    return this.chat.openThread(user.id, dto.listingId);
  }

  @Get('threads/:threadId/messages')
  messages(@CurrentUser() user: AuthUser, @Param('threadId') threadId: string) {
    return this.chat.messages(user.id, threadId);
  }

  @Post('threads/:threadId/messages')
  send(
    @CurrentUser() user: AuthUser,
    @Param('threadId') threadId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chat.send(user.id, threadId, dto.body);
  }
}
