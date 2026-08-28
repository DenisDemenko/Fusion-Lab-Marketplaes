import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ListingStatus,
  OrderStatus,
  SellerStatus,
  UserRole,
} from '@prisma/client';
import { FirebaseAuthGuard, type AuthUser } from '../auth/firebase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminService } from './admin.service';

// Replaces the old static admin.html / admin-access.html pair. Guard order
// matters: FirebaseAuthGuard must run first to attach the user that
// RolesGuard then checks.
@Controller('admin')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @Get('listings')
  listings(@Query('status') status?: ListingStatus) {
    return this.admin.listings(status);
  }

  @Post('listings/:id/approve')
  approveListing(@Param('id') id: string) {
    return this.admin.approveListing(id);
  }

  @Post('listings/:id/reject')
  rejectListing(@Param('id') id: string, @Body() body: { reason: string }) {
    return this.admin.rejectListing(id, body?.reason ?? '');
  }

  @Get('sellers')
  sellers(@Query('status') status?: SellerStatus) {
    return this.admin.sellers(status);
  }

  @Post('sellers/:id/approve')
  approveSeller(@Param('id') id: string) {
    return this.admin.approveSeller(id);
  }

  @Post('sellers/:id/reject')
  rejectSeller(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.admin.rejectSeller(id, body?.reason);
  }

  @Get('users')
  users(@Query('q') q?: string) {
    return this.admin.users(q);
  }

  @Patch('users/:id/role')
  setRole(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() body: { role: UserRole },
  ) {
    return this.admin.setRole(id, body.role, actor.id);
  }

  @Get('orders')
  orders(@Query('status') status?: OrderStatus) {
    return this.admin.orders(status);
  }

  @Get('categories')
  categories() {
    return this.admin.categories();
  }

  @Post('categories')
  createCategory(@Body() body: { name: string; slug?: string }) {
    return this.admin.createCategory(body.name, body.slug);
  }

  @Delete('categories/:slug')
  deleteCategory(@Param('slug') slug: string) {
    return this.admin.deleteCategory(slug);
  }
}
