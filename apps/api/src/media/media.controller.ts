import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { OptionalAuthGuard, type AuthUser } from '../auth/firebase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  // OptionalAuthGuard, not FirebaseAuthGuard: a cover image is fetched by
  // <img> tags that cannot attach a bearer token, while the paid payload
  // still requires one. MediaService decides which is which.
  @Get(':id/download')
  @UseGuards(OptionalAuthGuard)
  async download(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser | undefined,
    @Res() res: Response,
  ) {
    const { asset, stream } = await this.media.openForDownload(id, user);

    // Images render inline; everything else downloads. Both spellings of
    // the filename are sent because RFC 6266's filename* is the only one
    // that survives Cyrillic, and older clients read the plain one.
    const disposition = asset.mimeType.startsWith('image/')
      ? 'inline'
      : 'attachment';
    const asciiName = asset.filename.replace(/[^\x20-\x7e]/g, '_');

    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Content-Length', asset.sizeBytes);
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(asset.filename)}`,
    );
    // Public covers are immutable (a new upload gets a new id), so they
    // can be cached hard. Paid files must never sit in a shared cache.
    res.setHeader(
      'Cache-Control',
      asset.access === 'public'
        ? 'public, max-age=31536000, immutable'
        : 'private, no-store',
    );

    stream.pipe(res);
  }
}
