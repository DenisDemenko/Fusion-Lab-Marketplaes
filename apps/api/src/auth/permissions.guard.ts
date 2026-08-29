import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { effectivePermissions, type Permission } from './permissions';
import type { AuthenticatedRequest } from './firebase-auth.guard';

// Runs after FirebaseAuthGuard. Unlike RolesGuard, this needs a fresh
// Prisma read every time — AuthUser (attached by the auth guard) carries
// only role, not salesApproved or the override rows effectivePermissions
// needs. Cheap in practice: these are exactly the routes doing other
// writes/reads in the same request anyway (sales section, listing form).
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const full = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { permissionOverrides: true },
    });

    if (!full) {
      throw new ForbiddenException('Authentication required');
    }

    const effective = effectivePermissions(full);
    const missing = required.filter((permission) => !effective.has(permission));

    if (missing.length > 0) {
      throw new ForbiddenException(
        `This action requires: ${missing.join(', ')}`,
      );
    }

    return true;
  }
}
