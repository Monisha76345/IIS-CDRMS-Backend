import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transactional } from 'typeorm-transactional';
import { Application } from './entities/application.entity';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateZcApplicationDto } from './dto/update-zc-application.dto';
import { EngineerSubmitApplicationDto } from './dto/engineer-submit.dto';
import { EngineerDraftApplicationDto } from './dto/engineer-draft.dto';
import { ApplicationStatus, OccupancyStatus } from './enums/application.enums';
import { SeriesGeneratorService } from '../admin/series-generator/series-generator.service';
import { UsersService } from '../admin/users/users.service';
import { UserType } from '../admin/users/enums/user-types.enum';
import { MasterZone } from '../admin/masters/entities/master-zone.entity';
import { MastersService } from '../admin/masters/masters.service';
import { AttributeMasterType } from '../admin/masters/enums/attribute-master-type.enum';
import { MasterStatus } from '../admin/masters/enums/master-status.enum';
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
    private readonly mastersService: MastersService,
  ) {}

  private toIso(value?: Date | string | null): string {
    if (!value) return new Date().toISOString();
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }

  /** City / state defaults — env-backed, not client-editable. */
  getAddressDefaults() {
    const city =
      process.env.APPLICATION_DEFAULT_CITY?.trim() || 'Bangalore';
    const state =
      process.env.APPLICATION_DEFAULT_STATE?.trim() || 'Karnataka';
    return {
      city,
      state,
      cityLocked: true as const,
      stateLocked: true as const,
    };
  }

  /**
   * Write engineer N/S/E/W into engineerDimensions (JSON) and keep dim* columns in sync.
   * Never touches ZC siteDimension.
   */
  private applyEngineerDimensions(
    app: Application,
    dims: Partial<Record<'N' | 'S' | 'E' | 'W', string | undefined>>,
    opts?: { requireAll?: boolean },
  ) {
    const prev =
      app.engineerDimensions && typeof app.engineerDimensions === 'object'
        ? { ...app.engineerDimensions }
        : ({} as Record<string, string>);

    for (const side of ['N', 'S', 'E', 'W'] as const) {
      const raw = dims[side];
      if (raw === undefined) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) {
        throw new BadRequestException('Site dimensions must be positive numbers');
      }
      prev[side] = String(n);
    }

    if (opts?.requireAll) {
      for (const side of ['N', 'S', 'E', 'W'] as const) {
        const n = Number(prev[side]);
        if (!Number.isFinite(n) || n <= 0) {
          throw new BadRequestException('Site dimensions must be positive numbers');
        }
      }
    }

    app.engineerDimensions = prev;
    if (prev.N != null) app.dimNorth = prev.N;
    if (prev.S != null) app.dimSouth = prev.S;
    if (prev.E != null) app.dimEast = prev.E;
    if (prev.W != null) app.dimWest = prev.W;
  }

  private normalizeEngineerGeoAddress(
    raw: object | null | undefined,
  ): Record<string, string | number | null> | null {
    if (!raw || typeof raw !== 'object') return null;
    const src = raw as Record<string, unknown>;
    const pick = (key: string) => {
      const v = src[key];
      if (v == null) return undefined;
      const s = String(v).trim();
      return s || undefined;
    };
    const out: Record<string, string | number | null> = {};
    for (const key of [
      'displayName',
      'village',
      'taluk',
      'district',
      'state',
      'street',
      'name',
      'layoutName',
      'area',
      'block',
      'postalCode',
      'country',
    ] as const) {
      const v = pick(key);
      if (v !== undefined) out[key] = v;
    }
    const accuracy = Number(src.accuracy);
    if (Number.isFinite(accuracy)) out.accuracy = accuracy;
    return Object.keys(out).length ? out : null;
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

  @Transactional()
  /** ZC create-application flow — site dimension master (uses APPLICATION:ADD, not MASTER:ADD). */
  async createSiteDimension(label: string) {
    const normalized = label.trim().replace(/\s+/g, '');
    if (!/^\d+(\*\d+)+$/.test(normalized)) {
      throw new BadRequestException(
        'Enter dimensions like 20*40 or 20*40*50*40',
      );
    }
    const code = `DIM-${normalized.replace(/\*/g, 'x').replace(/[^\w]/g, '')}`.slice(
      0,
      50,
    );
    return this.mastersService.createAttributeMaster({
      type: AttributeMasterType.SITE_DIMENSION,
      label: normalized,
      code,
      status: MasterStatus.ACTIVE,
    });
  }

  async create(zcUserId: string, dto: CreateApplicationDto): Promise<Application> {
    const zc = await this.resolveUserZone(zcUserId);
    const assigned = await this.resolveAssignedEngineer(
      zc.zoneId,
      dto.assignedEngineerUserId,
    );

    const eOfficeNumber = dto.eOfficeNumber.trim();
    if (!eOfficeNumber) {
      throw new BadRequestException('E-office number is required');
    }
    await this.assertUniqueEOfficeNumber(eOfficeNumber);

    const prefix = `ZC-${zc.zoneCode}-AUC-`;
    const applicationNumber = await this.seriesGenerator.generateAndSavePrefix(
      prefix,
      4,
    );

    const app = this.applicationRepo.create({
      applicationNumber,
      zoneId: zc.zoneId,
      zoneCode: zc.zoneCode,
      createdByZcUserId: zcUserId,
      createdByZcName: zc.displayName,
      status: dto.saveAsDraft
        ? ApplicationStatus.DRAFT
        : ApplicationStatus.ASSIGNED,
      createdBy: zcUserId,
    });

    this.applyZcFormFields(app, dto, assigned);

    const saved = await this.applicationRepo.save(app);
    return saved;
  }

  async updateZcDraft(
    zcUserId: string,
    id: string,
    dto: UpdateZcApplicationDto,
  ): Promise<Application> {
    const zc = await this.resolveUserZone(zcUserId);
    const app = await this.findOne(id);
    this.assertZcCanEditDraft(app, zc.zoneId);

    const eOfficeNumber = dto.eOfficeNumber.trim();
    if (!eOfficeNumber) {
      throw new BadRequestException('E-office number is required');
    }
    await this.assertUniqueEOfficeNumber(eOfficeNumber, id);

    const assigned = await this.resolveAssignedEngineer(
      zc.zoneId,
      dto.assignedEngineerUserId,
    );
    this.applyZcFormFields(app, dto, assigned);
    app.updatedBy = zcUserId;
    return this.applicationRepo.save(app);
  }

  async submitZcDraft(
    zcUserId: string,
    id: string,
    dto: UpdateZcApplicationDto,
  ): Promise<Application> {
    const zc = await this.resolveUserZone(zcUserId);
    const app = await this.findOne(id);
    this.assertZcCanEditDraft(app, zc.zoneId);

    const eOfficeNumber = dto.eOfficeNumber.trim();
    if (!eOfficeNumber) {
      throw new BadRequestException('E-office number is required');
    }
    await this.assertUniqueEOfficeNumber(eOfficeNumber, id);

    const assigned = await this.resolveAssignedEngineer(
      zc.zoneId,
      dto.assignedEngineerUserId,
    );
    this.applyZcFormFields(app, dto, assigned);
    app.status = ApplicationStatus.ASSIGNED;
    app.updatedBy = zcUserId;
    return this.applicationRepo.save(app);
  }

  private async resolveAssignedEngineer(
    zoneId: number,
    engineerUserId: string,
  ): Promise<{ userId: string; name: string }> {
    const engineers = await this.findEngineersByZone(zoneId);
    const assigned = engineers.find((e) => e.userId === engineerUserId);
    if (!assigned?.userId) {
      throw new BadRequestException(
        'Assigned engineer must belong to your zone and have an active post mapping',
      );
    }
    return { userId: assigned.userId, name: assigned.name };
  }

  private async assertUniqueEOfficeNumber(
    eOfficeNumber: string,
    excludeId?: string,
  ) {
    const duplicate = await this.applicationRepo.findOne({
      where: { eOfficeNumber },
      select: { id: true, applicationNumber: true },
    });
    if (duplicate && duplicate.id !== excludeId) {
      throw new ConflictException(
        `E-office number "${eOfficeNumber}" is already used by ${duplicate.applicationNumber}`,
      );
    }
  }

  private assertZcCanEditDraft(app: Application, zoneId: number) {
    if (app.zoneId !== zoneId) {
      throw new ForbiddenException('Application is outside your zone');
    }
    if (app.status !== ApplicationStatus.DRAFT) {
      throw new BadRequestException('Only draft applications can be edited');
    }
  }

  private applyZcFormFields(
    app: Application,
    dto: CreateApplicationDto | UpdateZcApplicationDto,
    assigned: { userId: string; name: string },
  ) {
    const defaults = this.getAddressDefaults();
    app.eOfficeNumber = dto.eOfficeNumber.trim();
    app.siteNo = dto.siteNo.trim();
    app.addressLine1 = dto.addressLine1.trim();
    app.addressLine2 = dto.addressLine2?.trim() || null;
    app.addressBlock = dto.addressBlock.trim();
    // Always stamp from server — ignore any client-sent city/state.
    app.addressCity = defaults.city;
    app.addressState = defaults.state;
    app.addressPincode = dto.addressPincode.trim();
    app.siteDimensionType = dto.siteDimensionType;
    app.siteDimension = dto.siteDimension.trim();
    app.siteDimensionComment = dto.siteDimensionComment?.trim() || null;
    app.scheduleNorth = dto.scheduleNorth?.trim() || null;
    app.scheduleSouth = dto.scheduleSouth?.trim() || null;
    app.scheduleWest = dto.scheduleWest?.trim() || null;
    app.scheduleEast = dto.scheduleEast?.trim() || null;
    app.assignedEngineerUserId = dto.assignedEngineerUserId;
    app.assignedEngineerName = assigned.name;
  }

  async listMine(
    userId: string,
    as: 'zc' | 'engineer' | 'cao',
    queue: 'open' | 'all' = 'all',
    options?: { search?: string; status?: string; zone?: string; page?: number; limit?: number },
  ): Promise<Application[]> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const roleStr = String(user.userType || '').toLowerCase();
    const isSuperAdmin =
      roleStr.includes('super_admin') || user.userType === UserType.SUPER_ADMIN;

    /**
     * List views must NOT select heavy JSON/text blobs (history, photo URLs, etc.).
     * Loading full rows + ORDER BY caused MySQL ER_OUT_OF_SORTMEMORY (1038).
     */
    const listSelect = {
      id: true,
      applicationNumber: true,
      eOfficeNumber: true,
      siteNo: true,
      addressLine1: true,
      addressLine2: true,
      addressBlock: true,
      addressCity: true,
      addressState: true,
      addressPincode: true,
      siteDimensionType: true,
      siteDimension: true,
      scheduleNorth: true,
      scheduleSouth: true,
      scheduleWest: true,
      scheduleEast: true,
      zoneId: true,
      zoneCode: true,
      assignedEngineerUserId: true,
      assignedEngineerName: true,
      createdByZcUserId: true,
      createdByZcName: true,
      assignedCaoUserId: true,
      assignedCaoName: true,
      status: true,
      compass: true,
      latitude: true,
      longitude: true,
      engineerGeoAddress: true,
      occupancy: true,
      dimNorth: true,
      dimSouth: true,
      dimEast: true,
      dimWest: true,
      totalSiteArea: true,
      selfieUrl: true,
      engineerSubmittedAt: true,
      engineerDimensions: true,
      engineerSiteDetails: true,
      createdAt: true,
      updatedAt: true,
      createdBy: true,
      updatedBy: true,
      // Explicitly omitted: history, photoUrls, schedulePhotoUrls, videoUrl,
      // engineerScheduleNotes, scheduleRoadFlags,
      // engineerComments, occupancyReason, siteDimensionComment
    } as const;

    let apps: Application[];

    if (isSuperAdmin) {
      apps = await this.applicationRepo.find({
        select: listSelect as any,
        order: { createdAt: 'DESC' },
        take: 1000,
      });
    } else if (as === 'cao' || roleStr.includes('cao')) {
      const caoZone = await this.resolveUserZone(userId);
      apps = await this.applicationRepo.find({
        select: listSelect as any,
        where: [
          { zoneId: caoZone.zoneId },
          { assignedCaoUserId: userId },
        ],
        order: { engineerSubmittedAt: 'DESC', createdAt: 'DESC' },
        take: 1000,
      });
    } else if (as === 'engineer' || roleStr.includes('engineer')) {
      apps = await this.applicationRepo.find({
        select: listSelect as any,
        where: { assignedEngineerUserId: userId },
        order: { createdAt: 'DESC' },
        take: 1000,
      });
    } else {
      const zcZone = await this.resolveUserZone(userId);
      apps = await this.applicationRepo.find({
        select: listSelect as any,
        where: { zoneId: zcZone.zoneId },
        order: { createdAt: 'DESC' },
        take: 1000,
      });
    }

    if (queue === 'open') {
      if (as === 'engineer' || roleStr.includes('engineer')) {
        apps = apps.filter(
          (a) =>
            a.status === ApplicationStatus.ASSIGNED ||
            a.status === ApplicationStatus.IN_PROGRESS,
        );
      } else if (as === 'cao' || roleStr.includes('cao')) {
        apps = apps.filter((a) => a.status === ApplicationStatus.SUBMITTED);
      }
    }

    if (as === 'engineer' || roleStr.includes('engineer')) {
      apps = apps.filter((a) => a.status !== ApplicationStatus.DRAFT);
    } else if (as === 'cao' || roleStr.includes('cao')) {
      // CAO only sees apps after site engineer submit — never assigned / in_progress.
      apps = apps.filter((a) => a.status === ApplicationStatus.SUBMITTED);
    }

    if (options?.status && options.status !== 'all') {
      const s = options.status.toLowerCase();
      apps = apps.filter((a) => String(a.status || '').toLowerCase() === s);
    }

    if (options?.zone && options.zone !== 'all') {
      const z = options.zone.toLowerCase();
      apps = apps.filter((a) => String(a.zoneCode || '').toLowerCase() === z);
    }

    if (options?.search) {
      const needle = options.search.toLowerCase();
      apps = apps.filter(
        (a) =>
          a.applicationNumber?.toLowerCase().includes(needle) ||
          a.siteNo?.toLowerCase().includes(needle) ||
          a.assignedEngineerName?.toLowerCase().includes(needle) ||
          a.addressLine1?.toLowerCase().includes(needle) ||
          a.addressBlock?.toLowerCase().includes(needle) ||
          a.addressCity?.toLowerCase().includes(needle) ||
          a.zoneCode?.toLowerCase().includes(needle) ||
          a.eOfficeNumber?.toLowerCase().includes(needle),
      );
    }

    if (options?.page && options?.limit && options.page > 0 && options.limit > 0) {
      const offset = (options.page - 1) * options.limit;
      apps = apps.slice(offset, offset + options.limit);
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
      submitted: apps.filter((a) => a.status === ApplicationStatus.SUBMITTED).length,
      total: apps.length,
    };
  }

  async findOne(id: string): Promise<Application> {
    const app = await this.applicationRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  /** Attach officer loginId + uploaded profile photo for UI (not DB columns). */
  private async withEngineerLogin(
    app: Application,
  ): Promise<
    Application & {
      assignedEngineerLoginId: string | null;
      assignedEngineerProfilePhoto: string | null;
      createdByZcLoginId: string | null;
      createdByZcProfilePhoto: string | null;
      assignedCaoLoginId: string | null;
      assignedCaoProfilePhoto: string | null;
    }
  > {
    const userIds = [
      app.assignedEngineerUserId,
      app.createdByZcUserId,
      app.assignedCaoUserId,
    ].filter(Boolean) as string[];
    const map = await this.usersService.resolveEngineerDisplayByIds(userIds);
    const engInfo = map.get(app.assignedEngineerUserId);
    const zcInfo = map.get(app.createdByZcUserId);
    const caoInfo = app.assignedCaoUserId ? map.get(app.assignedCaoUserId) : undefined;
    return Object.assign(app, {
      assignedEngineerLoginId: engInfo?.loginId ?? null,
      assignedEngineerProfilePhoto: engInfo?.profilePhoto ?? null,
      createdByZcLoginId: zcInfo?.loginId ?? null,
      createdByZcProfilePhoto: zcInfo?.profilePhoto ?? null,
      assignedCaoLoginId: caoInfo?.loginId ?? null,
      assignedCaoProfilePhoto: caoInfo?.profilePhoto ?? null,
    }) as any;
  }

  private async withEngineerLoginMany(apps: Application[]) {
    const userIds = [
      ...apps.map((a) => a.assignedEngineerUserId),
      ...apps.map((a) => a.createdByZcUserId),
      ...apps.map((a) => a.assignedCaoUserId),
    ].filter(Boolean) as string[];
    const map = await this.usersService.resolveEngineerDisplayByIds(userIds);
    return apps.map((app) => {
      const engInfo = map.get(app.assignedEngineerUserId);
      const zcInfo = map.get(app.createdByZcUserId);
      const caoInfo = app.assignedCaoUserId ? map.get(app.assignedCaoUserId) : undefined;
      return Object.assign(app, {
        assignedEngineerLoginId: engInfo?.loginId ?? null,
        assignedEngineerProfilePhoto: engInfo?.profilePhoto ?? null,
        createdByZcLoginId: zcInfo?.loginId ?? null,
        createdByZcProfilePhoto: zcInfo?.profilePhoto ?? null,
        assignedCaoLoginId: caoInfo?.loginId ?? null,
        assignedCaoProfilePhoto: caoInfo?.profilePhoto ?? null,
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
      app.status === ApplicationStatus.DRAFT &&
      app.assignedEngineerUserId === userId
    ) {
      throw new ForbiddenException('Application has not been submitted by ZC yet');
    }

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
    if (app.status === ApplicationStatus.DRAFT) {
      throw new BadRequestException('Application has not been submitted by ZC yet');
    }
    if (app.status === ApplicationStatus.SUBMITTED) {
      throw new BadRequestException('Application already submitted');
    }
    if (app.status === ApplicationStatus.ASSIGNED) {
      const statusBefore = app.status;
      const startedOn = this.toIso(app.updatedAt || app.createdAt);
      app.status = ApplicationStatus.IN_PROGRESS;
      app.updatedBy = engineerUserId;
      return this.applicationRepo.save(app);
    }
    return app;
  }

  /**
   * Persist partial engineer capture.
   * Only fields present on the DTO are updated; status becomes in_progress.
   */
  async saveEngineerDraft(
    id: string,
    engineerUserId: string,
    dto: EngineerDraftApplicationDto,
  ): Promise<Application> {
    const app = await this.findOne(id);
    if (app.assignedEngineerUserId !== engineerUserId) {
      throw new ForbiddenException('This task is not assigned to you');
    }
    if (app.status === ApplicationStatus.DRAFT) {
      throw new BadRequestException('Application has not been submitted by ZC yet');
    }
    if (app.status === ApplicationStatus.SUBMITTED) {
      throw new BadRequestException('Application already submitted');
    }

    if (app.status === ApplicationStatus.ASSIGNED) {
      app.status = ApplicationStatus.IN_PROGRESS;
    }

    if (dto.engineerSiteDetails !== undefined) {
      app.engineerSiteDetails = dto.engineerSiteDetails.trim();
    }
    if (dto.compass !== undefined) {
      app.compass = dto.compass.trim();
    }
    if (dto.latitude !== undefined) {
      app.latitude = dto.latitude;
    }
    if (dto.longitude !== undefined) {
      app.longitude = dto.longitude;
    }
    if (dto.engineerGeoAddress !== undefined) {
      app.engineerGeoAddress = this.normalizeEngineerGeoAddress(dto.engineerGeoAddress);
    }
    if (dto.occupancy !== undefined) {
      app.occupancy = dto.occupancy;
    }
    if (dto.occupancyReason !== undefined) {
      app.occupancyReason = dto.occupancyReason.trim() || null;
    }

    if (dto.engineerDimensions !== undefined) {
      this.applyEngineerDimensions(app, {
        N: dto.engineerDimensions.N,
        S: dto.engineerDimensions.S,
        E: dto.engineerDimensions.E,
        W: dto.engineerDimensions.W,
      });
    } else if (
      dto.dimNorth !== undefined ||
      dto.dimSouth !== undefined ||
      dto.dimEast !== undefined ||
      dto.dimWest !== undefined
    ) {
      // Legacy flat fields — still write into engineerDimensions + dim*.
      this.applyEngineerDimensions(app, {
        N: dto.dimNorth,
        S: dto.dimSouth,
        E: dto.dimEast,
        W: dto.dimWest,
      });
    }

    if (dto.totalSiteArea !== undefined && dto.totalSiteArea !== '') {
      app.totalSiteArea = dto.totalSiteArea;
    } else if (
      dto.engineerDimensions !== undefined ||
      dto.dimNorth !== undefined ||
      dto.dimSouth !== undefined ||
      dto.dimEast !== undefined ||
      dto.dimWest !== undefined
    ) {
      const n = Number(app.dimNorth);
      const s = Number(app.dimSouth);
      const e = Number(app.dimEast);
      const w = Number(app.dimWest);
      if ([n, s, e, w].every((v) => Number.isFinite(v) && v > 0)) {
        app.totalSiteArea = String(
          Number((((n + s) / 2) * ((e + w) / 2)).toFixed(2)),
        );
      }
    }

    if (dto.selfieUrl !== undefined) {
      app.selfieUrl = dto.selfieUrl.trim() || null;
    }
    if (dto.photoUrls !== undefined) {
      app.photoUrls = dto.photoUrls.length ? dto.photoUrls : [];
    }
    if (dto.schedulePhotoUrls !== undefined) {
      const prev =
        app.schedulePhotoUrls && typeof app.schedulePhotoUrls === 'object'
          ? { ...app.schedulePhotoUrls }
          : ({} as Record<string, string>);
      for (const side of ['N', 'S', 'E', 'W'] as const) {
        const v = dto.schedulePhotoUrls[side];
        if (v === undefined) continue;
        const trimmed = v.trim();
        if (trimmed) prev[side] = trimmed;
        else delete prev[side];
      }
      app.schedulePhotoUrls = Object.keys(prev).length ? prev : null;
    }
    // ZC scheduleNorth… are intentionally not overwritten by engineer draft.
    if (dto.engineerScheduleNotes !== undefined) {
      const prev =
        app.engineerScheduleNotes && typeof app.engineerScheduleNotes === 'object'
          ? { ...app.engineerScheduleNotes }
          : ({} as Record<string, string>);
      for (const side of ['N', 'S', 'E', 'W'] as const) {
        const v = dto.engineerScheduleNotes[side];
        if (v !== undefined) prev[side] = v.trim();
      }
      app.engineerScheduleNotes = prev;
    }
    if (dto.scheduleRoadFlags !== undefined) {
      const prev =
        app.scheduleRoadFlags && typeof app.scheduleRoadFlags === 'object'
          ? { ...app.scheduleRoadFlags }
          : ({ N: false, S: false, E: false, W: false } as Record<string, boolean>);
      for (const side of ['N', 'S', 'E', 'W'] as const) {
        const v = dto.scheduleRoadFlags[side];
        if (v !== undefined) prev[side] = Boolean(v);
      }
      app.scheduleRoadFlags = prev;
    }
    if (dto.videoUrl !== undefined) {
      app.videoUrl = dto.videoUrl.trim() || null;
    }
    if (dto.engineerComments !== undefined) {
      app.engineerComments = dto.engineerComments.trim();
    }

    app.updatedBy = engineerUserId;
    return this.applicationRepo.save(app);
  }

  @Transactional()
  async submitEngineer(
    id: string,
    engineerUserId: string,
    dto: EngineerSubmitApplicationDto,
  ): Promise<Application> {
    const app = await this.findOne(id);
    if (app.assignedEngineerUserId !== engineerUserId) {
      throw new ForbiddenException('This task is not assigned to you');
    }
    if (app.status === ApplicationStatus.DRAFT) {
      throw new BadRequestException('Application has not been submitted by ZC yet');
    }
    if (app.status === ApplicationStatus.SUBMITTED) {
      throw new BadRequestException('Application already submitted');
    }

    const dims = dto.engineerDimensions
      ? {
          N: dto.engineerDimensions.N,
          S: dto.engineerDimensions.S,
          E: dto.engineerDimensions.E,
          W: dto.engineerDimensions.W,
        }
      : {
          N: dto.dimNorth,
          S: dto.dimSouth,
          E: dto.dimEast,
          W: dto.dimWest,
        };
    this.applyEngineerDimensions(app, dims, { requireAll: true });

    const n = Number(app.dimNorth);
    const s = Number(app.dimSouth);
    const e = Number(app.dimEast);
    const w = Number(app.dimWest);

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

    const statusBefore = app.status;
    const startedOn = this.toIso(app.updatedAt || app.createdAt);

    app.engineerSiteDetails = dto.engineerSiteDetails?.trim() || null;
    app.compass = dto.compass.trim();
    app.latitude = dto.latitude;
    app.longitude = dto.longitude;
    if (dto.engineerGeoAddress !== undefined) {
      app.engineerGeoAddress = this.normalizeEngineerGeoAddress(dto.engineerGeoAddress);
    }
    app.occupancy = dto.occupancy;
    app.occupancyReason = dto.occupancyReason?.trim() || null;
    app.totalSiteArea = total;
    app.selfieUrl = dto.selfieUrl;
    app.photoUrls = dto.photoUrls?.length ? dto.photoUrls : [];
    app.schedulePhotoUrls = dto.schedulePhotoUrls
      ? { ...dto.schedulePhotoUrls }
      : null;
    if (dto.engineerScheduleNotes) {
      app.engineerScheduleNotes = {
        N: dto.engineerScheduleNotes.N?.trim() || '',
        S: dto.engineerScheduleNotes.S?.trim() || '',
        E: dto.engineerScheduleNotes.E?.trim() || '',
        W: dto.engineerScheduleNotes.W?.trim() || '',
      };
    }
    if (dto.scheduleRoadFlags) {
      app.scheduleRoadFlags = {
        N: Boolean(dto.scheduleRoadFlags.N),
        S: Boolean(dto.scheduleRoadFlags.S),
        E: Boolean(dto.scheduleRoadFlags.E),
        W: Boolean(dto.scheduleRoadFlags.W),
      };
    }
    app.videoUrl = dto.videoUrl;
    app.engineerComments = dto.engineerComments.trim();
    app.engineerSubmittedAt = new Date();
    if (cao?.userId) {
      app.assignedCaoUserId = cao.userId;
      app.assignedCaoName = cao.displayName || null;
    }
    app.status = ApplicationStatus.SUBMITTED;
    app.updatedBy = engineerUserId;

    const saved = await this.applicationRepo.save(app);

    if (cao?.userId) {
      await this.notificationsService.create({
        userId: cao.userId,
        title: 'Report submitted successfully',
        message: `Report for application ${saved.applicationNumber} (Site ${saved.siteNo}, Zone ${saved.zoneCode}) was submitted successfully by Engineer ${saved.assignedEngineerName || ''}.`,
        type: 'report_submitted',
        applicationId: saved.id,
        applicationNumber: saved.applicationNumber,
        linkPath: `/cao/applications/${saved.id}`,
        createdBy: engineerUserId,
      });
    }

    return saved;
  }

  /** Zone context for the logged-in ZC (used by create form). */
  async myZoneContext(userId: string, zoneId?: number) {
    if (zoneId != null && Number.isFinite(zoneId)) {
      const zone = await this.zoneRepo.findOne({ where: { id: zoneId } });
      if (zone && zone.isActive) {
        const zoneCode = (zone.zoneCode || '').trim().toUpperCase();
        return {
          zoneId: zone.id,
          zoneCode,
          zoneName: zone.zoneName ?? zoneCode,
          engineers: await this.findEngineersByZone(zone.id),
        };
      }
    }

    try {
      const ctx = await this.resolveUserZone(userId);
      const zone = await this.zoneRepo.findOne({ where: { id: ctx.zoneId } });
      return {
        zoneId: ctx.zoneId,
        zoneCode: ctx.zoneCode,
        zoneName: zone?.zoneName ?? ctx.zoneCode,
        engineers: await this.findEngineersByZone(ctx.zoneId),
      };
    } catch (err) {
      // Graceful fallback for Super Admin or non-mapped users
      const firstZone = await this.zoneRepo.findOne({
        where: { isActive: 1 },
        order: { id: 'ASC' },
      });
      if (firstZone) {
        const zCode = (firstZone.zoneCode || 'CENTRAL').trim().toUpperCase();
        return {
          zoneId: firstZone.id,
          zoneCode: zCode,
          zoneName: firstZone.zoneName ?? zCode,
          engineers: await this.findEngineersByZone(firstZone.id),
        };
      }
      return {
        zoneId: 0,
        zoneCode: 'CENTRAL',
        zoneName: 'Central Zone',
        engineers: [],
      };
    }
  }
}
