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
import { PermissionsGuard } from '../admin/auth/guards/permissions.guard';
import { Permissions } from '../admin/auth/decorators/permissions.decorator';
import {
  CurrentUser,
  type JwtRequestUser,
} from '../admin/common/decorators/current-user.decorator';
import { ParseAnyUuidPipe } from '../admin/common/pipes/parse-any-uuid.pipe';
import { UserType } from '../admin/users/enums/user-types.enum';

@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(
  UserType.SUPER_ADMIN,
  UserType.CAO,
  UserType.ZONAL_COMMISSIONER,
  UserType.ENGINEER,
)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
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
  unreadCount(@CurrentUser() user: JwtRequestUser) {
    return this.notificationsService.unreadCount(user.sub);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: JwtRequestUser) {
    return this.notificationsService.markAllRead(user.sub);
  }

  @Patch(':id/read')
  markRead(
    @Param('id', ParseAnyUuidPipe) id: string,
    @CurrentUser() user: JwtRequestUser,
  ) {
    return this.notificationsService.markRead(id, user.sub);
  }
}
