import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { PromoCodesModule } from '../promo-codes/promo-codes.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { OrdersController } from './orders.controller';
import { PaymentsController } from './payments.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    AuthModule,
    CartModule,
    NotificationsModule,
    PaymentsModule,
    PromoCodesModule,
    LoyaltyModule,
    ReferralsModule,
  ],
  controllers: [OrdersController, PaymentsController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
