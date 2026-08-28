import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, AuthUser } from './firebase-auth.guard';

// Use alongside @UseGuards(FirebaseAuthGuard): (@CurrentUser() user: AuthUser).
// Under OptionalAuthGuard the value is undefined for anonymous visitors.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
