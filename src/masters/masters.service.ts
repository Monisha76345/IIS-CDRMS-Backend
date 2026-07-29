import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  normalizePagination,
  toPaginatedResult,
  type PaginatedResult,
  type PaginationInput,
} from '../common/pagination/pagination';
import { rethrowServiceError } from '../common/utils/service-error';
import { GeoLocation } from './entities/geo-location.entity';
import { AttributeMaster } from './entities/attribute-master.entity';
import { ApplicationStatusEntity } from './entities/application-status.entity';
import { SystemParameter } from './entities/system-parameter.entity';
import { District } from './entities/district.entity';
import { Taluk } from './entities/taluk.entity';
import { Village } from './entities/village.entity';
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
} from './dto/masters.dto';

@Injectable()
export class MastersService {
  private readonly logger = new Logger(MastersService.name);

  constructor(
    @InjectRepository(GeoLocation)
    private readonly geoRepo: Repository<GeoLocation>,
    @InjectRepository(AttributeMaster)
    private readonly attrRepo: Repository<AttributeMaster>,
    @InjectRepository(ApplicationStatusEntity)
    private readonly statusRepo: Repository<ApplicationStatusEntity>,
    @InjectRepository(SystemParameter)
    private readonly paramRepo: Repository<SystemParameter>,
    @InjectRepository(District)
    private readonly districtRepo: Repository<District>,
    @InjectRepository(Taluk)
    private readonly talukRepo: Repository<Taluk>,
    @InjectRepository(Village)
    private readonly villageRepo: Repository<Village>,
  ) {}

  private rethrow(error: unknown, fallback: string): never {
    rethrowServiceError(error, fallback, this.logger);
  }

  // ── Geo locations ──────────────────────────────────────────

  async findGeoLocations(
    pagination: PaginationInput = {},
    status?: MasterStatus,
  ): Promise<PaginatedResult<GeoLocation>> {
    const { currentPage, itemsPerPage, skip, take } =
      normalizePagination(pagination);
    const search = pagination.search?.trim();
    const qb = this.geoRepo
      .createQueryBuilder('g')
      .orderBy('g.name', 'ASC')
      .skip(skip)
      .take(take);
    if (status) qb.andWhere('g.status = :status', { status });
    if (search) {
      qb.andWhere('(g.name LIKE :q OR g.code LIKE :q)', {
        q: `%${search}%`,
      });
    }
    const [items, totalItems] = await qb.getManyAndCount();
    return toPaginatedResult(items, totalItems, currentPage, itemsPerPage);
  }

  async createGeoLocation(dto: UpsertGeoLocationDto): Promise<GeoLocation> {
    try {
      const entity = this.geoRepo.create({
        ...dto,
        status: dto.status ?? MasterStatus.ACTIVE,
      });
      return await this.geoRepo.save(entity);
    } catch (error) {
      this.rethrow(error, 'Failed to create geo location');
    }
  }

  async updateGeoLocation(
    id: string,
    dto: Partial<UpsertGeoLocationDto>,
  ): Promise<GeoLocation> {
    try {
      const entity = await this.geoRepo.findOne({ where: { id } });
      if (!entity) throw new NotFoundException('Geo location not found');
      Object.assign(entity, dto);
      return await this.geoRepo.save(entity);
    } catch (error) {
      this.rethrow(error, 'Failed to update geo location');
    }
  }

  // ── Attribute masters ──────────────────────────────────────

  async findAttributeMasters(
    pagination: PaginationInput = {},
    type?: AttributeMasterType,
    status?: MasterStatus,
  ): Promise<PaginatedResult<AttributeMaster>> {
    const { currentPage, itemsPerPage, skip, take } =
      normalizePagination(pagination);
    const search = pagination.search?.trim();
    const qb = this.attrRepo
      .createQueryBuilder('a')
      .orderBy('a.type', 'ASC')
      .addOrderBy('a.label', 'ASC')
      .skip(skip)
      .take(take);
    if (type) qb.andWhere('a.type = :type', { type });
    if (status) qb.andWhere('a.status = :status', { status });
    if (search) {
      qb.andWhere('(a.label LIKE :q OR a.code LIKE :q)', {
        q: `%${search}%`,
      });
    }
    const [items, totalItems] = await qb.getManyAndCount();
    return toPaginatedResult(items, totalItems, currentPage, itemsPerPage);
  }

