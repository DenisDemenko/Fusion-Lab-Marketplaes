import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Logger,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard, type AuthUser } from '../auth/firebase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  LIQPAY_FAILURE_STATUSES,
  LIQPAY_SUCCESS_STATUSES,
  LiqpayService,
} from '../payments/liqpay.service';
import { OrdersService } from './orders.service';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly liqpay: LiqpayService,
    private readonly orders: OrdersService,
  ) {}

  // LiqPay's server-to-server notification. Public by necessity — the bank
  // has no token from us — so the signature is the whole security model:
  // an unsigned or badly signed body is dropped before it can touch an
  // order. Always answers 200, because LiqPay retries anything else for
  // hours, and a body we intentionally rejected will never become valid.
  @Post('liqpay/callback')
  @HttpCode(200)
  async liqpayCallback(@Body() body: { data?: string; signature?: string }) {
    const { data, signature } = body;

    if (!data || !signature || !this.liqpay.verifySignature(data, signature)) {
      this.logger.warn('Rejected LiqPay callback: bad or missing signature');
      return { accepted: false, reason: 'invalid_signature' };
    }

    const payload = this.liqpay.parseCallbackData(data);
    this.logger.log(
      `LiqPay callback: order=${payload.order_id} status=${payload.status}`,
    );

    if (LIQPAY_SUCCESS_STATUSES.has(payload.status)) {
      await this.orders.markPaid(payload.order_id, {
        providerPaymentId: payload.payment_id
          ? String(payload.payment_id)
          : undefined,
        raw: { ...payload },
      });
      return { accepted: true, status: payload.status };
    }

    if (LIQPAY_FAILURE_STATUSES.has(payload.status)) {
      await this.orders.markFailed(payload.order_id, payload.err_description);
      return { accepted: true, status: payload.status };
    }

    // Intermediate states (processing, prepared…) are informational: the
    // order stays pending until a terminal status arrives.
    return { accepted: true, status: payload.status, ignored: true };
  }

  // Demo path for an environment with no LiqPay keys — the deployed
  // portfolio build, and the e2e suite. It refuses to exist the moment
  // real keys are configured, so it cannot become a way to take goods for
  // free in production, and it only ever touches the caller's own order.
  @Post('dev/confirm')
  @UseGuards(FirebaseAuthGuard)
  async devConfirm(
    @CurrentUser() user: AuthUser,
    @Body() body: { orderNumber?: string },
  ) {
    if (this.liqpay.enabled) {
      throw new NotFoundException(
        'Демо-підтвердження вимкнене: налаштовано реальний LiqPay',
      );
    }

    if (!body.orderNumber) {
      throw new NotFoundException('Вкажіть orderNumber');
    }

    // Ownership is checked through the buyer-scoped lookup, which 404s on
    // someone else's order number.
    const order = await this.orders.getForUser(user.id, body.orderNumber);

    if (order.status === 'cancelled') {
      throw new ForbiddenException('Замовлення скасоване');
    }

    return this.orders.markPaid(order.number, {
      providerPaymentId: `demo-${order.number}`,
      raw: { mode: 'demo', confirmedBy: user.email },
    });
  }
}
