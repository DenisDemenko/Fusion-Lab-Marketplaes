import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  // Persist first, then push. If the socket is gone the user still finds
  // the notification in their bell menu on the next page load; if the row
  // failed to write, there is nothing worth pushing.
  async notify(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    payload?: Prisma.InputJsonValue;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        payload: input.payload,
      },
    });

    this.gateway.emitToUser(input.userId, 'notification', notification);
    return notification;
  }

  // Admins are addressed by role, not by id: "someone has to review this"
  // is a queue, and every admin should see it.
  async notifyAdmins(input: {
    type: NotificationType;
    title: string;
    body: string;
    payload?: Prisma.InputJsonValue;
  }) {
    const admins = await this.prisma.user.findMany({
      where: { role: 'admin' },
      select: { id: true },
    });

    return Promise.all(
      admins.map((admin) => this.notify({ ...input, userId: admin.id })),
    );
  }

  list(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string) {
    // Scoped by userId in the WHERE clause, not checked afterwards: a
    // guessed notification id from another account updates zero rows.
    const result = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}
