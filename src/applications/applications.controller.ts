import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { EngineerSubmitApplicationDto } from './dto/engineer-submit.dto';
import { EngineerDraftApplicationDto } from './dto/engineer-draft.dto';
import { JwtAuthGuard } from '../admin/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../admin/auth/guards/permissions.guard';
import { Permissions } from '../admin/auth/decorators/permissions.decorator';
import {
  CurrentUser,
  type JwtRequestUser,
} from '../admin/common/decorators/current-user.decorator';
import { ParseAnyUuidPipe } from '../admin/common/pipes/parse-any-uuid.pipe';
import { UserType } from '../admin/users/enums/user-types.enum';

@Controller('applications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  /** Assigned zone for the logged-in officer (ZC / Engineer / CAO post mapping). */
  @Get('meta/my-zone')
  @Permissions(
    UserType.ZONAL_COMMISSIONER,
    UserType.ENGINEER,
    UserType.CAO,
    UserType.SUPER_ADMIN,
  )
  myZone(
    @CurrentUser() user: JwtRequestUser,
    @Query('zoneId') zoneId?: string,
  ) {
    const parsed =
      zoneId != null && String(zoneId).trim() !== ''
        ? Number(zoneId)
        : undefined;
    return this.applicationsService.myZoneContext(
      user.sub,
      Number.isFinite(parsed) ? parsed : undefined,
    );
  }

  @Get('meta/cao-counts')
  @Permissions(UserType.CAO, UserType.SUPER_ADMIN)
  caoCounts(@CurrentUser() user: JwtRequestUser) {
    return this.applicationsService.caoCounts(user.sub);
  }

  @Get('meta/task-counts')
  @Permissions(UserType.ENGINEER, UserType.CAO, UserType.SUPER_ADMIN)
  taskCounts(
    @CurrentUser() user: JwtRequestUser,
    @Query('as') asRole?: 'engineer' | 'cao',
  ) {
    const role = normalizeRole(user);
    const as =
      asRole === 'engineer' || asRole === 'cao'
        ? asRole
        : role.includes('cao')
          ? 'cao'
          : 'engineer';
    return this.applicationsService.taskCounts(user.sub, as);
  }

  @Get('engineers')
  @Permissions(UserType.ZONAL_COMMISSIONER, UserType.SUPER_ADMIN)
  engineersByZone(@Query('zoneId') zoneId: string) {
    return this.applicationsService.findEngineersByZone(Number(zoneId));
  }

  @Get()
  @Permissions(
    UserType.ZONAL_COMMISSIONER,
    UserType.ENGINEER,
    UserType.CAO,
    UserType.SUPER_ADMIN,
  )
  list(
    @CurrentUser() user: JwtRequestUser,
    @Query('as') asRole?: 'zc' | 'engineer' | 'cao',
    @Query('queue') queue?: 'open' | 'all',
  ) {
    const role = normalizeRole(user);
    let as: 'zc' | 'engineer' | 'cao' = 'zc';
    if (asRole === 'engineer' || asRole === 'cao' || asRole === 'zc') {
      as = asRole;
    } else if (role.includes('engineer')) {
      as = 'engineer';
    } else if (role.includes('cao')) {
      as = 'cao';
    }
    return this.applicationsService.listMine(
      user.sub,
      as,
      queue === 'open' ? 'open' : 'all',
    );
  }

  @Get(':id')
  @Permissions(
    UserType.ZONAL_COMMISSIONER,
    UserType.ENGINEER,
    UserType.CAO,
    UserType.SUPER_ADMIN,
  )
  findOne(
    @Param('id', ParseAnyUuidPipe) id: string,
    @CurrentUser() user: JwtRequestUser,
  ) {
    return this.applicationsService.findOneAuthorized(
      id,
      user.sub,
      user.userType || user.role,
    );
  }

  @Post()
  @Permissions(UserType.ZONAL_COMMISSIONER, UserType.SUPER_ADMIN)
  create(
    @CurrentUser() user: JwtRequestUser,
    @Body() dto: CreateApplicationDto,
  ) {
    return this.applicationsService.create(user.sub, dto);
  }

  @Patch(':id/start')
  @Permissions(UserType.ENGINEER, UserType.SUPER_ADMIN)
  start(
    @Param('id', ParseAnyUuidPipe) id: string,
    @CurrentUser() user: JwtRequestUser,
  ) {
    return this.applicationsService.startTask(id, user.sub);
  }

  /** Save partial engineer capture (each step / schedule edit) without CAO submit. */
  @Patch(':id/draft')
  @Permissions(UserType.ENGINEER, UserType.SUPER_ADMIN)
  saveDraft(
    @Param('id', ParseAnyUuidPipe) id: string,
    @CurrentUser() user: JwtRequestUser,
    @Body() dto: EngineerDraftApplicationDto,
  ) {
    return this.applicationsService.saveEngineerDraft(id, user.sub, dto);
  }

  @Post(':id/submit')
  @Permissions(UserType.ENGINEER, UserType.SUPER_ADMIN)
  submit(
    @Param('id', ParseAnyUuidPipe) id: string,
    @CurrentUser() user: JwtRequestUser,
    @Body() dto: EngineerSubmitApplicationDto,
  ) {
    return this.applicationsService.submitEngineer(id, user.sub, dto);
  }
}

function normalizeRole(user: JwtRequestUser): string {
  return String(user.role || user.userType || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
}
