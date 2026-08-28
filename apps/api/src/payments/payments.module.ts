import { Module } from '@nestjs/common';
import { LiqpayService } from './liqpay.service';

// Only the gateway client lives here. The callback controller belongs to
// the orders module instead, because handling a callback means changing an
// order — and a payments module that imported orders while orders imported
// payments would be a circular dependency for no gain.
@Module({
  providers: [LiqpayService],
  exports: [LiqpayService],
})
export class PaymentsModule {}
