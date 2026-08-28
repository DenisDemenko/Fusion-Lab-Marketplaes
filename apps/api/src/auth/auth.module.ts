import { Module } from '@nestjs/common';
import {
  FIREBASE_ADMIN_APP,
  firebaseAdminProvider,
} from './firebase-admin.provider';
import { FirebaseAuthGuard, OptionalAuthGuard } from './firebase-auth.guard';
import { RolesGuard } from './roles.guard';
import { FirebaseTokenVerifier, TOKEN_VERIFIER } from './token-verifier';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  providers: [
    firebaseAdminProvider,
    { provide: TOKEN_VERIFIER, useClass: FirebaseTokenVerifier },
    FirebaseAuthGuard,
    OptionalAuthGuard,
    RolesGuard,
  ],
  // The guards' own dependencies must be exported too, not just the guards:
  // when a guard is referenced via @UseGuards() on a controller in another
  // module, Nest resolves its constructor deps in THAT module's injector
  // scope — a provider private to AuthModule is invisible there.
  exports: [
    FirebaseAuthGuard,
    OptionalAuthGuard,
    RolesGuard,
    TOKEN_VERIFIER,
    FIREBASE_ADMIN_APP,
    UsersModule,
  ],
})
export class AuthModule {}
