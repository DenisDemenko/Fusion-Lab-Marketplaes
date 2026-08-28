import { Body, Controller, Delete, Headers, Param, Post } from '@nestjs/common';
import { BridgeService } from './bridge.service';
import { PublishBookDto } from './bridge.dto';

// Called by Book_Creality, never by a browser: authentication is a shared
// secret header, not a Firebase token. See ADR 0001.
@Controller('bridge')
export class BridgeController {
  constructor(private readonly bridge: BridgeService) {}

  @Post('books')
  publishBook(
    @Headers('x-bridge-key') key: string | undefined,
    @Body() dto: PublishBookDto,
  ) {
    this.bridge.assertBridgeKey(key);
    return this.bridge.publishBook(dto);
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
