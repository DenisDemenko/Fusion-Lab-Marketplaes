import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard, type AuthUser } from '../auth/firebase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CartService } from './cart.service';
import { AddCartItemDto, SetQuantityDto } from './cart.dto';

// The cart lives server-side, keyed by user. A localStorage cart would be
// simpler, but it cannot survive a device change and cannot be checked
// against stock or an existing entitlement before checkout.
@Controller('cart')
@UseGuards(FirebaseAuthGuard)
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.cart.get(user.id);
  }

  @Post('items')
  add(@CurrentUser() user: AuthUser, @Body() dto: AddCartItemDto) {
    return this.cart.addItem(user.id, dto.listingId, dto.quantity ?? 1);
  }

  @Patch('items/:listingId')
  setQuantity(
    @CurrentUser() user: AuthUser,
    @Param('listingId') listingId: string,
    @Body() dto: SetQuantityDto,
  ) {
    return this.cart.setQuantity(user.id, listingId, dto.quantity);
  }

  @Delete('items/:listingId')
  remove(@CurrentUser() user: AuthUser, @Param('listingId') listingId: string) {
    return this.cart.removeItem(user.id, listingId);
  }

  @Delete()
  clear(@CurrentUser() user: AuthUser) {
    return this.cart.clear(user.id);
  }
}
