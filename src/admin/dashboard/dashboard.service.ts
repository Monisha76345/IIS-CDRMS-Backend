import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserType } from '../users/enums/user-types.enum';
import { Application } from '../../applications/entities/application.entity';
import { ApplicationStatus } from '../../applications/enums/application.enums';
import { GeoLocation } from '../masters/entities/geo-location.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,
    @InjectRepository(GeoLocation)
    private readonly geoLocationRepository: Repository<GeoLocation>,
  ) {}

  async getOverviewStats() {
    const [engineers, caos, applications, pending, approved, geoLocations, zoneCountsRaw] = await Promise.all([
      this.userRepository.count({
        where: { userType: UserType.ENGINEER },
      }),
      this.userRepository.count({
        where: { userType: UserType.CAO },
      }),
      this.applicationRepository.count(),
      this.applicationRepository.count({
        where: {
          status: In([
            ApplicationStatus.ASSIGNED,
            ApplicationStatus.IN_PROGRESS,
          ]),
        },
      }),
      this.applicationRepository.count({
        where: { status: ApplicationStatus.SUBMITTED },
      }),
      this.geoLocationRepository.count(),
      this.applicationRepository
        .createQueryBuilder('a')
        .select('a.zoneCode', 'zoneCode')
        .addSelect('COUNT(a.id)', 'count')
        .groupBy('a.zoneCode')
        .getRawMany<{ zoneCode: string; count: string }>(),
    ]);

    const zoneDistribution = {
      North: 0,
      East: 0,
      South: 0,
      West: 0,
      Central: 0,
    };

    for (const z of zoneCountsRaw) {
      const code = z.zoneCode?.trim().toUpperCase();
      if (!code) continue;
      if (code.includes('NORTH')) zoneDistribution.North += Number(z.count);
      else if (code.includes('SOUTH')) zoneDistribution.South += Number(z.count);
      else if (code.includes('EAST')) zoneDistribution.East += Number(z.count);
      else if (code.includes('WEST')) zoneDistribution.West += Number(z.count);
      else if (code.includes('CENTRAL')) zoneDistribution.Central += Number(z.count);
    }

    return {
      engineers,
      caos,
      applications,
      pending,
      approved,
      geoLocations,
      zoneDistribution,
    };
  }
}
