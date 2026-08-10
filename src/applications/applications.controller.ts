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
import { UpdateZcApplicationDto } from './dto/update-zc-application.dto';
import { EngineerSubmitApplicationDto } from './dto/engineer-submit.dto';
import { EngineerDraftApplicationDto } from './dto/engineer-draft.dto';
import { JwtAuthGuard } from '../admin/auth/guards/jwt-auth.guard';
import { Permissions } from '../admin/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../admin/auth/guards/permissions.guard';
import {
  CurrentUser,
  type JwtRequestUser,
} from '../admin/common/decorators/current-user.decorator';
import { ParseAnyUuidPipe } from '../admin/common/pipes/parse-any-uuid.pipe';

@Controller('applications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  /** Assigned zone for the logged-in officer (ZC / Engineer / CAO post mapping). */
  @Get('meta/my-zone')
  @Permissions('APPLICATION:VIEW')
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

  /** Site dimension dropdown — ZC create application (APPLICATION:ADD, not MASTER:ADD). */
  @Post('meta/site-dimensions')
  @Permissions('APPLICATION:ADD')
  createSiteDimension(@Body('label') label: string) {
    return this.applicationsService.createSiteDimension(String(label ?? ''));
  }

  @Get('meta/cao-counts')
  @Permissions('APPLICATION:VIEW')
  caoCounts(@CurrentUser() user: JwtRequestUser) {
    return this.applicationsService.caoCounts(user.sub);
  }

  @Get('meta/task-counts')
  @Permissions('APPLICATION:VIEW')
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
  @Permissions('APPLICATION:VIEW')
  engineersByZone(@Query('zoneId') zoneId: string) {
    return this.applicationsService.findEngineersByZone(Number(zoneId));
  }

  @Get()
  @Permissions('APPLICATION:VIEW')
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
  @Permissions('APPLICATION:VIEW')
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
  @Permissions('APPLICATION:ADD')
  create(
    @CurrentUser() user: JwtRequestUser,
    @Body() dto: CreateApplicationDto,
  ) {
    return this.applicationsService.create(user.sub, dto);
  }

  /** Update a ZC draft application (draft status only). */
  @Patch(':id/zc')
  @Permissions('APPLICATION:UPDATE')
  updateZcDraft(
    @Param('id', ParseAnyUuidPipe) id: string,
    @CurrentUser() user: JwtRequestUser,
    @Body() dto: UpdateZcApplicationDto,
  ) {
    return this.applicationsService.updateZcDraft(user.sub, id, dto);
  }

  /** Submit a ZC draft to the assigned engineer (draft → assigned). */
  @Post(':id/zc-submit')
  @Permissions('APPLICATION:UPDATE')
  submitZcDraft(
    @Param('id', ParseAnyUuidPipe) id: string,
    @CurrentUser() user: JwtRequestUser,
    @Body() dto: UpdateZcApplicationDto,
  ) {
    return this.applicationsService.submitZcDraft(user.sub, id, dto);
  }

  @Patch(':id/start')
  @Permissions('APPLICATION:UPDATE')
  start(
    @Param('id', ParseAnyUuidPipe) id: string,
    @CurrentUser() user: JwtRequestUser,
  ) {
    return this.applicationsService.startTask(id, user.sub);
  }

  /** Save partial engineer capture (each step / schedule edit) without CAO submit. */
  @Patch(':id/draft')
  @Permissions('APPLICATION:UPDATE')
  saveDraft(
    @Param('id', ParseAnyUuidPipe) id: string,
    @CurrentUser() user: JwtRequestUser,
    @Body() dto: EngineerDraftApplicationDto,
  ) {
    return this.applicationsService.saveEngineerDraft(id, user.sub, dto);
  }

  @Post(':id/submit')
  @Permissions('APPLICATION:UPDATE')
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
