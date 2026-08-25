import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { getAuth } from 'firebase-admin/auth';
import type { App } from 'firebase-admin/app';
import type { Request } from 'express';
import { FIREBASE_ADMIN_APP } from './firebase-admin.provider';
import { UsersService } from '../users/users.service';

export interface AuthenticatedRequest extends Request {
  user: { firebaseUid: string; email: string };
}

// Verifies the Firebase ID token sent as `Authorization: Bearer <token>`
// and syncs a matching row into Postgres `users` on first sight of a UID.
// See docs/adr/0002-postgres-over-firestore.md for why identity and domain
// data are split across two stores.
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    @Inject(FIREBASE_ADMIN_APP) private readonly firebaseApp: App,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing Authorization: Bearer <token> header',
      );
    }

    const token = authHeader.slice('Bearer '.length);

    try {
      const decoded = await getAuth(this.firebaseApp).verifyIdToken(token);
      await this.usersService.syncFromFirebase({
        firebaseUid: decoded.uid,
        email: decoded.email ?? '',
      });
      request.user = { firebaseUid: decoded.uid, email: decoded.email ?? '' };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired Firebase ID token');
    }
  }
}
