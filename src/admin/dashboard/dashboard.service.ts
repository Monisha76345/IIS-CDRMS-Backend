import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserType } from '../users/enums/user-types.enum';
import { Application } from '../../applications/entities/application.entity';
import { ApplicationStatus } from '../../applications/enums/application.enums';
import { GeoLocation } from '../masters/entities/geo-location.entity';
import { AuditService, ActivitySummaryItem } from '../../audit/audit.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,
    @InjectRepository(GeoLocation)
    private readonly geoLocationRepository: Repository<GeoLocation>,
    private readonly auditService: AuditService,
  ) { }

  async getOverviewStats(
    user?: { sub?: string; role?: string },
    zoneCodeFilter?: string,
    asRole?: string,
    statusFilter?: string,
    searchFilter?: string,
  ) {
    let zoneFilter = zoneCodeFilter?.trim().toUpperCase();
    let isZoneFiltered = Boolean(zoneFilter && zoneFilter !== 'ALL');

    // Auto-detect zone from user's post if ZC, CAO, or engineer
    if (user?.sub && (!zoneFilter || zoneFilter === 'ALL')) {
      try {
        const dbUser = await this.userRepository.findOne({
          where: { id: user.sub },
        });
        if (
          dbUser &&
          (asRole === 'zc' ||
            asRole === 'cao' ||
            asRole === 'engineer' ||
            dbUser.userType === UserType.ZONAL_COMMISSIONER ||
            dbUser.userType === UserType.CAO ||
            dbUser.userType === UserType.ENGINEER)
        ) {
          const mapping = await this.userRepository.manager
            .createQueryBuilder()
            .select('post.zoneCode', 'zoneCode')
            .from('personal_details', 'p')
            .innerJoin(
              'post_person_mappings',
              'm',
              'm.personId = p.id AND m.status = :mStatus',
              { mStatus: 'active' },
            )
            .innerJoin('post_details', 'post', 'post.id = m.postId')
            .where('p.personUniqueId = :pUid', { pUid: dbUser.loginId })
            .getRawOne<{ zoneCode: string }>();

          if (mapping?.zoneCode) {
            zoneFilter = mapping.zoneCode.trim().toUpperCase();
            isZoneFiltered = true;
          }
        }
      } catch (err) {
        // proceed with default
      }
    }

    const appQuery = this.applicationRepository.createQueryBuilder('a');
    if (isZoneFiltered) {
      appQuery.where(
        '(UPPER(a.zoneCode) LIKE :zf OR UPPER(COALESCE(a.addressBlock, \'\')) LIKE :zf)',
        { zf: `%${zoneFilter}%` },
      );
    }

    if (asRole === 'engineer' && user?.sub) {
      appQuery.andWhere('a.assignedEngineerUserId = :engId', { engId: user.sub });
    }

    const countUsersForType = async (userType: UserType) => {
      try {
        if (!isZoneFiltered) {
          return await this.userRepository.count({ where: { userType } });
        }

        // Direct application mappings for zone
        if (userType === UserType.ENGINEER) {
          const res = await this.applicationRepository
            .createQueryBuilder('a')
            .select('COUNT(DISTINCT a.assignedEngineerUserId)', 'cnt')
            .where('UPPER(a.zoneCode) LIKE :zf AND a.assignedEngineerUserId IS NOT NULL', { zf: `%${zoneFilter}%` })
            .getRawOne<{ cnt: string }>();
          const count = Number(res?.cnt || 0);
          if (count > 0) return count;
        }

        if (userType === UserType.ZONAL_COMMISSIONER) {
          const res = await this.applicationRepository
            .createQueryBuilder('a')
            .select('COUNT(DISTINCT a.createdByZcUserId)', 'cnt')
            .where('UPPER(a.zoneCode) LIKE :zf AND a.createdByZcUserId IS NOT NULL', { zf: `%${zoneFilter}%` })
            .getRawOne<{ cnt: string }>();
          const count = Number(res?.cnt || 0);
          if (count > 0) return count;
        }

        if (userType === UserType.CAO) {
          const res = await this.applicationRepository
            .createQueryBuilder('a')
            .select('COUNT(DISTINCT a.assignedCaoUserId)', 'cnt')
            .where('UPPER(a.zoneCode) LIKE :zf AND a.assignedCaoUserId IS NOT NULL', { zf: `%${zoneFilter}%` })
            .getRawOne<{ cnt: string }>();
          const count = Number(res?.cnt || 0);
          if (count > 0) return count;
        }

        // Fallback to total users of that type
        return await this.userRepository.count({ where: { userType } });
      } catch (e) {
        return 0;
      }
    };

    let engineers = 0;
    let caos = 0;
    let zcs = 0;
    let applications = 0;
    let draft = 0;
    let assigned = 0;
    let inProgress = 0;
    let submitted = 0;
    let zoneCountsRaw: Array<{ zoneCode: string; count: string }> = [];

    try {
      [
        engineers,
        caos,
        zcs,
        applications,
        draft,
        assigned,
        inProgress,
        submitted,
        zoneCountsRaw,
      ] = await Promise.all([
        countUsersForType(UserType.ENGINEER),
        countUsersForType(UserType.CAO),
        countUsersForType(UserType.ZONAL_COMMISSIONER),
        appQuery.clone().getCount(),
        appQuery.clone().andWhere('a.status = :sDraft', { sDraft: ApplicationStatus.DRAFT }).getCount(),
        appQuery.clone().andWhere('a.status = :sAssigned', { sAssigned: ApplicationStatus.ASSIGNED }).getCount(),
        appQuery.clone().andWhere('a.status = :sInProg', { sInProg: ApplicationStatus.IN_PROGRESS }).getCount(),
        appQuery.clone().andWhere('a.status = :sSub', { sSub: ApplicationStatus.SUBMITTED }).getCount(),
        this.applicationRepository
          .createQueryBuilder('a')
          .select('a.zoneCode', 'zoneCode')
          .addSelect('COUNT(a.id)', 'count')
          .groupBy('a.zoneCode')
          .getRawMany<{ zoneCode: string; count: string }>(),
      ]);
    } catch (err) {
      // fallback
    }




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

    // Compute zone-wise status breakdown
    const zones = [
      { zone: 'Bengaluru North', shortZone: 'North', key: 'NORTH' },
      { zone: 'Bengaluru South', shortZone: 'South', key: 'SOUTH' },
      { zone: 'Bengaluru East', shortZone: 'East', key: 'EAST' },
      { zone: 'Bengaluru West', shortZone: 'West', key: 'WEST' },
      { zone: 'Bengaluru Central', shortZone: 'Central', key: 'CENTRAL' },
    ];

    const zoneStatusBreakdown = zones.map((z) => ({
      zone: z.zone,
      shortZone: z.shortZone,
      assigned: 0,
      inProgress: 0,
      submitted: 0,
      total: 0,
    }));

    try {
      const allApps = await this.applicationRepository
        .createQueryBuilder('a')
        .select('a.zoneCode', 'zoneCode')
        .addSelect('a.addressBlock', 'addressBlock')
        .addSelect('a.status', 'status')
        .getRawMany<{ zoneCode?: string; addressBlock?: string; status?: string }>();

      for (const a of allApps) {
        const zStr = (a.zoneCode || a.addressBlock || '').toUpperCase();
        const target = zoneStatusBreakdown.find((item) => {
          if (item.shortZone === 'North') return zStr.includes('NORTH');
          if (item.shortZone === 'South') return zStr.includes('SOUTH');
          if (item.shortZone === 'East') return zStr.includes('EAST');
          if (item.shortZone === 'West') return zStr.includes('WEST');
          if (item.shortZone === 'Central') return zStr.includes('CENTRAL');
          return false;
        });

        if (target) {
          target.total++;
          if (a.status === ApplicationStatus.ASSIGNED) target.assigned++;
          else if (a.status === ApplicationStatus.IN_PROGRESS) target.inProgress++;
          else if (a.status === ApplicationStatus.SUBMITTED) target.submitted++;
          else target.assigned++;
        }
      }
    } catch (err) {
      // fallback safe breakdown
    }

    // Compute last 7 days daily counts
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const trendMap = new Map<string, { day: string; assigned: number; submitted: number }>();
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const ymd = d.toISOString().slice(0, 10);
      trendMap.set(ymd, {
        day: dayNames[d.getDay()],
        assigned: 0,
        submitted: 0,
      });
    }

    try {
      const recentApps = await appQuery
        .clone()
        .select('a.id', 'id')
        .addSelect('a.status', 'status')
        .addSelect('a.createdAt', 'createdAt')
        .getRawMany<{ id: string; status: string; createdAt: Date }>();

      for (const a of recentApps) {
        const cDate = a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : '';
        if (trendMap.has(cDate)) {
          const item = trendMap.get(cDate)!;
          if (a.status === ApplicationStatus.SUBMITTED) {
            item.submitted++;
          } else {
            item.assigned++;
          }
        }
      }
    } catch (err) {
      // fallback safe trend
    }

    let recentApplications: Array<{
      id: string;
      applicationNumber: string;
      siteNo: string;
      assignedEngineerName: string;
      zoneCode: string;
      status: string;
      addressLine1: string;
      createdAt: string;
    }> = [];

    try {
      const recentQuery = appQuery.clone().orderBy('a.createdAt', 'DESC');

      // Apply status filter to recentApplications only (KPI counts stay unfiltered)
      const normalizedStatus = statusFilter?.trim().toLowerCase();
      if (normalizedStatus && normalizedStatus !== 'all') {
        const statusMap: Record<string, string> = {
          draft: 'draft',
          assigned: 'assigned',
          in_progress: 'in_progress',
          inprogress: 'in_progress',
          submitted: 'submitted',
        };
        const mappedStatus = statusMap[normalizedStatus] ?? normalizedStatus;
        recentQuery.andWhere('LOWER(a.status) = :rStatus', { rStatus: mappedStatus });
      }

      // Apply search filter to recentApplications only
      const searchTerm = searchFilter?.trim();
      if (searchTerm) {
        recentQuery.andWhere(
          '(a.applicationNumber ILIKE :search OR a.siteNo ILIKE :search OR a.assignedEngineerName ILIKE :search OR a.zoneCode ILIKE :search)',
          { search: `%${searchTerm}%` },
        );
      }

      const recentList = await recentQuery.take(50).getMany();

      recentApplications = recentList.map((app) => ({
        id: app.id,
        applicationNumber: app.applicationNumber || '—',
        siteNo: app.siteNo || '—',
        assignedEngineerName: app.assignedEngineerName || '—',
        zoneCode: app.zoneCode || app.addressBlock || '—',
        status: app.status,
        addressLine1: app.addressLine1 || '',
        createdAt: app.createdAt ? new Date(app.createdAt).toISOString() : '',
      }));
    } catch {
      // fallback
    }

    let recentActivities: ActivitySummaryItem[] = [];
    try {
      recentActivities = await this.auditService.getRecentActivities(30);
    } catch {
      recentActivities = [];
    }

    // Zone-wise role distribution: count ZC, CAO, Engineer per zone from post_details
    const zoneRoleDefs = [
      { zone: 'Bengaluru North', shortZone: 'North', key: 'NORTH' },
      { zone: 'Bengaluru South', shortZone: 'South', key: 'SOUTH' },
      { zone: 'Bengaluru East', shortZone: 'East', key: 'EAST' },
      { zone: 'Bengaluru West', shortZone: 'West', key: 'WEST' },
      { zone: 'Bengaluru Central', shortZone: 'Central', key: 'CENTRAL' },
    ];

    const zoneRoleDistribution = zoneRoleDefs.map((z) => ({
      zone: z.zone,
      shortZone: z.shortZone,
      zc: 0,
      cao: 0,
      engineer: 0,
    }));

    try {
      // Count active post-person mappings grouped by zoneCode + userType
      const roleRows = await this.userRepository.manager
        .createQueryBuilder()
        .select('UPPER(post.zoneCode)', 'zoneCode')
        .addSelect('u.userType', 'userType')
        .addSelect('COUNT(DISTINCT m.personId)', 'cnt')
        .from('post_person_mappings', 'm')
        .innerJoin('post_details', 'post', 'post.id = m.postId')
        .innerJoin('personal_details', 'p', 'p.id = m.personId')
        .innerJoin('users', 'u', 'u.loginId = p.personUniqueId')
        .where('m.status = :mStatus', { mStatus: 'active' })
        .andWhere('post.zoneCode IS NOT NULL')
        .groupBy('post.zoneCode')
        .addGroupBy('u.userType')
        .getRawMany<{ zoneCode: string; userType: string; cnt: string }>();

      for (const row of roleRows) {
        const code = (row.zoneCode || '').toUpperCase();
        const target = zoneRoleDistribution.find((z) => code.includes(z.shortZone.toUpperCase()));
        if (!target) continue;
        const count = Number(row.cnt || 0);
        if (row.userType === UserType.ZONAL_COMMISSIONER) target.zc += count;
        else if (row.userType === UserType.CAO) target.cao += count;
        else if (row.userType === UserType.ENGINEER) target.engineer += count;
      }
    } catch {
      // fallback — zeros already set
    }

    return {
      engineers,
      caos,
      zcs,
      applications,
      draft,
      assigned,
      inProgress,
      submitted,
      pending: assigned + inProgress,
      approved: submitted,
      geoLocations: 0,
      zoneDistribution,
      zoneStatusBreakdown,
      zoneRoleDistribution,
      recentApplications,
      recentActivities,
    };
  }
}


