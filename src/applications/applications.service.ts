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
import { SeriesGeneratorService } from '../series-generator/series-generator.service';
import { UsersService } from '../users/users.service';
import { UserType } from '../users/enums/user-types.enum';
import { MasterZone } from '../masters/entities/master-zone.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(MasterZone)
    private readonly zoneRepo: Repository<MasterZone>,
    private readonly seriesGenerator: SeriesGeneratorService,
    private readonly usersService: UsersService,
  ) {}

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
    });

    return this.applicationRepo.save(app);
  }

  async listMine(
    userId: string,
    as: 'zc' | 'engineer' | 'cao',
  ): Promise<Application[]> {
    if (as === 'cao') {
      return this.applicationRepo.find({
        where: { assignedCaoUserId: userId },
        order: { engineerSubmittedAt: 'DESC', createdAt: 'DESC' },
      });
    }
    const where =
      as === 'zc'
        ? { createdByZcUserId: userId }
        : { assignedEngineerUserId: userId };
    return this.applicationRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
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

  async findOneAuthorized(id: string, userId: string, userType?: string) {
    const app = await this.findOne(id);
    const role = String(userType || '').toLowerCase();
    const isAdmin =
      role === UserType.SUPER_ADMIN ||
      role === 'super_admin' ||
      role.includes('super_admin');
    const isCao = role === UserType.CAO || role === 'cao';
    const allowed =
      isAdmin ||
      app.createdByZcUserId === userId ||
      app.assignedEngineerUserId === userId ||
      (isCao && app.assignedCaoUserId === userId);
    if (!allowed) {
      throw new ForbiddenException('You do not have access to this application');
    }
    return app;
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
      app.status = ApplicationStatus.IN_PROGRESS;
      app.updatedBy = engineerUserId;
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

    return this.applicationRepo.save(app);
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
    app.status = ApplicationStatus.VERIFIED;
    app.caoRemarks = remarks?.trim() || null;
    app.caoReviewedAt = new Date();
    app.updatedBy = caoUserId;
    return this.applicationRepo.save(app);
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
    app.status = ApplicationStatus.RETURNED;
    app.caoRemarks = remarks.trim();
    app.caoReviewedAt = new Date();
    app.updatedBy = caoUserId;
    return this.applicationRepo.save(app);
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
    app.status = ApplicationStatus.REJECTED;
    app.caoRemarks = remarks.trim();
    app.caoReviewedAt = new Date();
    app.updatedBy = caoUserId;
    return this.applicationRepo.save(app);
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
