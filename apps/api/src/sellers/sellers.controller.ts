import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FirebaseAuthGuard, type AuthUser } from '../auth/firebase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { MAX_UPLOAD_BYTES, SellersService } from './sellers.service';
import { PayoutsService } from '../payouts/payouts.service';
import {
  ApplySellerDto,
  CreateListingDto,
  UpdateListingDto,
  UploadMediaDto,
} from './seller.dto';

@Controller('seller')
@UseGuards(FirebaseAuthGuard)
export class SellersController {
  constructor(
    private readonly sellers: SellersService,
    private readonly payouts: PayoutsService,
  ) {}

  @Post('apply')
  apply(@CurrentUser() user: AuthUser, @Body() dto: ApplySellerDto) {
    return this.sellers.apply(user.id, dto);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.sellers.me(user.id);
  }

  @Get('orders')
  orders(@CurrentUser() user: AuthUser) {
    return this.sellers.orders(user.id);
  }

  @Get('payouts')
  async myPayouts(@CurrentUser() user: AuthUser) {
    const profile = await this.sellers.requireApprovedProfile(user.id);
    return this.payouts.ledger(profile.id);
  }

  @Get('listings')
  listListings(@CurrentUser() user: AuthUser) {
    return this.sellers.listListings(user.id);
  }

  @Post('listings')
  createListing(@CurrentUser() user: AuthUser, @Body() dto: CreateListingDto) {
    return this.sellers.createListing(user.id, dto);
  }

  @Get('listings/:id')
  getListing(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sellers.getListing(user.id, id);
  }

  @Patch('listings/:id')
  updateListing(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.sellers.updateListing(user.id, id, dto);
  }

  @Delete('listings/:id')
  deleteListing(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sellers.deleteListing(user.id, id);
  }

  // "Опублікувати" in the cabinet: sends the listing to the moderation
  // queue. See SellersService.submitForReview.
  @Post('listings/:id/submit')
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sellers.submitForReview(user.id, id);
  }

  @Post('listings/:id/withdraw')
  withdraw(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sellers.withdraw(user.id, id);
  }

  @Post('listings/:id/archive')
  archive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sellers.archive(user.id, id);
  }

  // Multipart upload. The file is buffered in memory (multer's default)
  // and handed to StorageService as bytes — with a 50 MB ceiling enforced
  // by multer itself, so an oversized upload is rejected at the socket
  // instead of after the whole body has been read into the process.
  @Post('listings/:id/media')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  uploadMedia(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadMediaDto,
  ) {
    return this.sellers.uploadMedia(user.id, id, file, dto);
  }

  @Delete('media/:mediaId')
  deleteMedia(
    @CurrentUser() user: AuthUser,
    @Param('mediaId') mediaId: string,
  ) {
    return this.sellers.deleteMedia(user.id, mediaId);
  }
}
