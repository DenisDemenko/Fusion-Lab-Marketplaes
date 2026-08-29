import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard, type AuthUser } from '../auth/firebase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SalesManagerInvitesService } from './sales-manager-invites.service';
import { InviteSalesManagerDto } from './sales-manager-invites.dto';

// Phase H2 (docs/migration-plan.md). These routes are the only door into
// the sales_manager role: it is absent from SELF_SELECTABLE_ROLES, so
// POST /me/role cannot be used as a second one.
@Controller()
export class SalesManagerInvitesController {
  constructor(private readonly invites: SalesManagerInvitesService) {}

  @Post('me/sales-manager-invites')
  @UseGuards(FirebaseAuthGuard)
  invite(@CurrentUser() user: AuthUser, @Body() dto: InviteSalesManagerDto) {
    return this.invites.invite(user.id, dto.email);
  }

  @Get('me/sales-manager-invites')
  @UseGuards(FirebaseAuthGuard)
  listMine(@CurrentUser() user: AuthUser) {
    return this.invites.listMine(user.id);
  }

  @Delete('me/sales-manager-invites/:id')
  @UseGuards(FirebaseAuthGuard)
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invites.revoke(user.id, id);
  }

  // Authenticated on purpose: accepting assigns a role, so we need to know
  // *whose* role, and the email check inside the service needs a signed-in
  // identity to compare against.
  @Post('sales-manager-invites/:token/accept')
  @UseGuards(FirebaseAuthGuard)
  accept(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.invites.accept(user.id, token);
  }
}
