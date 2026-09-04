import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  BridgeService,
  BRIDGE_MAX_FILE_BYTES,
  type BridgeFileKind,
} from './bridge.service';
import { PublishBookDto } from './bridge.dto';

// Called by Book_Creality, never by a browser: authentication is a shared
// secret header, not a Firebase token. See ADR 0001.
@Controller('bridge')
export class BridgeController {
  constructor(private readonly bridge: BridgeService) {}

  @Get('books')
  listBooks(@Headers('x-bridge-key') key: string | undefined) {
    this.bridge.assertBridgeKey(key);
    return this.bridge.listBooks();
  }

  @Post('books')
  publishBook(
    @Headers('x-bridge-key') key: string | undefined,
    @Body() dto: PublishBookDto,
  ) {
    this.bridge.assertBridgeKey(key);
    return this.bridge.publishBook(dto);
  }

  // Multipart, like the seller upload it mirrors: the ceiling is enforced
  // by multer at the socket, so an oversized file is refused before the
  // process has read it whole.
  @Post('books/:externalId/file')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: BRIDGE_MAX_FILE_BYTES } }),
  )
  attachBookFile(
    @Headers('x-bridge-key') key: string | undefined,
    @Param('externalId') externalId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { kind?: string },
  ) {
    this.bridge.assertBridgeKey(key);
    // multipart: `kind` приходить звичайним полем форми поруч із файлом.
    // Невідомий вид трактуємо як 'attachment', а не як помилку: міст і
    // приймач розвиваються нарізно, і новий вид з боку Студії не має
    // валити публікацію — він просто ляже файлом для покупця.
    const kind: BridgeFileKind =
      body?.kind === 'cover' ? 'cover' : body?.kind === 'sample' ? 'sample' : 'attachment';
    return this.bridge.attachBookFile(externalId, file, kind);
  }

  @Delete('books/:externalId')
  unpublishBook(
    @Headers('x-bridge-key') key: string | undefined,
    @Param('externalId') externalId: string,
  ) {
    this.bridge.assertBridgeKey(key);
    return this.bridge.unpublishBook(externalId);
  }
}
