import { Module } from '@nestjs/common';
import { firebaseAdminProvider } from './firebase-admin.provider';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  providers: [firebaseAdminProvider, FirebaseAuthGuard],
  exports: [FirebaseAuthGuard],
})
export class AuthModule {}
