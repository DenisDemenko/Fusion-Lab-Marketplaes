import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard, type AuthUser } from '../auth/firebase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OrdersService } from './orders.service';
import { CheckoutDto } from './checkout.dto';

@Controller('orders')
@UseGuards(FirebaseAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  // Turns the cart into an order and hands back everything the checkout
  // page needs to redirect to LiqPay in one response — the frontend never
  // has to make a second call to find out how to pay.
  @Post('checkout')
  async checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    const order = await this.orders.checkout(user.id, {
      promoCode: dto.promoCode,
      loyaltyPointsToSpend: dto.loyaltyPointsToSpend,
    });
    return { order, payment: this.orders.checkoutPayload(order) };
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.orders.listForUser(user.id);
  }

  @Get(':number')
  async get(@CurrentUser() user: AuthUser, @Param('number') number: string) {
    const order = await this.orders.getForUser(user.id, number);
    return { order, payment: this.orders.checkoutPayload(order) };
  }
}
