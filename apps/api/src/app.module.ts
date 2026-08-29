import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CatalogModule } from './catalog/catalog.module';
import { SellersModule } from './sellers/sellers.module';
import { MediaModule } from './media/media.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AssistantModule } from './assistant/assistant.module';
import { BridgeModule } from './bridge/bridge.module';
import { PromoCodesModule } from './promo-codes/promo-codes.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { ReferralsModule } from './referrals/referrals.module';
import { PayoutsModule } from './payouts/payouts.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ChatModule } from './chat/chat.module';
import { ScheduleModule } from './schedule/schedule.module';
import { TeamsModule } from './teams/teams.module';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    SellersModule,
    MediaModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    EntitlementsModule,
    AdminModule,
    NotificationsModule,
    AssistantModule,
    BridgeModule,
    PromoCodesModule,
    LoyaltyModule,
    ReferralsModule,
    PayoutsModule,
    ReviewsModule,
    ChatModule,
    ScheduleModule,
    TeamsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
