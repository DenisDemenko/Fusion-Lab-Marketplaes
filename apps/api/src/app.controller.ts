import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AppService } from './app.service';
import { FirebaseAuthGuard, type AuthUser } from './auth/firebase-auth.guard';
import { CurrentUser } from './auth/current-user.decorator';
import { UsersService } from './users/users.service';
import { effectivePermissions, ROLE_PERMISSIONS } from './auth/permissions';

// Self-selectable at signup — admin-only roles are granted the other way
// (PATCH /admin/users/:id/role), never through this endpoint.
const SELF_SELECTABLE_ROLES: readonly UserRole[] = [
  'buyer',
  'seller',
  'writer',
  'expert',
  'sales_manager',
  'instruction_engineer',
  'student',
];

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
  // learn the role, permissions and seller status the marketplace
  // granted — none of which the ID token knows about. `roleChosen`
  // tells the frontend whether to show the role-picker (docs/migration-
  // plan.md, Phase A) before letting the person past onboarding.
  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  async getMe(@CurrentUser() user: AuthUser) {
    const full = await this.users.findById(user.id);

    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      role: user.role,
      roleChosen: Boolean(full?.roleChosenAt),
      salesApproved: full?.salesApproved ?? false,
      permissions: full ? [...effectivePermissions(full)] : [],
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

  // One-time self-selection (docs/migration-plan.md, П36/П37): free
  // choice among the non-admin roles, exactly once — UsersService.chooseRole
  // refuses a second call. `admin` is deliberately excluded from
  // SELF_SELECTABLE_ROLES: that role is only ever granted by an existing
  // admin through the admin panel.
  @Post('me/role')
  @UseGuards(FirebaseAuthGuard)
  async chooseRole(
    @CurrentUser() user: AuthUser,
    @Body() body: { role?: UserRole },
  ) {
    if (!body.role || !SELF_SELECTABLE_ROLES.includes(body.role)) {
      throw new BadRequestException(
        `role must be one of: ${SELF_SELECTABLE_ROLES.join(', ')}`,
      );
    }

    const updated = await this.users.chooseRole(user.id, body.role);

    return {
      role: updated.role,
      roleChosen: true,
      permissions: [...ROLE_PERMISSIONS[updated.role]].filter(
        (permission) => permission !== 'sales:access' || updated.salesApproved,
      ),
    };
  }
}
