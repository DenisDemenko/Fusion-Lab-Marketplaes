import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import { minorToMajor } from '../common/money';

// LiqPay (ПриватБанк) is the only realistic way to take UAH cards. The
// protocol is deliberately SDK-free: JSON parameters are packed into
// base64 (`data`), signed as sha1(private_key + data + private_key), also
// base64 (`signature`). The browser then submits both fields in a hidden
// form to the checkout URL.
//
// Ported from Book_Creality (server/payments/liqpay.ts) — the same bank,
// the same protocol, deliberately duplicated rather than shared: the two
// systems are separate deployables joined only by the bridge API (ADR 0001).
//
// Source: https://www.liqpay.ua/documentation/en/data_signature
export const LIQPAY_CHECKOUT_URL = 'https://www.liqpay.ua/api/3/checkout';

export const LIQPAY_SUCCESS_STATUSES = new Set([
  'success',
  'sandbox',
  'wait_accept',
]);

export const LIQPAY_FAILURE_STATUSES = new Set([
  'failure',
  'error',
  'reversed',
  'expired',
]);

export interface LiqpayCallbackPayload {
  status: string;
  order_id: string;
  amount: number;
  currency: string;
  payment_id?: number | string;
  err_description?: string;
}

@Injectable()
export class LiqpayService {
  private get publicKey(): string {
    return process.env.LIQPAY_PUBLIC_KEY ?? '';
  }

  private get privateKey(): string {
    return process.env.LIQPAY_PRIVATE_KEY ?? '';
  }

  // Read at call time, not at construction: the deploy that adds the keys
  // should not need a code change to notice them.
  get enabled(): boolean {
    return Boolean(this.publicKey && this.privateKey);
  }

  // `sandbox: 1` makes LiqPay accept test cards and settle nothing. It is
  // driven by an explicit env var rather than NODE_ENV, because a staging
  // deploy runs in production mode and still must not move real money.
  private get sandbox(): boolean {
    return process.env.LIQPAY_SANDBOX === '1';
  }

  buildCheckout(params: {
    amountMinor: number;
    currency: string;
    description: string;
    orderNumber: string;
    resultUrl: string;
    serverUrl: string;
  }): { data: string; signature: string; actionUrl: string } {
    const payload = {
      public_key: this.publicKey,
      version: '3',
      action: 'pay',
      // LiqPay speaks major units with decimals; the domain speaks minor
      // units. This line is the only place the two meet.
      amount: minorToMajor(params.amountMinor),
      currency: params.currency,
      description: params.description,
      order_id: params.orderNumber,
      result_url: params.resultUrl,
      server_url: params.serverUrl,
      language: 'uk',
      ...(this.sandbox ? { sandbox: 1 } : {}),
    };

    const data = Buffer.from(JSON.stringify(payload), 'utf8').toString(
      'base64',
    );
    return { data, signature: this.sign(data), actionUrl: LIQPAY_CHECKOUT_URL };
  }

  // Anyone can POST to the callback URL, so the signature is the only
  // thing separating a real payment notification from someone marking
  // their own order paid. Compared in constant time.
  verifySignature(data: string, signature: string): boolean {
    if (!data || !signature) return false;

    const expected = Buffer.from(this.sign(data));
    const received = Buffer.from(signature);

    return (
      expected.length === received.length &&
      crypto.timingSafeEqual(expected, received)
    );
  }

  parseCallbackData(data: string): LiqpayCallbackPayload {
    return JSON.parse(
      Buffer.from(data, 'base64').toString('utf8'),
    ) as LiqpayCallbackPayload;
  }

  private sign(data: string): string {
    return crypto
      .createHash('sha1')
      .update(this.privateKey + data + this.privateKey)
      .digest('base64');
  }
}
