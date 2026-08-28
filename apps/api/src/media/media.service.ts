import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { AuthUser } from '../auth/firebase-auth.guard';

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // The single gate every download goes through. Covers are public; the
  // paid payload is not, and the check is the same one no matter which
  // page linked to the file — library, course page, seller cabinet or a
  // bare URL someone pasted into a chat.
  async openForDownload(mediaId: string, user?: AuthUser) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: mediaId },
      include: { listing: { include: { seller: true } } },
    });

    if (!asset) {
      throw new NotFoundException('Файл не знайдено');
    }

    if (asset.access === 'entitled') {
      await this.assertEntitled(asset, user);
    }

    const stream = this.storage.read(asset.storageKey);

    // Counted after the stream opens, so a 404 from missing bytes does not
    // inflate the number. Fire-and-forget: a failed counter update must
    // never fail the download itself.
    void this.prisma.mediaAsset
      .update({
        where: { id: asset.id },
        data: { downloadCount: { increment: 1 } },
      })
      .catch(() => undefined);

    return { asset, stream };
  }

  private async assertEntitled(
    asset: {
      id: string;
      listingId: string | null;
      uploaderId: string;
      listing: { seller: { userId: string } } | null;
    },
    user?: AuthUser,
  ) {
    if (!user) {
      throw new UnauthorizedException(
        'Цей файл доступний лише після купівлі — увійдіть у свій акаунт',
      );
    }

    if (user.role === 'admin') return;
    if (asset.uploaderId === user.id) return;
    if (asset.listing?.seller.userId === user.id) return;

    if (!asset.listingId) {
      throw new ForbiddenException('Файл не привʼязаний до лістингу');
    }

    const entitlement = await this.prisma.entitlement.findUnique({
      where: {
        userId_listingId: { userId: user.id, listingId: asset.listingId },
      },
    });

    if (!entitlement) {
      throw new ForbiddenException(
        'Немає доступу: цей матеріал відкривається після оплати замовлення',
      );
    }
  }
}
