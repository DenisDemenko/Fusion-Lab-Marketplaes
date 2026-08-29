import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FirebaseAuthGuard, type AuthUser } from '../auth/firebase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { MAX_TEAM_MEDIA_BYTES, TeamsService } from './teams.service';
import {
  CreateTeamDto,
  InviteMemberDto,
  UploadTeamMediaDto,
} from './teams.dto';

@Controller()
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get('teams')
  list(@Query('direction') direction?: string, @Query('q') q?: string) {
    return this.teams.list({ direction, q });
  }

  @Get('teams/:id')
  getOne(@Param('id') id: string) {
    return this.teams.getPublic(id);
  }

  @Post('teams')
  @UseGuards(FirebaseAuthGuard)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTeamDto) {
    return this.teams.create(user.id, dto);
  }

  @Post('teams/:id/invite')
  @UseGuards(FirebaseAuthGuard)
  invite(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.teams.invite(user.id, id, dto.email);
  }

  @Post('teams/:id/media')
  @UseGuards(FirebaseAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_TEAM_MEDIA_BYTES } }),
  )
  uploadMedia(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadTeamMediaDto,
  ) {
    return this.teams.uploadMedia(user.id, id, file, dto);
  }

  @Delete('teams/media/:mediaId')
  @UseGuards(FirebaseAuthGuard)
  deleteMedia(
    @CurrentUser() user: AuthUser,
    @Param('mediaId') mediaId: string,
  ) {
    return this.teams.deleteMedia(user.id, mediaId);
  }

  @Get('me/teams')
  @UseGuards(FirebaseAuthGuard)
  mine(@CurrentUser() user: AuthUser) {
    return this.teams.mine(user.id);
  }

  @Get('me/team-invites')
  @UseGuards(FirebaseAuthGuard)
  myInvites(@CurrentUser() user: AuthUser) {
    return this.teams.myInvites(user.id);
  }

  @Post('me/team-invites/:memberId/accept')
  @UseGuards(FirebaseAuthGuard)
  acceptInvite(
    @CurrentUser() user: AuthUser,
    @Param('memberId') memberId: string,
  ) {
    return this.teams.respondInvite(user.id, memberId, true);
  }

  @Post('me/team-invites/:memberId/decline')
  @UseGuards(FirebaseAuthGuard)
  declineInvite(
    @CurrentUser() user: AuthUser,
    @Param('memberId') memberId: string,
  ) {
    return this.teams.respondInvite(user.id, memberId, false);
  }
}
