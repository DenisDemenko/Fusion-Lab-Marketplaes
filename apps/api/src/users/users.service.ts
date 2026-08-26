import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Called from FirebaseAuthGuard on every verified request. Cheap upsert:
  // Firebase already did the hard work of proving identity, this just
  // makes sure a domain-side row exists to hang role/seller data off of.
  syncFromFirebase(input: { firebaseUid: string; email: string }) {
    return this.prisma.user.upsert({
      where: { firebaseUid: input.firebaseUid },
      update: { email: input.email },
      create: { firebaseUid: input.firebaseUid, email: input.email },
    });
  }

  findByFirebaseUid(firebaseUid: string) {
    return this.prisma.user.findUnique({ where: { firebaseUid } });
  }
}
