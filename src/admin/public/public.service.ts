import { Injectable, Logger } from '@nestjs/common';
import { MastersService } from '../masters/masters.service';
import { AttributeMasterType } from '../masters/enums/attribute-master-type.enum';
import { MasterStatus } from '../masters/enums/master-status.enum';
import { rethrowServiceError } from '../common/utils/service-error';
import { ApplicationStatus } from '../../applications/enums/application.enums';

/**
 * Read-only common / master reference data for unauthenticated public clients.
 * Mirrors Keonics public master GETs — no writes here.
 */
@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);

  constructor(private readonly mastersService: MastersService) {}

  async countries() {
    try {
      return await this.mastersService.findCountries();
    } catch (error) {
      rethrowServiceError(error, 'Failed to load countries', this.logger);
    }
  }

  async states(countryId?: number) {
    try {
      return await this.mastersService.findStates(countryId);
    } catch (error) {
      rethrowServiceError(error, 'Failed to load states', this.logger);
    }
  }

  async districtsByState(stateId: number) {
    try {
      return await this.mastersService.findMasterDistrictsByState(stateId);
    } catch (error) {
      rethrowServiceError(error, 'Failed to load districts', this.logger);
    }
  }

  async taluqsByDistrict(districtId: number) {
    try {
      return await this.mastersService.findMasterTaluqsByDistrict(districtId);
    } catch (error) {
      rethrowServiceError(error, 'Failed to load taluqs', this.logger);
    }
  }

  async activeZones() {
    try {
      return await this.mastersService.findActiveZones();
    } catch (error) {
      rethrowServiceError(error, 'Failed to load zones', this.logger);
    }
  }

  async attributes(type?: AttributeMasterType, status?: MasterStatus) {
    try {
      return await this.mastersService.findAttributeMasters(
        { page: 1, limit: 200 },
        type,
        status ?? MasterStatus.ACTIVE,
      );
    } catch (error) {
      rethrowServiceError(error, 'Failed to load attributes', this.logger);
    }
  }

  /**
   * Status values live on `applications.status` (enum) — no separate master table.
   * Returns the fixed lifecycle list for dropdowns / forms.
   */
  async applicationStatuses() {
    const labels: Record<ApplicationStatus, string> = {
      [ApplicationStatus.DRAFT]: 'Draft',
      [ApplicationStatus.ASSIGNED]: 'Assigned',
      [ApplicationStatus.IN_PROGRESS]: 'In progress',
      [ApplicationStatus.SUBMITTED]: 'Submitted',
    };
    return Object.values(ApplicationStatus).map((code) => ({
      code,
      label: labels[code],
      status: 'Active',
      isSystem: true,
    }));
  }
}
