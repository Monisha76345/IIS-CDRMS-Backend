import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { MastersService } from './masters.service';
import { MasterStatus } from './enums/master-status.enum';
import { AttributeMasterType } from './enums/attribute-master-type.enum';
import {
  UpsertAttributeMasterDto,
  UpsertDistrictDto,
  UpsertGeoLocationDto,
  UpsertSystemParameterDto,
  UpsertTalukDto,
  UpsertVillageDto,
  UpdateMasterStatusDto,
} from './dto/masters.dto';

@Controller('masters')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MastersController {
  constructor(private readonly mastersService: MastersService) {}

  // ── CPMS geo masters (master_country / state / district / taluq / zones) ─

  @Get('countries')
  @Permissions('MASTER:VIEW')
  countries() {
    return this.mastersService.findCountries();
  }

  @Get('states')
  @Permissions('MASTER:VIEW')
  states(@Query('countryId') countryId?: string) {
    return this.mastersService.findStates(
      countryId ? parseInt(countryId, 10) : undefined,
    );
  }

  @Get('taluqs')
  @Permissions('MASTER:VIEW')
  taluqs(@Query('districtId', ParseIntPipe) districtId: number) {
    return this.mastersService.findMasterTaluqsByDistrict(districtId);
  }

  @Get('zones/active')
  @Permissions('MASTER:VIEW')
  zones() {
    return this.mastersService.findActiveZones();
  }

  @Get('states/:stateId/districts')
  @Permissions('MASTER:VIEW')
  districtsByState(@Param('stateId', ParseIntPipe) stateId: number) {
    return this.mastersService.findMasterDistrictsByState(stateId);
  }

  @Get('districts/:districtId/taluqs')
  @Permissions('MASTER:VIEW')
  taluqsByDistrict(@Param('districtId', ParseIntPipe) districtId: number) {
    return this.mastersService.findMasterTaluqsByDistrict(districtId);
  }

  // ── Geo locations ──────────────────────────────────────────

  @Get('geo-locations')
  @Permissions('MASTER:VIEW')
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
  @Permissions('MASTER:ADD')
  createGeoLocation(@Body() dto: UpsertGeoLocationDto) {
    return this.mastersService.createGeoLocation(dto);
  }

  @Put('geo-locations/:id')
  @Permissions('MASTER:UPDATE')
  updateGeoLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertGeoLocationDto,
  ) {
    return this.mastersService.updateGeoLocation(id, dto);
  }

  @Patch('geo-locations/:id/status')
  @Permissions('MASTER:UPDATE')
  patchGeoStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMasterStatusDto,
  ) {
    return this.mastersService.updateGeoLocation(id, { status: dto.status });
  }

  // ── Attribute masters ──────────────────────────────────────

  @Get('attributes')
  @Permissions('MASTER:VIEW')
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
  @Permissions('MASTER:ADD')
  createAttribute(@Body() dto: UpsertAttributeMasterDto) {
    return this.mastersService.createAttributeMaster(dto);
  }

  @Put('attributes/:id')
  @Permissions('MASTER:UPDATE')
  updateAttribute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertAttributeMasterDto,
  ) {
    return this.mastersService.updateAttributeMaster(id, dto);
  }

  @Patch('attributes/:id/status')
  @Permissions('MASTER:UPDATE')
  patchAttributeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMasterStatusDto,
  ) {
    return this.mastersService.updateAttributeMaster(id, {
      status: dto.status,
    });
  }

  // ── System parameters ──────────────────────────────────────

  @Get('system-parameters')
  @Permissions('MASTER:VIEW')
  findSystemParameters() {
    return this.mastersService.findSystemParameters();
  }

  @Put('system-parameters/:key')
  @Permissions('MASTER:UPDATE')
  updateSystemParameter(
    @Param('key') key: string,
    @Body() dto: UpsertSystemParameterDto,
  ) {
    return this.mastersService.updateSystemParameter(key, dto);
  }

  // ── Districts / Taluks / Villages ──────────────────────────

  // CPMS: ?stateId=13 → master_district; else admin UUID districts list
  @Get('districts')
  @Permissions('MASTER:VIEW')
  findDistricts(
    @Query('stateId') stateId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: MasterStatus,
  ) {
    if (stateId != null && String(stateId).trim() !== '') {
      return this.mastersService.findMasterDistrictsByState(
        parseInt(stateId, 10),
      );
    }
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
  @Permissions('MASTER:ADD')
  createDistrict(@Body() dto: UpsertDistrictDto) {
    return this.mastersService.createDistrict(dto);
  }

  @Put('districts/:id')
  @Permissions('MASTER:UPDATE')
  updateDistrict(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertDistrictDto,
  ) {
    return this.mastersService.updateDistrict(id, dto);
  }

  @Get('taluks')
  @Permissions('MASTER:VIEW')
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
  @Permissions('MASTER:ADD')
  createTaluk(@Body() dto: UpsertTalukDto) {
    return this.mastersService.createTaluk(dto);
  }

  @Put('taluks/:id')
  @Permissions('MASTER:UPDATE')
  updateTaluk(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertTalukDto,
  ) {
    return this.mastersService.updateTaluk(id, dto);
  }

  @Get('villages')
  @Permissions('MASTER:VIEW')
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
  @Permissions('MASTER:ADD')
  createVillage(@Body() dto: UpsertVillageDto) {
    return this.mastersService.createVillage(dto);
  }

  @Put('villages/:id')
  @Permissions('MASTER:UPDATE')
  updateVillage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertVillageDto,
  ) {
    return this.mastersService.updateVillage(id, dto);
  }
}
