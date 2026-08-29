import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SalesManagerInvitesController } from './sales-manager-invites.controller';
import { SalesManagerInvitesService } from './sales-manager-invites.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [SalesManagerInvitesController],
  providers: [SalesManagerInvitesService],
})
export class SalesManagerInvitesModule {}
