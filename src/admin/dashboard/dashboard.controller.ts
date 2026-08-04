import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UserType } from '../users/enums/user-types.enum';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(
  UserType.SUPER_ADMIN,
  UserType.CAO,
  UserType.ZONAL_COMMISSIONER,
  UserType.ENGINEER,
)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getStats() {
    return this.dashboardService.getOverviewStats();
  }
}
