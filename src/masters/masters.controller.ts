import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MastersService } from './masters.service';
import { MasterStatus } from './enums/master-status.enum';
import { AttributeMasterType } from './enums/attribute-master-type.enum';
import {
  UpsertApplicationStatusDto,
  UpsertAttributeMasterDto,
  UpsertDistrictDto,
  UpsertGeoLocationDto,
  UpsertSystemParameterDto,
  UpsertTalukDto,
  UpsertVillageDto,
  UpdateMasterStatusDto,
} from './dto/masters.dto';

@Controller('masters')
@UseGuards(JwtAuthGuard)
export class MastersController {
  constructor(private readonly mastersService: MastersService) {}

  // ── Geo locations ──────────────────────────────────────────

  @Get('geo-locations')
  findGeoLocations(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: MasterStatus,
  ) {
    return this.mastersService.findGeoLocations(
      {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search,
      },
      status,
    );
  }

  @Post('geo-locations')
  createGeoLocation(@Body() dto: UpsertGeoLocationDto) {
    return this.mastersService.createGeoLocation(dto);
  }

  @Put('geo-locations/:id')
  updateGeoLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertGeoLocationDto,
  ) {
    return this.mastersService.updateGeoLocation(id, dto);
  }

  @Patch('geo-locations/:id/status')
  patchGeoStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMasterStatusDto,
  ) {
    return this.mastersService.updateGeoLocation(id, { status: dto.status });
  }

  // ── Attribute masters ──────────────────────────────────────

  @Get('attributes')
  findAttributes(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: AttributeMasterType,
    @Query('status') status?: MasterStatus,
  ) {
    return this.mastersService.findAttributeMasters(
      {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search,
      },
      type,
      status,
    );
  }

  @Post('attributes')
  createAttribute(@Body() dto: UpsertAttributeMasterDto) {
    return this.mastersService.createAttributeMaster(dto);
  }

  @Put('attributes/:id')
  updateAttribute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertAttributeMasterDto,
  ) {
    return this.mastersService.updateAttributeMaster(id, dto);
  }

  @Patch('attributes/:id/status')
  patchAttributeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMasterStatusDto,
  ) {
    return this.mastersService.updateAttributeMaster(id, {
      status: dto.status,
    });
  }

  // ── Application statuses ───────────────────────────────────

  @Get('application-statuses')
  findApplicationStatuses() {
    return this.mastersService.findApplicationStatuses();
  }

  @Put('application-statuses')
  upsertApplicationStatus(@Body() dto: UpsertApplicationStatusDto) {
    return this.mastersService.upsertApplicationStatus(dto);
  }

  // ── System parameters ──────────────────────────────────────

  @Get('system-parameters')
  findSystemParameters() {
    return this.mastersService.findSystemParameters();
  }

  @Put('system-parameters/:key')
  updateSystemParameter(
    @Param('key') key: string,
    @Body() dto: UpsertSystemParameterDto,
  ) {
    return this.mastersService.updateSystemParameter(key, dto);
  }

  // ── Districts / Taluks / Villages ──────────────────────────

  @Get('districts')
  findDistricts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: MasterStatus,
  ) {
    return this.mastersService.findDistricts(
      {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search,
      },
      status,
    );
  }

  @Post('districts')
  createDistrict(@Body() dto: UpsertDistrictDto) {
    return this.mastersService.createDistrict(dto);
  }

  @Put('districts/:id')
  updateDistrict(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertDistrictDto,
  ) {
    return this.mastersService.updateDistrict(id, dto);
  }

  @Get('taluks')
  findTaluks(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('districtId') districtId?: string,
    @Query('status') status?: MasterStatus,
  ) {
    return this.mastersService.findTaluks(
      {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search,
      },
      districtId,
      status,
    );
  }

  @Post('taluks')
  createTaluk(@Body() dto: UpsertTalukDto) {
    return this.mastersService.createTaluk(dto);
  }

  @Put('taluks/:id')
  updateTaluk(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertTalukDto,
  ) {
    return this.mastersService.updateTaluk(id, dto);
  }

  @Get('villages')
  findVillages(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('talukId') talukId?: string,
    @Query('districtId') districtId?: string,
    @Query('status') status?: MasterStatus,
  ) {
    return this.mastersService.findVillages(
      {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search,
      },
      talukId,
      districtId,
      status,
    );
  }

  @Post('villages')
  createVillage(@Body() dto: UpsertVillageDto) {
    return this.mastersService.createVillage(dto);
  }

  @Put('villages/:id')
  updateVillage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertVillageDto,
  ) {
    return this.mastersService.updateVillage(id, dto);
  }
}
