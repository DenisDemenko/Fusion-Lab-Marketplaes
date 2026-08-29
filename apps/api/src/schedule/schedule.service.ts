import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClassBooking, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateClassScheduleDto } from './schedule.dto';

type Tx = Prisma.TransactionClient;

// Real, capacity-checked booking for the lab's own offline sessions
// (docs/migration-plan.md Phase F2) — the "4 з 12 місць" pattern from the
// lab's own style guide, backed by an actual guarded counter rather than a
// contact-us form that just hopes nobody double-books a slot.
@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // Upcoming, still-scheduled slots — what a visitor browses to pick a
  // class. Past or cancelled slots are not offered here (see `mine` /
  // admin listing for those).
  list() {
    return this.prisma.classSchedule.findMany({
      where: { status: 'scheduled', startsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
    });
  }

  async mine(userId: string) {
    const bookings = await this.prisma.classBooking.findMany({
      where: { userId, status: 'confirmed' },
      include: { schedule: true },
      orderBy: { schedule: { startsAt: 'asc' } },
    });

    return bookings.map((booking) => ({
      id: booking.id,
      status: booking.status,
      createdAt: booking.createdAt,
      schedule: booking.schedule,
    }));
  }

  // Two guards, not one, because there are two different rows a race can
  // hit. First: does a CONFIRMED booking for this (schedule, user) get
  // created at all — see claimBookingRow for how that stays exactly-once
  // even under a same-person double-click. Second: does `bookedCount`
  // cross `capacity` — the same idempotency pattern as
  // PromoCodesService.resolveForCheckout, an `updateMany` re-checking the
  // exact condition that made booking valid a moment ago. The increment
  // only runs after a *successful* claim, so a request that loses the
  // claim race never touches the seat counter.
  async book(userId: string, scheduleId: string) {
    const schedule = await this.prisma.classSchedule.findUnique({
      where: { id: scheduleId },
    });
    if (!schedule) {
      throw new NotFoundException('Заняття не знайдено');
    }
    if (schedule.status !== 'scheduled') {
      throw new ConflictException('Заняття скасовано');
    }

    let booking: ClassBooking;
    try {
      booking = await this.prisma.$transaction(async (tx) => {
        const claimed = await this.claimBookingRow(tx, scheduleId, userId);

        const reserved = await tx.classSchedule.updateMany({
          where: {
            id: scheduleId,
            status: 'scheduled',
            bookedCount: { lt: schedule.capacity },
          },
          data: { bookedCount: { increment: 1 } },
        });

        if (reserved.count === 0) {
          throw new ConflictException('Вільних місць більше немає');
        }

        return claimed;
      });
    } catch (error) {
      // The one race claimBookingRow cannot resolve without a second
      // round trip: two concurrent *first-time* bookings for the same
      // (schedule, user) pair, where neither call sees the other's row
      // before both attempt to create it. Postgres lets one INSERT
      // through and raises a real unique violation for the other — which
      // is functionally the same outcome as "you already booked this",
      // just discovered a statement later.
      if (isUniqueViolationOn(error, 'ClassBooking_scheduleId_userId_key')) {
        throw new ConflictException('Ви вже записані на це заняття');
      }
      throw error;
    }

    await this.notifications.notify({
      userId,
      type: 'class_booked',
      title: 'Запис підтверджено',
      body: `${schedule.title} · ${formatWhen(schedule.startsAt)}`,
      payload: { scheduleId },
    });

    return booking;
  }

  // Exactly-once claim of a CONFIRMED row for (scheduleId, userId),
  // without ever letting two concurrent calls both believe they made a
  // fresh booking:
  //  1. Try to flip an existing non-confirmed row (i.e. a prior
  //     cancellation) to confirmed. `updateMany`'s count tells us,
  //     atomically, whether THIS call made that transition — a second,
  //     racing call sees count 0 because the first already moved the row
  //     out of "not confirmed".
  //  2. If no row existed to flip, read it: an already-confirmed row
  //     means someone (possibly this same person, moments ago) already
  //     holds the seat — refuse.
  //  3. Otherwise this is a genuinely first-time booking — create it.
  //     The one remaining race (two concurrent first-time creates) is
  //     handled by `book`'s catch block, since Postgres's own unique
  //     index is the only thing that can arbitrate two `create` calls
  //     that both, correctly, saw no row to read yet.
  private async claimBookingRow(tx: Tx, scheduleId: string, userId: string) {
    const reactivated = await tx.classBooking.updateMany({
      where: { scheduleId, userId, status: { not: 'confirmed' } },
      data: { status: 'confirmed' },
    });

    if (reactivated.count === 1) {
      return tx.classBooking.findUniqueOrThrow({
        where: { scheduleId_userId: { scheduleId, userId } },
      });
    }

    const existing = await tx.classBooking.findUnique({
      where: { scheduleId_userId: { scheduleId, userId } },
    });
    if (existing) {
      throw new ConflictException('Ви вже записані на це заняття');
    }

    return tx.classBooking.create({
      data: { scheduleId, userId, status: 'confirmed' },
    });
  }

  async cancel(userId: string, scheduleId: string) {
    const booking = await this.prisma.classBooking.findUnique({
      where: { scheduleId_userId: { scheduleId, userId } },
    });
    if (!booking || booking.status !== 'confirmed') {
      throw new NotFoundException('У вас немає активного запису на це заняття');
    }

    await this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.classBooking.updateMany({
        where: { scheduleId, userId, status: 'confirmed' },
        data: { status: 'cancelled' },
      });

      if (cancelled.count === 0) {
        throw new NotFoundException(
          'У вас немає активного запису на це заняття',
        );
      }

      // Only ever decrements a seat that this same transaction just
      // confirmed was actually held — guards against a double-cancel
      // (e.g. two tabs) taking the counter below zero.
      await tx.classSchedule.updateMany({
        where: { id: scheduleId, bookedCount: { gt: 0 } },
        data: { bookedCount: { decrement: 1 } },
      });
    });

    return { cancelled: true };
  }

  // --- admin -------------------------------------------------------------

  adminList() {
    return this.prisma.classSchedule.findMany({
      orderBy: { startsAt: 'desc' },
      include: { _count: { select: { bookings: true } } },
    });
  }

  create(dto: CreateClassScheduleDto) {
    return this.prisma.classSchedule.create({
      data: {
        title: dto.title,
        description: dto.description,
        direction: dto.direction,
        startsAt: new Date(dto.startsAt),
        capacity: dto.capacity,
      },
    });
  }

  // Cancelling a slot (instructor unavailable, etc.) notifies everyone
  // holding a confirmed seat — the same courtesy Referrals/Seller
  // notifications already extend elsewhere in this codebase.
  async cancelSchedule(scheduleId: string) {
    const schedule = await this.prisma.classSchedule.findUnique({
      where: { id: scheduleId },
      include: { bookings: { where: { status: 'confirmed' } } },
    });
    if (!schedule) {
      throw new NotFoundException('Заняття не знайдено');
    }
    if (schedule.status === 'cancelled') {
      throw new ForbiddenException('Заняття вже скасовано');
    }

    const updated = await this.prisma.classSchedule.update({
      where: { id: scheduleId },
      data: { status: 'cancelled' },
    });

    await Promise.all(
      schedule.bookings.map((booking) =>
        this.notifications.notify({
          userId: booking.userId,
          type: 'class_cancelled',
          title: 'Заняття скасовано',
          body: `${schedule.title} · ${formatWhen(schedule.startsAt)}`,
          payload: { scheduleId },
        }),
      ),
    );

    return updated;
  }
}

function formatWhen(date: Date): string {
  return date.toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isUniqueViolationOn(
  error: unknown,
  constraintOrField: string,
): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    JSON.stringify(error.meta ?? {}).includes(constraintOrField)
  );
}
