import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

// @Roles('admin') on a handler or controller, alongside
// @UseGuards(FirebaseAuthGuard, RolesGuard) — the auth guard must run
// first, since RolesGuard reads the user it attached.
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
