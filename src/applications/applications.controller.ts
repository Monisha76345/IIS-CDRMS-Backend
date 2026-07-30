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
import {
  CaoRejectApplicationDto,
  CaoReturnApplicationDto,
  CaoReviewApplicationDto,
} from './dto/cao-review.dto';
import { JwtAuthGuard } from '../admin/auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  type JwtRequestUser,
} from '../admin/common/decorators/current-user.decorator';
import { ParseAnyUuidPipe } from '../admin/common/pipes/parse-any-uuid.pipe';

@Controller('applications')
@UseGuards(JwtAuthGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  /** ZC zone + engineers in that zone for the create form. */
  @Get('meta/my-zone')
  myZone(@CurrentUser() user: JwtRequestUser) {
    return this.applicationsService.myZoneContext(user.sub);
  }

  @Get('meta/cao-counts')
  caoCounts(@CurrentUser() user: JwtRequestUser) {
    return this.applicationsService.caoCounts(user.sub);
  }

  @Get('meta/task-counts')
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
  engineersByZone(@Query('zoneId') zoneId: string) {
    return this.applicationsService.findEngineersByZone(Number(zoneId));
  }

  @Get()
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
  create(
    @CurrentUser() user: JwtRequestUser,
    @Body() dto: CreateApplicationDto,
  ) {
    return this.applicationsService.create(user.sub, dto);
  }

  @Patch(':id/start')
  start(
    @Param('id', ParseAnyUuidPipe) id: string,
    @CurrentUser() user: JwtRequestUser,
  ) {
    return this.applicationsService.startTask(id, user.sub);
  }

  @Post(':id/submit')
  submit(
    @Param('id', ParseAnyUuidPipe) id: string,
    @CurrentUser() user: JwtRequestUser,
    @Body() dto: EngineerSubmitApplicationDto,
  ) {
    return this.applicationsService.submitEngineer(id, user.sub, dto);
  }

  @Post(':id/verify')
  verify(
    @Param('id', ParseAnyUuidPipe) id: string,
    @CurrentUser() user: JwtRequestUser,
    @Body() dto: CaoReviewApplicationDto,
  ) {
    return this.applicationsService.caoVerify(id, user.sub, dto.remarks);
  }

  @Post(':id/return')
  returnToEngineer(
    @Param('id', ParseAnyUuidPipe) id: string,
    @CurrentUser() user: JwtRequestUser,
    @Body() dto: CaoReturnApplicationDto,
  ) {
    return this.applicationsService.caoReturn(id, user.sub, dto.remarks);
  }

  @Post(':id/reject')
  reject(
    @Param('id', ParseAnyUuidPipe) id: string,
    @CurrentUser() user: JwtRequestUser,
    @Body() dto: CaoRejectApplicationDto,
  ) {
    return this.applicationsService.caoReject(id, user.sub, dto.remarks);
  }
}

function normalizeRole(user: JwtRequestUser): string {
  return String(user.role || user.userType || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
}
