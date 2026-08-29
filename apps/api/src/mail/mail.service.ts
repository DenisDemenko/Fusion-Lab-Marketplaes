import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

// SMTP settings are read once at construction. A missing host is not an
// error: local development and CI have no mail server, and the features
// that send mail must keep working there — every caller of this service
// also records an in-app notification, so an unsent letter degrades the
// experience without breaking the flow.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor() {
    const host = process.env.SMTP_HOST;
    this.from =
      process.env.MAIL_FROM ?? 'Fusion Lab <no-reply@fusionlab.in.ua>';

    if (!host) {
      this.transporter = null;
      this.logger.warn(
        'SMTP_HOST не задано — листи не надсилатимуться, лишаються лише сповіщення в застосунку',
      );
      return;
    }

    const port = Number(process.env.SMTP_PORT ?? 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;

    this.transporter = createTransport({
      host,
      port,
      // 465 is the implicit-TLS port; everything else starts plaintext and
      // upgrades via STARTTLS, which nodemailer does on its own.
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  get isConfigured(): boolean {
    return this.transporter !== null;
  }

  // Never throws. A failed send is logged and reported back as `false` so
  // the caller can tell the user "we could not email this" instead of
  // losing the whole request to a transport error.
  async send(input: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<boolean> {
    if (!this.transporter) return false;

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Не вдалося надіслати лист на ${input.to}: ${String(error)}`,
      );
      return false;
    }
  }
}
