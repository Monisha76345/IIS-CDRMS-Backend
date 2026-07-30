import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application } from './entities/application.entity';
import { CreateApplicationDto } from './dto/create-application.dto';
import { EngineerSubmitApplicationDto } from './dto/engineer-submit.dto';
import { ApplicationStatus, OccupancyStatus } from './enums/application.enums';
import { SeriesGeneratorService } from '../admin/series-generator/series-generator.service';
import { UsersService } from '../admin/users/users.service';
import { UserType } from '../admin/users/enums/user-types.enum';
import { MasterZone } from '../admin/masters/entities/master-zone.entity';
import { User } from '../admin/users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import type { ApplicationHistoryItem } from './models/application-history-item.interface';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(MasterZone)
    private readonly zoneRepo: Repository<MasterZone>,
    private readonly seriesGenerator: SeriesGeneratorService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private toIso(value?: Date | string | null): string {
    if (!value) return new Date().toISOString();
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }

  private async formatActor(userId: string, roleLabel: string): Promise<string> {
    const user = await this.usersService.findById(userId);
    if (!user) return roleLabel;
    let name = user.name?.trim() || '';
    try {
      const { person } = await this.usersService.resolvePositionContext(user);
      if (person) {
        name = `${person.firstName || ''} ${person.lastName || ''}`.trim() || name;
      }
    } catch {
      // keep fallback name
    }
    if (!name) name = user.loginId || user.email || 'User';
    const login = user.loginId?.trim();
    return login
      ? `${name} (${login}) - ${roleLabel}`
      : `${name} - ${roleLabel}`;
  }

  private formatParty(
    name: string | null | undefined,
    role: string,
    loginId?: string | null,
  ): string {
    const n = name?.trim() || role;
    if (loginId?.trim()) return `${role} — ${n} (${loginId.trim()})`;
    return `${role} — ${n}`;
  }

  private appendHistory(
    app: Application,
    item: Omit<ApplicationHistoryItem, 'id'>,
  ): void {
    const entry: ApplicationHistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...item,
      comments: item.comments?.trim() || '—',
    };
    const prev = Array.isArray(app.history) ? app.history : [];
    app.history = [...prev, entry];
  }

  private async resolveUserZone(userId: string): Promise<{
    user: User;
    zoneId: number;
    zoneCode: string;
    displayName: string;
  }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const { post, person } = await this.usersService.resolvePositionContext(user);
    const zoneId = post?.zoneId ?? null;
    const zoneCode = post?.zoneCode?.trim().toUpperCase() || null;

    if (!zoneId || !zoneCode) {
      throw new BadRequestException(
        'Your post is not linked to a master zone. Ask Super Admin to set zone on Post Details.',
      );
    }

    const zone = await this.zoneRepo.findOne({ where: { id: zoneId } });
    if (!zone || !zone.isActive) {
      throw new BadRequestException('Master zone for your post is invalid or inactive');
    }

    const displayName =
      person
        ? `${person.firstName || ''} ${person.lastName || ''}`.trim()
        : user.name || user.loginId || user.email || userId;

    return {
      user,
      zoneId: zone.id,
      zoneCode: (zone.zoneCode || zoneCode).toUpperCase(),
      displayName,
    };
  }

  /** Engineers with an active post mapping in the given zone. */
  async findEngineersByZone(zoneId: number) {
    const zone = await this.zoneRepo.findOne({ where: { id: zoneId } });
    if (!zone) throw new NotFoundException('Zone not found');

    const mappings = await this.usersService.findActiveEngineerMappingsByZone(zoneId);
    return mappings.map((m) => {
      const person = m.person;
      const userLogin = person?.personUniqueId;
      return {
        mappingId: m.id,
        personId: person?.id,
        personUniqueId: userLogin,
        name: person
          ? `${person.firstName || ''} ${person.lastName || ''}`.trim()
          : '—',
        postId: m.post?.postId,
        postName: m.post?.postName,
        zoneId: m.post?.zoneId,
        zoneCode: m.post?.zoneCode,
        userId: m.userId as string | undefined,
        email: m.userEmail as string | undefined,
      };
    });
  }

  async create(zcUserId: string, dto: CreateApplicationDto): Promise<Application> {
    const zc = await this.resolveUserZone(zcUserId);

    const engineers = await this.findEngineersByZone(zc.zoneId);
    const assigned = engineers.find((e) => e.userId === dto.assignedEngineerUserId);
    if (!assigned) {
      throw new BadRequestException(
        'Assigned engineer must belong to your zone and have an active post mapping',
      );
    }

    const prefix = `ZC-${zc.zoneCode}-AUC-`;
    const applicationNumber = await this.seriesGenerator.generateAndSavePrefix(
      prefix,
      4,
    );

    const app = this.applicationRepo.create({
      applicationNumber,
      siteNo: dto.siteNo.trim(),
      addressArea: dto.addressArea.trim(),
      addressBlock: dto.addressBlock.trim(),
      addressPincode: dto.addressPincode.trim(),
      siteDimensionType: dto.siteDimensionType,
      siteDimension: dto.siteDimension.trim(),
      siteDimensionComment: dto.siteDimensionComment?.trim() || null,
      scheduleNorth: dto.scheduleNorth?.trim() || null,
      scheduleSouth: dto.scheduleSouth?.trim() || null,
      scheduleWest: dto.scheduleWest?.trim() || null,
      scheduleEast: dto.scheduleEast?.trim() || null,
      zoneId: zc.zoneId,
      zoneCode: zc.zoneCode,
      assignedEngineerUserId: dto.assignedEngineerUserId,
      assignedEngineerName: assigned.name,
      createdByZcUserId: zcUserId,
      createdByZcName: zc.displayName,
      status: ApplicationStatus.ASSIGNED,
      createdBy: zcUserId,
      history: [],
    });

    const now = new Date();
    const engineerLogin =
      assigned.personUniqueId ||
      (
        await this.usersService.resolveEngineerDisplayByIds([
          dto.assignedEngineerUserId,
        ])
      ).get(dto.assignedEngineerUserId)?.loginId;

    this.appendHistory(app, {
      taskName: 'Application created',
      performedBy: await this.formatActor(zcUserId, 'Zonal Commissioner'),
      sentTo: this.formatParty(assigned.name, 'Engineer', engineerLogin),
      startedOn: this.toIso(now),
      completedOn: this.toIso(now),
      comments: dto.siteDimensionComment?.trim() || '—',
      statusBefore: undefined,
      statusAfter: ApplicationStatus.ASSIGNED,
    });

    const saved = await this.applicationRepo.save(app);

    await this.notificationsService.create({
      userId: saved.assignedEngineerUserId,
      title: 'New field task assigned',
      message: `${zc.displayName || 'Zonal Commissioner'} assigned application ${saved.applicationNumber} (Site ${saved.siteNo}, Zone ${saved.zoneCode}) to you for field capture.`,
      type: 'task_assigned',
      applicationId: saved.id,
      applicationNumber: saved.applicationNumber,
      linkPath: `/engineer/tasks/${saved.id}`,
      createdBy: zcUserId,
    });

    return saved;
  }

  async listMine(
    userId: string,
    as: 'zc' | 'engineer' | 'cao',
    queue: 'open' | 'all' = 'all',
  ): Promise<Application[]> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const roleStr = String(user.userType || '').toLowerCase();
    const isSuperAdmin =
      roleStr.includes('super_admin') || user.userType === UserType.SUPER_ADMIN;

    let apps: Application[];

    if (isSuperAdmin) {
      // Super Admin: sees ALL applications across all zones (no zone selection needed)
      apps = await this.applicationRepo.find({
        order: { createdAt: 'DESC' },
      });
    } else if (as === 'cao' || roleStr.includes('cao')) {
      // Mandatory zone mapping for CAO: show applications belonging to CAO's assigned zone
      const caoZone = await this.resolveUserZone(userId);
      apps = await this.applicationRepo.find({
        where: [
          { zoneId: caoZone.zoneId },
          { assignedCaoUserId: userId },
        ],
        order: { engineerSubmittedAt: 'DESC', createdAt: 'DESC' },
      });
    } else if (as === 'engineer' || roleStr.includes('engineer')) {
      apps = await this.applicationRepo.find({
        where: { assignedEngineerUserId: userId },
        order: { createdAt: 'DESC' },
      });
    } else {
      // ZC (and similar): show all applications in the mapped zone
      const zcZone = await this.resolveUserZone(userId);
      apps = await this.applicationRepo.find({
        where: { zoneId: zcZone.zoneId },
        order: { createdAt: 'DESC' },
      });
    }

    if (queue === 'open') {
      if (as === 'engineer' || roleStr.includes('engineer')) {
        apps = apps.filter(
          (a) =>
            a.status === ApplicationStatus.ASSIGNED ||
            a.status === ApplicationStatus.IN_PROGRESS ||
            a.status === ApplicationStatus.RETURNED,
        );
      } else if (as === 'cao' || roleStr.includes('cao')) {
        apps = apps.filter((a) => a.status === ApplicationStatus.SUBMITTED);
      }
    }

    return this.withEngineerLoginMany(apps);
  }

  async taskCounts(userId: string, as: 'engineer' | 'cao') {
    const open = await this.listMine(userId, as, 'open');
    return { applications: open.length };
  }

  async caoCounts(caoUserId: string) {
    const apps = await this.listMine(caoUserId, 'cao');
    return {
      pending: apps.filter((a) => a.status === ApplicationStatus.SUBMITTED).length,
      verified: apps.filter((a) => a.status === ApplicationStatus.VERIFIED).length,
      returned: apps.filter((a) => a.status === ApplicationStatus.RETURNED).length,
      rejected: apps.filter((a) => a.status === ApplicationStatus.REJECTED).length,
      total: apps.length,
    };
  }

  async findOne(id: string): Promise<Application> {
    const app = await this.applicationRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  /** Attach engineer loginId + uploaded profile photo for UI (not DB columns). */
  private async withEngineerLogin(
    app: Application,
  ): Promise<
    Application & {
      assignedEngineerLoginId: string | null;
      assignedEngineerProfilePhoto: string | null;
    }
  > {
    const map = await this.usersService.resolveEngineerDisplayByIds([
      app.assignedEngineerUserId,
    ]);
    const info = map.get(app.assignedEngineerUserId);
    return Object.assign(app, {
      assignedEngineerLoginId: info?.loginId ?? null,
      assignedEngineerProfilePhoto: info?.profilePhoto ?? null,
    }) as Application & {
      assignedEngineerLoginId: string | null;
      assignedEngineerProfilePhoto: string | null;
    };
  }

  private async withEngineerLoginMany(apps: Application[]) {
    const map = await this.usersService.resolveEngineerDisplayByIds(
      apps.map((a) => a.assignedEngineerUserId),
    );
    return apps.map((app) => {
      const info = map.get(app.assignedEngineerUserId);
      return Object.assign(app, {
        assignedEngineerLoginId: info?.loginId ?? null,
        assignedEngineerProfilePhoto: info?.profilePhoto ?? null,
      });
    });
  }

  async findOneAuthorized(id: string, userId: string, userType?: string) {
    const app = await this.findOne(id);
    const role = String(userType || '').toLowerCase();
    const isAdmin =
      role === UserType.SUPER_ADMIN ||
      role === 'super_admin' ||
      role.includes('super_admin');
    if (isAdmin) return this.withEngineerLogin(app);

    if (
      app.createdByZcUserId === userId ||
      app.assignedEngineerUserId === userId ||
      app.assignedCaoUserId === userId
    ) {
      return this.withEngineerLogin(app);
    }

    // Zone officers (ZC / CAO): any application in their mapped zone
    const isZoneOfficer =
      role.includes('zc') ||
      role.includes('zonal') ||
      role.includes('commissioner') ||
      role === UserType.CAO ||
      role === 'cao' ||
      role.includes('cao');
    if (isZoneOfficer) {
      try {
        const zone = await this.resolveUserZone(userId);
        if (zone.zoneId === app.zoneId) return this.withEngineerLogin(app);
      } catch {
        // fall through to forbidden
      }
    }

    throw new ForbiddenException('You do not have access to this application');
  }

  async startTask(id: string, engineerUserId: string): Promise<Application> {
    const app = await this.findOne(id);
    if (app.assignedEngineerUserId !== engineerUserId) {
      throw new ForbiddenException('This task is not assigned to you');
    }
    if (
      app.status === ApplicationStatus.SUBMITTED ||
      app.status === ApplicationStatus.VERIFIED ||
      app.status === ApplicationStatus.REJECTED
    ) {
      throw new BadRequestException('Application already submitted');
    }
    if (
      app.status === ApplicationStatus.ASSIGNED ||
      app.status === ApplicationStatus.RETURNED
    ) {
      const statusBefore = app.status;
      const startedOn = this.toIso(app.updatedAt || app.createdAt);
      app.status = ApplicationStatus.IN_PROGRESS;
      app.updatedBy = engineerUserId;
      this.appendHistory(app, {
        taskName: 'Inspection started',
        performedBy: await this.formatActor(engineerUserId, 'Engineer'),
        sentTo: '—',
        startedOn,
        completedOn: this.toIso(new Date()),
        comments: '—',
        statusBefore,
        statusAfter: ApplicationStatus.IN_PROGRESS,
      });
      return this.applicationRepo.save(app);
    }
    return app;
  }

  async submitEngineer(
    id: string,
    engineerUserId: string,
    dto: EngineerSubmitApplicationDto,
  ): Promise<Application> {
    const app = await this.findOne(id);
    if (app.assignedEngineerUserId !== engineerUserId) {
      throw new ForbiddenException('This task is not assigned to you');
    }
    if (
      app.status === ApplicationStatus.SUBMITTED ||
      app.status === ApplicationStatus.VERIFIED
    ) {
      throw new BadRequestException('Application already submitted');
    }
    if (app.status === ApplicationStatus.REJECTED) {
      throw new BadRequestException('Application was rejected');
    }

    const n = Number(dto.dimNorth);
    const s = Number(dto.dimSouth);
    const e = Number(dto.dimEast);
    const w = Number(dto.dimWest);
    if ([n, s, e, w].some((v) => !Number.isFinite(v) || v <= 0)) {
      throw new BadRequestException('Site dimensions must be positive numbers');
    }

    const avgNS = (n + s) / 2;
    const avgEW = (e + w) / 2;
    const computedArea = Number((avgNS * avgEW).toFixed(2));
    const total =
      dto.totalSiteArea != null && dto.totalSiteArea !== ''
        ? dto.totalSiteArea
        : String(computedArea);

    if (dto.occupancy === OccupancyStatus.OCCUPIED && !dto.occupancyReason?.trim()) {
      throw new BadRequestException('Reason is required when site is Occupied');
    }

    const caos = await this.usersService.findActiveCaoMappingsByZone(app.zoneId);
    const cao = caos.find((c) => c.userId);
    if (!cao?.userId) {
      throw new BadRequestException(
        `No CAO is mapped to zone ${app.zoneCode}. Ask Super Admin to map a CAO post to this zone before submit.`,
      );
    }

    const statusBefore = app.status;
    const startedOn = this.toIso(app.updatedAt || app.createdAt);
    const wasResubmit =
      Boolean(app.engineerSubmittedAt) ||
      statusBefore === ApplicationStatus.RETURNED;

    app.engineerSiteDetails = dto.engineerSiteDetails.trim();
    app.compass = dto.compass.trim();
    app.latitude = dto.latitude;
    app.longitude = dto.longitude;
    app.occupancy = dto.occupancy;
    app.occupancyReason = dto.occupancyReason?.trim() || null;
    app.dimNorth = String(n);
    app.dimSouth = String(s);
    app.dimEast = String(e);
    app.dimWest = String(w);
    app.totalSiteArea = total;
    app.selfieUrl = dto.selfieUrl;
    app.photoUrls = dto.photoUrls;
    app.schedulePhotoUrls = dto.schedulePhotoUrls
      ? { ...dto.schedulePhotoUrls }
      : null;
    app.videoUrl = dto.videoUrl;
    app.engineerComments = dto.engineerComments.trim();
    app.engineerSubmittedAt = new Date();
    app.assignedCaoUserId = cao.userId;
    app.assignedCaoName = cao.displayName || null;
    app.status = ApplicationStatus.SUBMITTED;
    app.caoRemarks = null;
    app.caoReviewedAt = null;
    app.updatedBy = engineerUserId;

    this.appendHistory(app, {
      taskName: wasResubmit ? 'Engineer resubmitted' : 'Engineer submitted',
      performedBy: await this.formatActor(engineerUserId, 'Engineer'),
      sentTo: this.formatParty(cao.displayName, 'CAO'),
      startedOn,
      completedOn: this.toIso(app.engineerSubmittedAt),
      comments: dto.engineerComments.trim() || '—',
      statusBefore,
      statusAfter: ApplicationStatus.SUBMITTED,
    });

    const saved = await this.applicationRepo.save(app);

    await this.notificationsService.create({
      userId: cao.userId,
      title: 'Application ready for review',
      message: `${saved.assignedEngineerName || 'Engineer'} submitted application ${saved.applicationNumber} (Site ${saved.siteNo}, Zone ${saved.zoneCode}). Please verify and decide.`,
      type: 'task_submitted',
      applicationId: saved.id,
      applicationNumber: saved.applicationNumber,
      linkPath: `/cao/tasks/${saved.id}`,
      createdBy: engineerUserId,
    });

    return saved;
  }

  private async assertAssignedCao(app: Application, caoUserId: string) {
    if (app.assignedCaoUserId !== caoUserId) {
      throw new ForbiddenException('This task is not assigned to you');
    }
    if (app.status !== ApplicationStatus.SUBMITTED) {
      throw new BadRequestException('Only submitted tasks can be reviewed');
    }
  }

  async caoVerify(
    id: string,
    caoUserId: string,
    remarks?: string,
  ): Promise<Application> {
    const app = await this.findOne(id);
    await this.assertAssignedCao(app, caoUserId);
    if (!remarks?.trim()) {
      throw new BadRequestException('Remarks are required when approving');
    }
    const statusBefore = app.status;
    const startedOn = this.toIso(app.engineerSubmittedAt || app.updatedAt);
    const comments = remarks.trim();
    app.status = ApplicationStatus.VERIFIED;
    app.caoRemarks = comments;
    app.caoReviewedAt = new Date();
    app.updatedBy = caoUserId;
    this.appendHistory(app, {
      taskName: 'CAO approved',
      performedBy: await this.formatActor(caoUserId, 'CAO'),
      sentTo: '—',
      startedOn,
      completedOn: this.toIso(app.caoReviewedAt),
      comments: comments || '—',
      statusBefore,
      statusAfter: ApplicationStatus.VERIFIED,
    });
    const saved = await this.applicationRepo.save(app);
    await this.notifyDecision(saved, caoUserId, 'verified');
    return saved;
  }

  async caoReturn(
    id: string,
    caoUserId: string,
    remarks: string,
  ): Promise<Application> {
    const app = await this.findOne(id);
    await this.assertAssignedCao(app, caoUserId);
    if (!remarks?.trim()) {
      throw new BadRequestException('Remarks are required when returning');
    }
    const statusBefore = app.status;
    const startedOn = this.toIso(app.engineerSubmittedAt || app.updatedAt);
    const comments = remarks.trim();
    const engLogin = (
      await this.usersService.resolveEngineerDisplayByIds([
        app.assignedEngineerUserId,
      ])
    ).get(app.assignedEngineerUserId)?.loginId;

    app.status = ApplicationStatus.RETURNED;
    app.caoRemarks = comments;
    app.caoReviewedAt = new Date();
    app.updatedBy = caoUserId;
    this.appendHistory(app, {
      taskName: 'Sent back to engineer',
      performedBy: await this.formatActor(caoUserId, 'CAO'),
      sentTo: this.formatParty(
        app.assignedEngineerName,
        'Engineer (for clarification)',
        engLogin,
      ),
      startedOn,
      completedOn: this.toIso(app.caoReviewedAt),
      comments,
      statusBefore,
      statusAfter: ApplicationStatus.RETURNED,
    });
    const saved = await this.applicationRepo.save(app);
    await this.notifyDecision(saved, caoUserId, 'returned');
    return saved;
  }

  async caoReject(
    id: string,
    caoUserId: string,
    remarks: string,
  ): Promise<Application> {
    const app = await this.findOne(id);
    await this.assertAssignedCao(app, caoUserId);
    if (!remarks?.trim()) {
      throw new BadRequestException('Remarks are required when rejecting');
    }
    const statusBefore = app.status;
    const startedOn = this.toIso(app.engineerSubmittedAt || app.updatedAt);
    const comments = remarks.trim();
    app.status = ApplicationStatus.REJECTED;
    app.caoRemarks = comments;
    app.caoReviewedAt = new Date();
    app.updatedBy = caoUserId;
    this.appendHistory(app, {
      taskName: 'CAO rejected',
      performedBy: await this.formatActor(caoUserId, 'CAO'),
      sentTo: '—',
      startedOn,
      completedOn: this.toIso(app.caoReviewedAt),
      comments,
      statusBefore,
      statusAfter: ApplicationStatus.REJECTED,
    });
    const saved = await this.applicationRepo.save(app);
    await this.notifyDecision(saved, caoUserId, 'rejected');
    return saved;
  }

  private async notifyDecision(
    app: Application,
    caoUserId: string,
    kind: 'verified' | 'returned' | 'rejected',
  ) {
    const caoName = app.assignedCaoName || 'CAO';
    const site = `application ${app.applicationNumber} (Site ${app.siteNo}, Zone ${app.zoneCode})`;

    const engineerPayload =
      kind === 'verified'
        ? {
            title: 'Application verified',
            message: `${caoName} verified and approved ${site}.`,
            type: 'task_verified',
          }
        : kind === 'returned'
          ? {
              title: 'Application returned for fixes',
              message: `${caoName} returned ${site}. Remarks: ${app.caoRemarks || '—'}`,
              type: 'task_returned',
            }
          : {
              title: 'Application rejected',
              message: `${caoName} rejected ${site}. Remarks: ${app.caoRemarks || '—'}`,
              type: 'task_rejected',
            };

    const zcPayload =
      kind === 'verified'
        ? {
            title: 'Application verified',
            message: `${caoName} verified ${site} submitted by ${app.assignedEngineerName || 'engineer'}.`,
            type: 'task_verified',
          }
        : kind === 'returned'
          ? {
              title: 'Application returned',
              message: `${caoName} returned ${site} to ${app.assignedEngineerName || 'engineer'} for fixes.`,
              type: 'task_returned',
            }
          : {
              title: 'Application rejected',
              message: `${caoName} rejected ${site} assigned to ${app.assignedEngineerName || 'engineer'}.`,
              type: 'task_rejected',
            };

    const recipients = [
      {
        userId: app.assignedEngineerUserId,
        linkPath: `/engineer/tasks/${app.id}`,
        ...engineerPayload,
      },
    ];

    if (
      app.createdByZcUserId &&
      app.createdByZcUserId !== app.assignedEngineerUserId
    ) {
      recipients.push({
        userId: app.createdByZcUserId,
        linkPath: `/admin/applications/${app.id}`,
        ...zcPayload,
      });
    }

    await this.notificationsService.createMany(
      recipients.map((r) => ({
        userId: r.userId,
        title: r.title,
        message: r.message,
        type: r.type,
        applicationId: app.id,
        applicationNumber: app.applicationNumber,
        linkPath: r.linkPath,
        createdBy: caoUserId,
      })),
    );
  }

  /** Zone context for the logged-in ZC (used by create form). */
  async myZoneContext(userId: string) {
    const ctx = await this.resolveUserZone(userId);
    const zone = await this.zoneRepo.findOne({ where: { id: ctx.zoneId } });
    return {
      zoneId: ctx.zoneId,
      zoneCode: ctx.zoneCode,
      zoneName: zone?.zoneName ?? ctx.zoneCode,
      engineers: await this.findEngineersByZone(ctx.zoneId),
    };
  }
}
