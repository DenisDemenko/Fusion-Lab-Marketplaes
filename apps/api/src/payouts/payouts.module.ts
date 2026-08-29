import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PayoutsService } from './payouts.service';

@Module({
  imports: [NotificationsModule],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