  async createAttributeMaster(
    dto: UpsertAttributeMasterDto,
  ): Promise<AttributeMaster> {
    try {
      const entity = this.attrRepo.create({
        ...dto,
        status: dto.status ?? MasterStatus.ACTIVE,
      });
      return await this.attrRepo.save(entity);
    } catch (error) {
      this.rethrow(error, 'Failed to create attribute master');
    }
  }

  async updateAttributeMaster(
    id: string,
    dto: Partial<UpsertAttributeMasterDto>,
  ): Promise<AttributeMaster> {
    try {
      const entity = await this.attrRepo.findOne({ where: { id } });
      if (!entity) throw new NotFoundException('Attribute master not found');
      Object.assign(entity, dto);
      return await this.attrRepo.save(entity);
    } catch (error) {
      this.rethrow(error, 'Failed to update attribute master');
    }
  }

  // ── Application statuses ───────────────────────────────────

  async findApplicationStatuses(): Promise<ApplicationStatusEntity[]> {
    return this.statusRepo.find({ order: { code: 'ASC' } });
  }

  async upsertApplicationStatus(
    dto: UpsertApplicationStatusDto,
  ): Promise<ApplicationStatusEntity> {
    try {
      let entity = await this.statusRepo.findOne({ where: { code: dto.code } });
      if (!entity) {
        entity = this.statusRepo.create({
          ...dto,
          status: dto.status ?? MasterStatus.ACTIVE,
          isSystem: true,
        });
      } else {
        entity.label = dto.label;
        if (dto.status) entity.status = dto.status;
      }
      return await this.statusRepo.save(entity);
    } catch (error) {
      this.rethrow(error, 'Failed to save application status');
    }
  }

  // ── System parameters ──────────────────────────────────────

  async findSystemParameters(): Promise<SystemParameter[]> {
    return this.paramRepo.find({ order: { key: 'ASC' } });
  }

  async updateSystemParameter(
    key: string,
    dto: UpsertSystemParameterDto,
  ): Promise<SystemParameter> {
    const entity = await this.paramRepo.findOne({ where: { key } });
    if (!entity) throw new NotFoundException(`Parameter "${key}" not found`);
    if (!dto.value?.trim()) {
      throw new BadRequestException('Parameter value is required');
    }
    entity.value = dto.value.trim();
    return this.paramRepo.save(entity);
  }

  // ── District / Taluk / Village ─────────────────────────────

  async findDistricts(
    pagination: PaginationInput = {},
    status?: MasterStatus,
  ): Promise<PaginatedResult<District>> {
    const { currentPage, itemsPerPage, skip, take } =
      normalizePagination(pagination);
    const search = pagination.search?.trim();
    const qb = this.districtRepo
      .createQueryBuilder('d')
      .orderBy('d.name', 'ASC')
      .skip(skip)
      .take(take);
    if (status) qb.andWhere('d.status = :status', { status });
    if (search) {
      qb.andWhere('(d.name LIKE :q OR d.code LIKE :q)', { q: `%${search}%` });
    }
    const [items, totalItems] = await qb.getManyAndCount();
    return toPaginatedResult(items, totalItems, currentPage, itemsPerPage);
  }

  async createDistrict(dto: UpsertDistrictDto): Promise<District> {
    try {
      return await this.districtRepo.save(
        this.districtRepo.create({
          ...dto,
          status: dto.status ?? MasterStatus.ACTIVE,
        }),
      );
    } catch (error) {
      this.rethrow(error, 'Failed to create district');
    }
  }

  async updateDistrict(
    id: string,
    dto: Partial<UpsertDistrictDto>,
  ): Promise<District> {
    try {
      const entity = await this.districtRepo.findOne({ where: { id } });
      if (!entity) throw new NotFoundException('District not found');
      Object.assign(entity, dto);
      return await this.districtRepo.save(entity);
    } catch (error) {
      this.rethrow(error, 'Failed to update district');
    }
  }

