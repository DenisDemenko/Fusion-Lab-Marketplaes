import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { OptionalAuthGuard, type AuthUser } from '../auth/firebase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AssistantService } from './assistant.service';

export class AssistantChatDto {
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  message!: string;

  @IsOptional()
  @IsString()
  threadId?: string;
}

// Anonymous visitors get the assistant too — asking "which course suits a
// school teacher?" before creating an account is exactly when people ask.
@Controller('assistant')
@UseGuards(OptionalAuthGuard)
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('chat')
  chat(
    @CurrentUser() user: AuthUser | undefined,
    @Body() dto: AssistantChatDto,
  ) {
    return this.assistant.chat({
      message: dto.message,
      threadId: dto.threadId,
      userId: user?.id,
    });
  }

  @Get('threads/:id')
  history(@Param('id') id: string) {
    return this.assistant.history(id);
  }
}
