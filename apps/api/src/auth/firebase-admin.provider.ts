import { Provider } from '@nestjs/common';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';

export const FIREBASE_ADMIN_APP = 'FIREBASE_ADMIN_APP';

// Lazily initialised so a missing/incomplete .env fails with one clear
// error at startup instead of a cryptic error deep inside token verification.
export const firebaseAdminProvider: Provider = {
  provide: FIREBASE_ADMIN_APP,
  useFactory: (): App => {
    if (getApps().length > 0) {
      return getApps()[0];
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY. ' +
          'Generate a service account key for fusionlab-acc2d and fill .env — see .env.example.',
      );
    }

    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  },
};
