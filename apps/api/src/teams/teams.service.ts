import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Team, TeamMember, TeamStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { toMediaSummary } from '../catalog/listing.mapper';
import { teamInclude, toTeamCard, toTeamDetail } from './teams.mapper';
import { CreateTeamDto, UploadTeamMediaDto } from './teams.dto';

// Up to 5 people including the owner (docs/migration-plan.md Phase F1).
const MAX_TEAM_SIZE = 5;

export const MAX_TEAM_MEDIA_BYTES = 20 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'application/pdf',
  'model/stl',
  'application/sla',
  'application/octet-stream',
]);

// Real teams (docs/migration-plan.md Phase F1) — up to 5 people, admin
// moderation before publication, no "active team subscription" badge
// (that needs the subscription model from the skipped Phase E).
@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
  ) {}

  // --- public catalog ------------------------------------------------------

  async list(query: { direction?: string; q?: string }) {
    const teams = await this.prisma.team.findMany({
      where: {
        status: 'published',
        ...(query.direction ? { direction: query.direction } : {}),
        ...(query.q
          ? { name: { contains: query.q, mode: 'insensitive' as const } }
          : {}),
      },
      include: teamInclude,
      orderBy: { createdAt: 'desc' },
    });

    return teams.map(toTeamCard);
  }

  async getPublic(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: teamInclude,
    });

    if (!team || team.status !== 'published') {
      throw new NotFoundException('Команду не знайдено');
    }

    return toTeamDetail(team);
  }

  // --- mine ------------------------------------------------------------

  async mine(userId: string) {
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId, status: 'confirmed' },
      include: { team: { include: teamInclude } },
      orderBy: { team: { createdAt: 'desc' } },
    });

    // isOwner is only meaningful to the caller who already knows their own
    // userId — the public toTeamDetail() shape stays silent on which
    // member is which user.
    return memberships.map((membership) => ({
      ...toTeamDetail(membership.team),
      isOwner: membership.team.ownerId === userId,
    }));
  }

  async myInvites(userId: string) {
    const invites = await this.prisma.teamMember.findMany({
      where: { userId, status: 'invited' },
      include: { team: true },
      orderBy: { createdAt: 'desc' },
    });

    return invites.map((invite) => ({
      id: invite.id,
      createdAt: invite.createdAt,
      team: {
        id: invite.team.id,
        name: invite.team.name,
        direction: invite.team.direction,
        description: invite.team.description,
      },
    }));
  }

  // --- create / invite ----------------------------------------------------

  async create(userId: string, dto: CreateTeamDto) {
    let team: Team;
    try {
      team = await this.prisma.team.create({
        data: {
          name: dto.name,
          direction: dto.direction,
          description: dto.description,
          ownerId: userId,
          members: {
            create: {
              userId,
              role: 'owner',
              status: 'confirmed',
              respondedAt: new Date(),
            },
          },
        },
      });
    } catch (error) {
      if (isUniqueViolationOn(error, 'Team_name_key')) {
        throw new ConflictException('Команда з такою назвою вже існує');
      }
      throw error;
    }

    await this.notifications.notifyAdmins({
      type: 'team_submitted',
      title: 'Нова команда на модерацію',
      body: team.name,
      payload: { teamId: team.id },
    });

    // A bad individual invite (unknown email, cap already hit) must not
    // undo a team that was otherwise created fine — the owner can retry
    // that one invite from the team page. This loop is sequential, not
    // concurrent, so it never races itself for the capacity guard below.
    for (const email of dto.memberEmails ?? []) {
      try {
        await this.invite(userId, team.id, email);
      } catch {
        // swallowed by design, see comment above
      }
    }

    return this.getOwned(team.id);
  }

  async invite(userId: string, teamId: string, email: string) {
    const team = await this.ownedTeam(userId, teamId);

    const invitee = await this.prisma.user.findUnique({ where: { email } });
    if (!invitee) {
      throw new NotFoundException(
        'Користувача з такою поштою не знайдено — має бути зареєстрований акаунт',
      );
    }
    if (invitee.id === userId) {
      throw new BadRequestException('Ви вже в команді як власник');
    }

    let member: TeamMember;
    try {
      member = await this.prisma.$transaction(async (tx) => {
        // create() first, not an upsert: a duplicate invite for this exact
        // (team, user) pair — already invited, confirmed, or declined —
        // must fail here, before the capacity guard below ever runs, or a
        // repeated invite click would reserve a second seat for someone
        // who already holds one.
        const created = await tx.teamMember.create({
          data: {
            teamId,
            userId: invitee.id,
            role: 'member',
            status: 'invited',
          },
        });

        const reserved = await tx.team.updateMany({
          where: { id: teamId, memberCount: { lt: MAX_TEAM_SIZE } },
          data: { memberCount: { increment: 1 } },
        });

        if (reserved.count === 0) {
          throw new ConflictException(
            `У команді вже немає вільних місць (максимум ${MAX_TEAM_SIZE})`,
          );
        }

        return created;
      });
    } catch (error) {
      if (isUniqueViolationOn(error, 'TeamMember_teamId_userId_key')) {
        throw new ConflictException(
          'Цього користувача вже запрошено або він у команді',
        );
      }
      throw error;
    }

    await this.notifications.notify({
      userId: invitee.id,
      type: 'team_invited',
      title: 'Запрошення до команди',
      body: `Вас запрошують до команди «${team.name}»`,
      payload: { teamId, memberId: member.id },
    });

    return member;
  }

  async respondInvite(userId: string, memberId: string, accept: boolean) {
    const invite = await this.prisma.teamMember.findUnique({
      where: { id: memberId },
    });
    if (!invite || invite.userId !== userId) {
      throw new NotFoundException('Запрошення не знайдено');
    }

    if (accept) {
      const updated = await this.prisma.teamMember.updateMany({
        where: { id: memberId, status: 'invited' },
        data: { status: 'confirmed', respondedAt: new Date() },
      });
      if (updated.count === 0) {
        throw new ConflictException('Це запрошення вже опрацьовано');
      }
      return { accepted: true };
    }

    await this.prisma.$transaction(async (tx) => {
      const declined = await tx.teamMember.updateMany({
        where: { id: memberId, status: 'invited' },
        data: { status: 'declined', respondedAt: new Date() },
      });
      if (declined.count === 0) {
        throw new ConflictException('Це запрошення вже опрацьовано');
      }

      // The seat was reserved at invite time, so declining has to free it
      // — same guarded-decrement shape as ScheduleService.cancel.
      await tx.team.updateMany({
        where: { id: invite.teamId, memberCount: { gt: 0 } },
        data: { memberCount: { decrement: 1 } },
      });
    });

    return { accepted: false };
  }

  // --- media ---------------------------------------------------------------

  async uploadMedia(
    userId: string,
    teamId: string,
    file: Express.Multer.File | undefined,
    dto: UploadTeamMediaDto,
  ) {
    const team = await this.ownedTeam(userId, teamId);

    if (!file) {
      throw new BadRequestException('Файл не надіслано (поле "file")');
    }
    if (file.size > MAX_TEAM_MEDIA_BYTES) {
      throw new BadRequestException(
        `Файл завеликий: ${file.size} байт, максимум ${MAX_TEAM_MEDIA_BYTES}`,
      );
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        `Тип файлу не підтримується: ${file.mimetype}`,
      );
    }

    const { storageKey, sizeBytes } = await this.storage.save(
      `teams/${team.id}`,
      file.originalname,
      file.buffer,
    );

    // One photo per team, same replace-on-upload rule as a listing cover.
    if (dto.kind === 'cover') {
      const previous = await this.prisma.mediaAsset.findMany({
        where: { teamId: team.id, kind: 'cover' },
      });
      for (const asset of previous) {
        await this.storage.remove(asset.storageKey);
      }
      if (previous.length > 0) {
        await this.prisma.mediaAsset.deleteMany({
          where: { id: { in: previous.map((asset) => asset.id) } },
        });
      }
    }

    // Always public: team photo/results are marketing/showcase content
    // gated by Team.status at the catalog query, not per-file entitlement
    // — there is no purchase involved.
    const asset = await this.prisma.mediaAsset.create({
      data: {
        teamId: team.id,
        uploaderId: userId,
        kind: dto.kind,
        access: 'public',
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes,
        storageKey,
      },
    });

    return toMediaSummary(asset);
  }

  async deleteMedia(userId: string, mediaId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: mediaId },
      include: { team: true },
    });
    if (!asset || !asset.team) {
      throw new NotFoundException('Файл не знайдено');
    }

    const actor = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (asset.team.ownerId !== userId && actor.role !== 'admin') {
      throw new ForbiddenException('Немає доступу до цього файлу');
    }

    await this.storage.remove(asset.storageKey);
    await this.prisma.mediaAsset.delete({ where: { id: mediaId } });
    return { deleted: true };
  }

  // --- admin ---------------------------------------------------------------

  async adminList(status?: TeamStatus) {
    const teams = await this.prisma.team.findMany({
      where: status ? { status } : undefined,
      include: teamInclude,
      orderBy: { createdAt: 'desc' },
    });
    return teams.map(toTeamDetail);
  }

  async approve(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { members: { where: { status: 'confirmed' } } },
    });
    if (!team) {
      throw new NotFoundException('Команду не знайдено');
    }

    const updated = await this.prisma.team.update({
      where: { id: teamId },
      data: { status: 'published', rejectionReason: null },
    });

    await Promise.all(
      team.members.map((member) =>
        this.notifications.notify({
          userId: member.userId,
          type: 'team_published',
          title: 'Команду опубліковано',
          body: team.name,
          payload: { teamId },
        }),
      ),
    );

    return updated;
  }

  async reject(teamId: string, reason: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Команду не знайдено');
    }

    const updated = await this.prisma.team.update({
      where: { id: teamId },
      data: { status: 'rejected', rejectionReason: reason || null },
    });

    await this.notifications.notify({
      userId: team.ownerId,
      type: 'team_rejected',
      title: 'Команду відхилено',
      body: reason || team.name,
      payload: { teamId },
    });

    return updated;
  }

  // --- helpers ---------------------------------------------------------

  private async ownedTeam(userId: string, teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Команду не знайдено');
    }
    if (team.ownerId !== userId) {
      throw new ForbiddenException('Лише власник команди може це робити');
    }
    return team;
  }

  private async getOwned(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: teamInclude,
    });
    if (!team) {
      throw new NotFoundException('Команду не знайдено');
    }
    return toTeamDetail(team);
  }
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
