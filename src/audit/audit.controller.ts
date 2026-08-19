import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../admin/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../admin/auth/guards/permissions.guard';
import { Permissions } from '../admin/auth/decorators/permissions.decorator';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Permissions('USER:VIEW', 'DASHBOARD:VIEW')
  async getAuditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('actionType') actionType?: string,
  ) {
    return this.auditService.findAuditLogs({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      search,
      actionType,
    });
  }

  @Get('recent')
  @Permissions('USER:VIEW', 'DASHBOARD:VIEW')
  async getRecentActivities(@Query('limit') limit?: string) {
    return this.auditService.getRecentActivities(limit ? Number(limit) : 10);
  }
}
