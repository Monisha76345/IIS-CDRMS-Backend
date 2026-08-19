import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser, type JwtRequestUser } from '../common/decorators/current-user.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) { }

  @Get()
  @Permissions('DASHBOARD:VIEW')
  async getStats(
    @CurrentUser() user: JwtRequestUser,
    @Query('zone') zone?: string,
    @Query('as') asRole?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.dashboardService.getOverviewStats(user, zone, asRole, status, search);
  }
}
