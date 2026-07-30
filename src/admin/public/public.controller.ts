import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { PublicService } from './public.service';
import { AttributeMasterType } from '../masters/enums/attribute-master-type.enum';
import { MasterStatus } from '../masters/enums/master-status.enum';

/**
 * Unguarded common-data API (Keonics-style `@Controller('public')`).
 * Lives under admin so all shared reference data is owned by the admin surface.
 * Writes stay on JWT-guarded `/masters/*`.
 */
@Controller('public')
export class PublicController {
  private readonly logger = new Logger(PublicController.name);

  constructor(private readonly publicService: PublicService) {}

  @Get('countries')
  async countries() {
    try {
      return await this.publicService.countries();
    } catch (error) {
      this.rethrow(error, 'Failed to fetch countries');
    }
  }

  @Get('states')
  async states(@Query('countryId') countryId?: string) {
    try {
      return await this.publicService.states(
        countryId ? parseInt(countryId, 10) : undefined,
      );
    } catch (error) {
      this.rethrow(error, 'Failed to fetch states');
    }
  }

  @Get('districts')
  async districts(@Query('stateId', ParseIntPipe) stateId: number) {
    try {
      return await this.publicService.districtsByState(stateId);
    } catch (error) {
      this.rethrow(error, 'Failed to fetch districts');
    }
  }

  @Get('states/:stateId/districts')
  async districtsByState(@Param('stateId', ParseIntPipe) stateId: number) {
    try {
      return await this.publicService.districtsByState(stateId);
    } catch (error) {
      this.rethrow(error, 'Failed to fetch districts');
    }
  }

  @Get('taluqs')
  async taluqs(@Query('districtId', ParseIntPipe) districtId: number) {
    try {
      return await this.publicService.taluqsByDistrict(districtId);
    } catch (error) {
      this.rethrow(error, 'Failed to fetch taluqs');
    }
  }

  @Get('districts/:districtId/taluqs')
  async taluqsByDistrict(@Param('districtId', ParseIntPipe) districtId: number) {
    try {
      return await this.publicService.taluqsByDistrict(districtId);
    } catch (error) {
      this.rethrow(error, 'Failed to fetch taluqs');
    }
  }

  @Get('zones/active')
  async zones() {
    try {
      return await this.publicService.activeZones();
    } catch (error) {
      this.rethrow(error, 'Failed to fetch zones');
    }
  }

  @Get('attributes')
  async attributes(
    @Query('type') type?: AttributeMasterType,
    @Query('status') status?: MasterStatus,
  ) {
    try {
      return await this.publicService.attributes(type, status);
    } catch (error) {
      this.rethrow(error, 'Failed to fetch attributes');
    }
  }

  @Get('application-statuses')
  async applicationStatuses() {
    try {
      return await this.publicService.applicationStatuses();
    } catch (error) {
      this.rethrow(error, 'Failed to fetch application statuses');
    }
  }

  private rethrow(error: unknown, fallback: string): never {
    if (error instanceof HttpException) {
      throw error;
    }
    this.logger.error(
      fallback,
      error instanceof Error ? error.stack : undefined,
    );
    throw new HttpException(
      error instanceof Error ? error.message || fallback : fallback,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
