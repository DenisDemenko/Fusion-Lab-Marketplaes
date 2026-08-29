import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly gateway: ChatGateway,
  ) {}

  // Opening a thread is idempotent by design (unique on listingId+buyerId):
  // a buyer re-opening the chat about a listing they already messaged
  // about lands back in the same conversation, never a fresh empty one.
  async openThread(buyerId: string, listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { seller: true },
    });
    if (!listing) throw new NotFoundException('Лістинг не знайдено');

    if (listing.seller.userId === buyerId) {
      throw new BadRequestException(
        'Не можна відкрити чат із власним лістингом',
      );
    }

    return this.prisma.chatThread.upsert({
      where: { listingId_buyerId: { listingId, buyerId } },
      create: { listingId, buyerId, sellerId: listing.seller.userId },
      update: {},
      include: { listing: { select: { title: true, slug: true } } },
    });
  }

  async myThreads(userId: string) {
    const threads = await this.prisma.chatThread.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      orderBy: { updatedAt: 'desc' },
      include: {
        listing: { select: { title: true, slug: true } },
        buyer: { select: { displayName: true, email: true } },
        seller: { select: { displayName: true, email: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: {
          select: {
            messages: { where: { readAt: null, NOT: { senderId: userId } } },
          },
        },
      },
    });

    return threads.map((thread) => {
      const counterpart =
        thread.buyerId === userId ? thread.seller : thread.buyer;

      return {
        id: thread.id,
        listing: thread.listing,
        counterpartName:
          counterpart.displayName || counterpart.email.split('@')[0],
        lastMessage: thread.messages[0]?.body ?? null,
        updatedAt: thread.updatedAt,
        unreadCount: thread._count.messages,
      };
    });
  }

  async messages(userId: string, threadId: string) {
    const thread = await this.assertParticipant(userId, threadId);

    const messages = await this.prisma.chatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
    });

    // Opening the thread is what marks the other side's messages read —
    // matches how every chat app behaves, and means there's no separate
    // "mark as read" button that people forget exists.
    await this.prisma.chatMessage.updateMany({
      where: { threadId, readAt: null, NOT: { senderId: userId } },
      data: { readAt: new Date() },
    });

    return {
      thread: {
        id: thread.id,
        listingTitle: thread.listing.title,
        listingSlug: thread.listing.slug,
      },
      messages: messages.map((message) => ({
        id: message.id,
        senderId: message.senderId,
        body: message.body,
        createdAt: message.createdAt,
        mine: message.senderId === userId,
      })),
    };
  }

  async send(userId: string, threadId: string, body: string) {
    const thread = await this.assertParticipant(userId, threadId);
    const recipientId =
      thread.buyerId === userId ? thread.sellerId : thread.buyerId;

    const [message] = await this.prisma.$transaction([
      this.prisma.chatMessage.create({
        data: { threadId, senderId: userId, body },
      }),
      this.prisma.chatThread.update({
        where: { id: threadId },
        data: { updatedAt: new Date() },
      }),
    ]);

    this.gateway.emitToUser(recipientId, 'message', {
      threadId,
      id: message.id,
      senderId: userId,
      body: message.body,
      createdAt: message.createdAt,
    });

    await this.notifications.notify({
      userId: recipientId,
      type: 'chat_message',
      title: `Повідомлення про «${thread.listing.title}»`,
      body: body.length > 120 ? `${body.slice(0, 117)}...` : body,
      payload: { threadId },
    });

    return message;
  }

  async unreadCount(userId: string) {
    return this.prisma.chatMessage.count({
      where: {
        readAt: null,
        NOT: { senderId: userId },
        thread: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      },
    });
  }

  private async assertParticipant(userId: string, threadId: string) {
    const thread = await this.prisma.chatThread.findUnique({
      where: { id: threadId },
      include: { listing: { select: { title: true, slug: true } } },
    });

    if (!thread) throw new NotFoundException('Чат не знайдено');

    if (thread.buyerId !== userId && thread.sellerId !== userId) {
      throw new ForbiddenException('Це не ваш чат');
    }

    return thread;
  }
}
