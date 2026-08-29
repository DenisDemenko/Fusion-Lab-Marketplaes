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
  TeamStatus,
  UserRole,
} from '@prisma/client';
import { FirebaseAuthGuard, type AuthUser } from '../auth/firebase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import { PayoutsService } from '../payouts/payouts.service';
import {
  CreatePromoCodeDto,
  UpdatePromoCodeDto,
} from '../promo-codes/promo-codes.dto';
import { RecordPayoutDto } from '../payouts/payouts.dto';
import { ScheduleService } from '../schedule/schedule.service';
import { CreateClassScheduleDto } from '../schedule/schedule.dto';
import { TeamsService } from '../teams/teams.service';
import { AdminService } from './admin.service';

// Replaces the old static admin.html / admin-access.html pair. Guard order
// matters: FirebaseAuthGuard must run first to attach the user that
// RolesGuard then checks.
@Controller('admin')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly promoCodes: PromoCodesService,
    private readonly payouts: PayoutsService,
    private readonly schedule: ScheduleService,
    private readonly teams: TeamsService,
  ) {}

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

  @Get('users/:id/permissions')
  userPermissions(@Param('id') id: string) {
    return this.admin.userPermissions(id);
  }

  @Patch('users/:id/sales-approval')
  setSalesApproval(
    @Param('id') id: string,
    @Body() body: { approved: boolean },
  ) {
    return this.admin.setSalesApproval(id, body.approved);
  }

  @Patch('users/:id/permissions')
  setPermissionOverride(
    @Param('id') id: string,
    @Body() body: { permission: string; granted: boolean | null },
  ) {
    return this.admin.setPermissionOverride(id, body.permission, body.granted);
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

  @Get('promo-codes')
  listPromoCodes() {
    return this.promoCodes.list();
  }

  @Post('promo-codes')
  createPromoCode(@Body() dto: CreatePromoCodeDto) {
    return this.promoCodes.create(dto);
  }

  @Patch('promo-codes/:id')
  updatePromoCode(@Param('id') id: string, @Body() dto: UpdatePromoCodeDto) {
    return this.promoCodes.setActive(id, dto.active ?? true);
  }

  @Get('sellers/:id/payouts')
  sellerLedger(@Param('id') sellerId: string) {
    return this.payouts.ledger(sellerId);
  }

  @Post('sellers/:id/payouts')
  recordPayout(@Param('id') sellerId: string, @Body() dto: RecordPayoutDto) {
    return this.payouts.record(sellerId, dto);
  }

  @Get('schedule')
  listSchedule() {
    return this.schedule.adminList();
  }

  @Post('schedule')
  createSchedule(@Body() dto: CreateClassScheduleDto) {
    return this.schedule.create(dto);
  }

  @Post('schedule/:id/cancel')
  cancelSchedule(@Param('id') id: string) {
    return this.schedule.cancelSchedule(id);
  }

  @Get('teams')
  listTeams(@Query('status') status?: TeamStatus) {
    return this.teams.adminList(status);
  }

  @Post('teams/:id/approve')
  approveTeam(@Param('id') id: string) {
    return this.teams.approve(id);
  }

  @Post('teams/:id/reject')
  rejectTeam(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.teams.reject(id, body?.reason ?? '');
  }
}
