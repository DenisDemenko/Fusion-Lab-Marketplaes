import { Module } from '@nestjs/common';
import {
  FIREBASE_ADMIN_APP,
  firebaseAdminProvider,
} from './firebase-admin.provider';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  providers: [firebaseAdminProvider, FirebaseAuthGuard],
  // FIREBASE_ADMIN_APP must be exported too, not just the guard: when
  // FirebaseAuthGuard is referenced via @UseGuards() on a controller that
  // lives in a different module (AppModule), Nest resolves the guard's
  // own constructor deps in THAT module's injector scope — a provider
  // private to AuthModule is invisible there otherwise.
  exports: [FirebaseAuthGuard, FIREBASE_ADMIN_APP],
})
export class AuthModule {}
