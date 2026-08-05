import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../admin/auth/guards/jwt-auth.guard';
import { Permissions } from '../admin/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../admin/auth/guards/permissions.guard';
import {
  CurrentUser,
  type JwtRequestUser,
} from '../admin/common/decorators/current-user.decorator';
import { ParseAnyUuidPipe } from '../admin/common/pipes/parse-any-uuid.pipe';

@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Permissions('NOTIFICATION:VIEW')
  list(
    @CurrentUser() user: JwtRequestUser,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Number(limit) : 50;
    return this.notificationsService.listMine(
      user.sub,
      Number.isFinite(n) ? n : 50,
    );
  }

  @Get('unread-count')
  @Permissions('NOTIFICATION:VIEW')
  unreadCount(@CurrentUser() user: JwtRequestUser) {
    return this.notificationsService.unreadCount(user.sub);
  }

  @Patch('read-all')
  @Permissions('NOTIFICATION:UPDATE')
  markAllRead(@CurrentUser() user: JwtRequestUser) {
    return this.notificationsService.markAllRead(user.sub);
  }

  @Patch(':id/read')
  @Permissions('NOTIFICATION:UPDATE')
  markRead(
    @Param('id', ParseAnyUuidPipe) id: string,
    @CurrentUser() user: JwtRequestUser,
  ) {
    return this.notificationsService.markRead(id, user.sub);
  }
}
