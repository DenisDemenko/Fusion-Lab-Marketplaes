import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { UsersService } from '../users/users.service';
import {
  TOKEN_VERIFIER,
  type TokenVerifier,
  type VerifiedToken,
} from './token-verifier';

export interface AuthUser {
  id: string;
  firebaseUid: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

// Verifies the Firebase ID token sent as `Authorization: Bearer <token>`
// and syncs a matching row into Postgres `users` on first sight of a UID.
// See docs/adr/0002-postgres-over-firestore.md for why identity and domain
// data are split across two stores.
//
// The request carries the *Postgres* user (id + role), not the decoded
// token: every downstream module keys off `user.id`, and role checks must
// read the role the marketplace granted, never a claim the client sent.
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.user = await this.authenticate(request);
    return true;
  }

  protected async authenticate(request: Request): Promise<AuthUser> {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing Authorization: Bearer <token> header',
      );
    }

    const token = authHeader.slice('Bearer '.length);

    let verified: VerifiedToken;
    try {
      verified = await this.verifier.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired Firebase ID token');
    }

    const user = await this.usersService.syncFromFirebase({
      firebaseUid: verified.uid,
      email: verified.email,
      displayName: verified.name,
    });

    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      role: user.role,
    };
  }
}

// Same verification, but an anonymous visitor is allowed through with no
// user attached. The AI assistant and the catalog both answer guests; they
// simply answer them without personalisation.
@Injectable()
export class OptionalAuthGuard extends FirebaseAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    if (!request.headers.authorization) {
      return true;
    }

    (request as AuthenticatedRequest).user = await this.authenticate(request);
    return true;
  }
}
