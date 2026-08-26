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
    // Prefer base64 (FIREBASE_PRIVATE_KEY_B64): plain PEM env vars get
    // mangled by hosting dashboards that don't preserve \n / quoting
    // exactly (seen on Railway — DECODER routines::unsupported). Base64
    // is opaque ASCII, immune to that class of corruption.
    const privateKey = process.env.FIREBASE_PRIVATE_KEY_B64
      ? Buffer.from(process.env.FIREBASE_PRIVATE_KEY_B64, 'base64').toString('utf8')
      : process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / ' +
          'FIREBASE_PRIVATE_KEY(_B64). Generate a service account key for ' +
          'fusionlab-acc2d and fill .env — see .env.example.',
      );
    }

    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  },
};
