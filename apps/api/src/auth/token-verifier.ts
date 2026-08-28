import { Inject, Injectable } from '@nestjs/common';
import { getAuth } from 'firebase-admin/auth';
import type { App } from 'firebase-admin/app';
import { FIREBASE_ADMIN_APP } from './firebase-admin.provider';

export interface VerifiedToken {
  uid: string;
  email: string;
  name?: string;
}

// The one place that turns a bearer string into an identity. It exists as
// an interface so end-to-end tests can substitute a deterministic verifier:
// Firebase ID tokens are signed by Google and cannot be minted offline, so
// without this seam every test of every protected route would need a live
// Firebase project and network access. Production code has no test branch —
// the swap happens in the Nest testing module, not behind an env flag.
export interface TokenVerifier {
  verify(idToken: string): Promise<VerifiedToken>;
}

export const TOKEN_VERIFIER = 'TOKEN_VERIFIER';

@Injectable()
export class FirebaseTokenVerifier implements TokenVerifier {
  constructor(@Inject(FIREBASE_ADMIN_APP) private readonly app: App) {}

  async verify(idToken: string): Promise<VerifiedToken> {
    const decoded = await getAuth(this.app).verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email ?? '',
      name: typeof decoded.name === 'string' ? decoded.name : undefined,
    };
  }
}
