import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard, type AuthUser } from '../auth/firebase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ReviewsService } from './reviews.service';
import { UpsertReviewDto } from './reviews.dto';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get(':listingId')
  list(@Param('listingId') listingId: string) {
    return this.reviews.listForListing(listingId);
  }

  @Get(':listingId/mine')
  @UseGuards(FirebaseAuthGuard)
  mine(@CurrentUser() user: AuthUser, @Param('listingId') listingId: string) {
    return this.reviews.myReview(user.id, listingId);
  }

  @Put(':listingId')
  @UseGuards(FirebaseAuthGuard)
  upsert(
    @CurrentUser() user: AuthUser,
    @Param('listingId') listingId: string,
    @Body() dto: UpsertReviewDto,
  ) {
    return this.reviews.upsert(user.id, listingId, dto);
  }

  @Delete(':listingId')
  @UseGuards(FirebaseAuthGuard)
  remove(@CurrentUser() user: AuthUser, @Param('listingId') listingId: string) {
    return this.reviews.remove(user.id, listingId);
  }
}
