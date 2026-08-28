import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Rows created by prisma/seed.ts have no Firebase account behind them yet,
// so they carry this prefix instead of a real UID.
const SEED_UID_PREFIX = 'seed:';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Called from FirebaseAuthGuard on every verified request. Cheap upsert:
  // Firebase already did the hard work of proving identity, this just
  // makes sure a domain-side row exists to hang role/seller data off of.
  //
  // Note what it does NOT touch: `role`. Roles are granted by the
  // marketplace (admin panel, seller approval) and must survive every
  // subsequent login — an upsert that wrote a default role here would
  // silently demote every admin on their next request.
  async syncFromFirebase(input: {
    firebaseUid: string;
    email: string;
    displayName?: string;
  }) {
    try {
      return await this.prisma.user.upsert({
        where: { firebaseUid: input.firebaseUid },
        update: { email: input.email, displayName: input.displayName },
        create: {
          firebaseUid: input.firebaseUid,
          email: input.email,
          displayName: input.displayName,
        },
      });
    } catch (error) {
      if (!isUniqueEmailViolation(error)) throw error;
      return this.claimSeededAccount(input);
    }
  }

  // The email is already taken by a row created before its owner ever
  // logged in — the seeded admin and lab-seller accounts. The first real
  // sign-in with that address claims the row, keeping its role and its
  // listings.
  //
  // Scoped strictly to `seed:` placeholders: adopting an arbitrary
  // existing account by email would let anyone able to register that
  // address in Firebase inherit someone else's marketplace identity.
  private async claimSeededAccount(input: {
    firebaseUid: string;
    email: string;
    displayName?: string;
  }) {
    const claimed = await this.prisma.user.updateMany({
      where: {
        email: input.email,
        firebaseUid: { startsWith: SEED_UID_PREFIX },
      },
      data: { firebaseUid: input.firebaseUid, displayName: input.displayName },
    });

    if (claimed.count === 0) {
      // A real, already-claimed account owns this email. Two Firebase UIDs
      // for one address is a genuine conflict, not something to paper over.
      throw new ConflictException(
        `Email ${input.email} вже належить іншому акаунту`,
      );
    }

    return this.prisma.user.findUniqueOrThrow({
      where: { firebaseUid: input.firebaseUid },
    });
  }

  findByFirebaseUid(firebaseUid: string) {
    return this.prisma.user.findUnique({ where: { firebaseUid } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { sellerProfile: true },
    });
  }

  setRole(id: string, role: UserRole) {
    return this.prisma.user.update({ where: { id }, data: { role } });
  }
}

function isUniqueEmailViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    JSON.stringify(error.meta ?? {}).includes('email')
  );
}
