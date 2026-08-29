import { Prisma } from '@prisma/client';
import { toMediaSummary } from '../catalog/listing.mapper';

export const teamInclude = {
  members: {
    include: { user: { select: { displayName: true, email: true } } },
  },
  media: true,
} satisfies Prisma.TeamInclude;

type TeamWithRelations = Prisma.TeamGetPayload<{ include: typeof teamInclude }>;

// One shape for every reader (public catalog, "my teams", admin). Status
// and rejectionReason are harmless to include on the public response — a
// visitor only ever gets here through getPublic(), which already refuses
// anything but a published team.
export function toTeamDetail(team: TeamWithRelations) {
  const media = team.media ?? [];
  const photo = media.find((asset) => asset.kind === 'cover');

  return {
    id: team.id,
    name: team.name,
    direction: team.direction,
    description: team.description,
    status: team.status,
    rejectionReason: team.rejectionReason,
    memberCount: team.memberCount,
    createdAt: team.createdAt,
    photoUrl: photo ? `/media/${photo.id}/download` : null,
    members: team.members
      .filter((member) => member.status === 'confirmed')
      .map((member) => ({
        id: member.id,
        role: member.role,
        displayName: member.user.displayName || member.user.email.split('@')[0],
      })),
    results: media
      .filter((asset) => asset.kind !== 'cover')
      .map(toMediaSummary),
  };
}

export function toTeamCard(team: TeamWithRelations) {
  const detail = toTeamDetail(team);
  return {
    id: detail.id,
    name: detail.name,
    direction: detail.direction,
    description: detail.description,
    memberCount: detail.memberCount,
    createdAt: detail.createdAt,
    photoUrl: detail.photoUrl,
  };
}