  async findTaluks(
    pagination: PaginationInput = {},
    districtId?: string,
    status?: MasterStatus,
  ): Promise<PaginatedResult<Taluk>> {
    const { currentPage, itemsPerPage, skip, take } =
      normalizePagination(pagination);
    const search = pagination.search?.trim();
    const qb = this.talukRepo
      .createQueryBuilder('t')
      .orderBy('t.name', 'ASC')
      .skip(skip)
      .take(take);
    if (districtId) qb.andWhere('t.districtId = :districtId', { districtId });
    if (status) qb.andWhere('t.status = :status', { status });
    if (search) {
      qb.andWhere('(t.name LIKE :q OR t.code LIKE :q)', { q: `%${search}%` });
    }
    const [items, totalItems] = await qb.getManyAndCount();
    return toPaginatedResult(items, totalItems, currentPage, itemsPerPage);
  }

  async createTaluk(dto: UpsertTalukDto): Promise<Taluk> {
    try {
      const district = await this.districtRepo.findOne({
        where: { id: dto.districtId },
      });
      if (!district) throw new BadRequestException('District not found');
      return await this.talukRepo.save(
        this.talukRepo.create({
          ...dto,
          status: dto.status ?? MasterStatus.ACTIVE,
        }),
      );
    } catch (error) {
      this.rethrow(error, 'Failed to create taluk');
    }
  }

  async updateTaluk(id: string, dto: Partial<UpsertTalukDto>): Promise<Taluk> {
    try {
      const entity = await this.talukRepo.findOne({ where: { id } });
      if (!entity) throw new NotFoundException('Taluk not found');
      if (dto.districtId) {
        const district = await this.districtRepo.findOne({
          where: { id: dto.districtId },
        });
        if (!district) throw new BadRequestException('District not found');
      }
      Object.assign(entity, dto);
      return await this.talukRepo.save(entity);
    } catch (error) {
      this.rethrow(error, 'Failed to update taluk');
    }
  }

  async findVillages(
    pagination: PaginationInput = {},
    talukId?: string,
    districtId?: string,
    status?: MasterStatus,
  ): Promise<PaginatedResult<Village>> {
    const { currentPage, itemsPerPage, skip, take } =
      normalizePagination(pagination);
    const search = pagination.search?.trim();
    const qb = this.villageRepo
      .createQueryBuilder('v')
      .orderBy('v.name', 'ASC')
      .skip(skip)
      .take(take);
    if (talukId) qb.andWhere('v.talukId = :talukId', { talukId });
    if (districtId) qb.andWhere('v.districtId = :districtId', { districtId });
    if (status) qb.andWhere('v.status = :status', { status });
    if (search) {
      qb.andWhere('(v.name LIKE :q OR v.code LIKE :q)', { q: `%${search}%` });
    }
    const [items, totalItems] = await qb.getManyAndCount();
    return toPaginatedResult(items, totalItems, currentPage, itemsPerPage);
  }

  async createVillage(dto: UpsertVillageDto): Promise<Village> {
    try {
      const taluk = await this.talukRepo.findOne({ where: { id: dto.talukId } });
      if (!taluk) throw new BadRequestException('Taluk not found');
      const district = await this.districtRepo.findOne({
        where: { id: dto.districtId },
      });
      if (!district) throw new BadRequestException('District not found');
      return await this.villageRepo.save(
        this.villageRepo.create({
          ...dto,
          status: dto.status ?? MasterStatus.ACTIVE,
        }),
      );
    } catch (error) {
      this.rethrow(error, 'Failed to create village');
    }
  }

  async updateVillage(
    id: string,
    dto: Partial<UpsertVillageDto>,
  ): Promise<Village> {
    try {
      const entity = await this.villageRepo.findOne({ where: { id } });
      if (!entity) throw new NotFoundException('Village not found');
      Object.assign(entity, dto);
      return await this.villageRepo.save(entity);
    } catch (error) {
      this.rethrow(error, 'Failed to update village');
    }
  }
}
