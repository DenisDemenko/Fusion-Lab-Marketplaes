import { SetMetadata } from '@nestjs/common';
import type { Permission } from './permissions';

export const PERMISSIONS_KEY = 'permissions';

// @RequirePermissions('sales:access') — checked by PermissionsGuard,
// which must run after FirebaseAuthGuard has attached `request.user`.
// Deliberately additive to the existing @Roles('admin')/RolesGuard pair
// rather than a replacement: those checks are already correct and stable
// for admin-only routes, and rewriting every one of them carried
// regression risk with no benefit — see docs/adr/0007-role-permission-model.md.
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
