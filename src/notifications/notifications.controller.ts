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
import {
  CurrentUser,
  type JwtRequestUser,
} from '../admin/common/decorators/current-user.decorator';
import { ParseAnyUuidPipe } from '../admin/common/pipes/parse-any-uuid.pipe';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
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
