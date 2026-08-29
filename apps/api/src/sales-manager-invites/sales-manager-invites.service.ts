import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';

// A week is long enough for someone to notice the mail and short enough
// that a forwarded link stops working before it is forgotten about.
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Only these roles may hand out the sales_manager role. `writer` is the
// case the migration plan describes (H2); `admin` is included because an
// admin can already set any role directly — withholding the invite from
// them would be theatre, not a boundary.
const CAN_INVITE = ['writer', 'admin'] as const;

function inviteHtml(inviter: string, link: string): string {
  return `
    <p>${inviter} запрошує вас стати <b>менеджером продажів</b> на платформі Fusion Lab.</p>
    <p>Ця роль дає доступ до публікації на Amazon KDP та Etsy, а також до публікації в Nova.</p>
    <p><a href="${link}">Прийняти запрошення</a></p>
    <p>Посилання дійсне 7 днів. Якщо ви не очікували цього листа — просто проігноруйте його.</p>
  `;
}

function inviteText(inviter: string, link: string): string {
  return [
    `${inviter} запрошує вас стати менеджером продажів на платформі Fusion Lab.`,
    'Ця роль дає доступ до публікації на Amazon KDP та Etsy, а також до публікації в Nova.',
    `Прийняти запрошення: ${link}`,
    'Посилання дійсне 7 днів. Якщо ви не очікували цього листа — просто проігноруйте його.',
  ].join('\n\n');
}

@Injectable()
export class SalesManagerInvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  // Phase H2. The role is absent from SELF_SELECTABLE_ROLES, so this method
  // is the only path to it besides an admin's direct role change.
  async invite(inviterId: string, rawEmail: string) {
    const inviter = await this.prisma.user.findUniqueOrThrow({
      where: { id: inviterId },
    });

    if (!CAN_INVITE.includes(inviter.role as (typeof CAN_INVITE)[number])) {
      throw new ForbiddenException(
        'Запрошувати менеджера продажів може лише письменник',
      );
    }

    const email = rawEmail.trim().toLowerCase();

    if (email === inviter.email.toLowerCase()) {
      throw new BadRequestException('Не можна запросити самого себе');
    }

    // An outstanding invite blocks a second one for the same address. Not
    // for tidiness: each invite is a live credential, and quietly minting
    // extras means revoking one no longer revokes access.
    const outstanding = await this.prisma.salesManagerInvite.findFirst({
      where: { email, acceptedAt: null, expiresAt: { gt: new Date() } },
    });

    if (outstanding) {
      throw new ConflictException(
        'Для цієї пошти вже є чинне запрошення — дочекайтесь або скасуйте його',
      );
    }

    const invite = await this.prisma.salesManagerInvite.create({
      data: {
        token: randomBytes(32).toString('base64url'),
        inviterId,
        email,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });

    const link = `${process.env.APP_BASE_URL ?? 'https://fusionlab.in.ua'}/invite/sales-manager/${invite.token}`;
    const inviterName = inviter.displayName ?? inviter.email;

    const emailed = await this.mail.send({
      to: email,
      subject: 'Запрошення стати менеджером продажів — Fusion Lab',
      text: inviteText(inviterName, link),
      html: inviteHtml(inviterName, link),
    });

    // If the address already belongs to an account, the invite also lands
    // in their bell menu. That is the fallback when SMTP is not configured,
    // and a convenience when it is.
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      await this.notifications.notify({
        userId: existing.id,
        type: 'sales_manager_invited',
        title: 'Запрошення стати менеджером продажів',
        body: `${inviterName} запрошує вас керувати продажами`,
        payload: { token: invite.token },
      });
    }

    return {
      id: invite.id,
      email: invite.email,
      expiresAt: invite.expiresAt,
      emailed,
      // Surfaced so the UI can warn "invite created but mail is off"
      // instead of silently implying a letter went out.
      notifiedInApp: Boolean(existing),
    };
  }

  async listMine(inviterId: string) {
    const invites = await this.prisma.salesManagerInvite.findMany({
      where: { inviterId },
      orderBy: { createdAt: 'desc' },
    });

    return invites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
      status: invite.acceptedAt
        ? ('accepted' as const)
        : invite.expiresAt < new Date()
          ? ('expired' as const)
          : ('pending' as const),
    }));
  }

  // Revocation is a delete rather than a flag: an unaccepted invite has no
  // history worth keeping, and leaving the row would keep its token valid
  // unless every read remembered to filter on a `revoked` column.
  async revoke(inviterId: string, id: string) {
    const invite = await this.prisma.salesManagerInvite.findUnique({
      where: { id },
    });

    if (!invite || invite.inviterId !== inviterId) {
      throw new NotFoundException('Запрошення не знайдено');
    }

    if (invite.acceptedAt) {
      throw new ConflictException(
        'Запрошення вже прийнято — роль знімає адміністратор',
      );
    }

    await this.prisma.salesManagerInvite.delete({ where: { id } });
    return { revoked: true };
  }

  async accept(userId: string, token: string) {
    const invite = await this.prisma.salesManagerInvite.findUnique({
      where: { token },
    });

    if (!invite) throw new NotFoundException('Запрошення не знайдено');
    if (invite.acceptedAt) {
      throw new ConflictException('Запрошення вже використано');
    }
    if (invite.expiresAt < new Date()) {
      throw new ConflictException('Термін дії запрошення минув');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    // The invite names an address, and only that address may spend it —
    // otherwise a forwarded link would be a role grant to whoever opened
    // it first, which is exactly what invite-only is meant to prevent.
    if (user.email.toLowerCase() !== invite.email) {
      throw new ForbiddenException(
        'Запрошення надіслано на іншу пошту — увійдіть під нею',
      );
    }

    // Role and acceptance move together: a half-applied invite would
    // either burn a valid credential or leave a spent one reusable.
    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        // roleChosenAt is set too: the person now has a role they did not
        // pick, and POST /me/role must not let them overwrite it later
        // with a self-selected one.
        data: {
          role: 'sales_manager',
          roleChosenAt: user.roleChosenAt ?? new Date(),
        },
      }),
      this.prisma.salesManagerInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date(), acceptedById: userId },
      }),
    ]);

    await this.notifications.notify({
      userId: invite.inviterId,
      type: 'sales_manager_invited',
      title: 'Запрошення прийнято',
      body: `${user.displayName ?? user.email} тепер менеджер продажів`,
    });

    return { role: updated.role, acceptedAt: new Date() };
  }
}
