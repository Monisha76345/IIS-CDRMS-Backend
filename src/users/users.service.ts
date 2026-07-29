import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { User, UserStatus } from './entities/user.entity';
import { UserType } from './enums/user-types.enum';
import { MappingStatus, PersonStatus } from './enums/assignment-status';
import { Role } from '../roles/entities/role.entity';
import { PersonalDetails } from './entities/personal-details.entity';
import { PostDetails } from './entities/post-details.entity';
import { PostPersonMapping } from './entities/post-person-mapping.entity';
import * as bcrypt from 'bcrypt';

import { SeriesGeneratorService } from '../series-generator/series-generator.service';
import {
  normalizePagination,
  toPaginatedResult,
  type PaginatedResult,
  type PaginationInput,
} from '../common/pagination/pagination';
import {
  assertOptionalIndianMobile,
} from '../common/validators/indian-mobile';
import { rethrowServiceError } from '../common/utils/service-error';

/** Resolved PBAC chain: User.loginId → PersonalDetails → active mapping → Post → Role */
export type PositionContext = {
  person: PersonalDetails | null;
  mapping: PostPersonMapping | null;
  post: PostDetails | null;
  /** Role.code for guards; falls back to Role.name / User.userType */
  roleCode: string;
  /** Display / legacy field (Role.name or User.userType) */
  roleName: string;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(PersonalDetails)
    private readonly personalDetailsRepository: Repository<PersonalDetails>,
    @InjectRepository(PostDetails)
    private readonly postDetailsRepository: Repository<PostDetails>,
    @InjectRepository(PostPersonMapping)
    private readonly mappingRepository: Repository<PostPersonMapping>,
    private readonly seriesGeneratorService: SeriesGeneratorService,
  ) {}

  private rethrow(error: unknown, fallbackMessage: string): never {
    rethrowServiceError(error, fallbackMessage, this.logger);
  }

  async findAllMappings(
    pagination: PaginationInput = {},
  ): Promise<PaginatedResult<PostPersonMapping>> {
    const { currentPage, itemsPerPage, skip, take } =
      normalizePagination(pagination);
    const search = pagination.search?.trim();

    const qb = this.mappingRepository
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.post', 'post')
      .leftJoinAndSelect('post.role', 'role')
      .leftJoinAndSelect('m.person', 'person')
      .orderBy('m.id', 'DESC')
      .skip(skip)
      .take(take);

    if (search) {
      const q = `%${search}%`;
      qb.andWhere(
        `(post.postName LIKE :q OR post.postId LIKE :q
          OR person.personUniqueId LIKE :q
          OR person.firstName LIKE :q OR person.lastName LIKE :q
          OR person.email LIKE :q
          OR CONCAT(COALESCE(person.firstName, ''), ' ', person.lastName) LIKE :q)`,
        { q },
      );
    }

    const [items, totalItems] = await qb.getManyAndCount();
    return toPaginatedResult(items, totalItems, currentPage, itemsPerPage);
  }

  /**
   * Date-effective active mapping for a person.
   * status=active AND startDate <= today AND (endDate IS NULL OR endDate >= today)
   */
  async findActiveAssignmentForPerson(
    personId: string,
  ): Promise<PostPersonMapping | null> {
    return this.mappingRepository
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.post', 'post')
      .leftJoinAndSelect('post.role', 'role')
      .leftJoinAndSelect('m.person', 'person')
      .where('m.personId = :personId', { personId })
      .andWhere('m.status = :status', { status: MappingStatus.ACTIVE })
      .andWhere('m.startDate <= CURDATE()')
      .andWhere('(m.endDate IS NULL OR m.endDate >= CURDATE())')
      .orderBy('m.startDate', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .getOne();
  }

  /** Active mapping for a post (with person + post details). */
  async findActiveMappingByPostId(postId: string): Promise<PostPersonMapping | null> {
    return this.mappingRepository
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.post', 'post')
      .leftJoinAndSelect('post.role', 'role')
      .leftJoinAndSelect('m.person', 'person')
      .where('m.postId = :postId', { postId })
      .andWhere('m.status = :status', { status: MappingStatus.ACTIVE })
      .andWhere('m.startDate <= CURDATE()')
      .andWhere('(m.endDate IS NULL OR m.endDate >= CURDATE())')
      .orderBy('m.startDate', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .getOne();
  }

  /**
   * Walk User → PersonalDetails (loginId = personUniqueId) → active mapping → Post → Role.
   * Role comes from PostDetails.role; falls back to User.userType when no assignment.
   */
  async resolvePositionContext(user: User): Promise<PositionContext> {
    let person: PersonalDetails | null = null;
    let mapping: PostPersonMapping | null = null;

    if (user.loginId) {
      person = await this.personalDetailsRepository.findOne({
        where: { personUniqueId: user.loginId },
      });
      const personOk =
        person &&
        (person.status == null || person.status === PersonStatus.ACTIVE);
      if (personOk) {
        mapping = await this.findActiveAssignmentForPerson(person!.id);
      } else {
        person = null;
      }
    }

    const post = mapping?.post ?? null;
    const role = post?.role;
    // Prefer Role.code; normalize name so "Estate Officer" → usable as estate_officer-like
    const roleCode = role?.code || role?.name || user.userType;
    const roleName = role?.name || role?.code || user.userType;

    return { person, mapping, post, roleCode, roleName };
  }

  /** Persons with no ACTIVE mapping (available to map). */
  async findUnmappedPersons(): Promise<PaginatedResult<PersonalDetails>> {
    const active = await this.mappingRepository
      .createQueryBuilder('m')
      .select('m.personId', 'personId')
      .where('m.status = :status', { status: MappingStatus.ACTIVE })
      .andWhere('m.startDate <= CURDATE()')
      .andWhere('(m.endDate IS NULL OR m.endDate >= CURDATE())')
      .getRawMany<{ personId: string }>();
    const mappedIds = [...new Set(active.map((m) => String(m.personId)))];
    const items =
      mappedIds.length === 0
        ? await this.personalDetailsRepository.find({
            where: { status: PersonStatus.ACTIVE },
            order: { createdAt: 'DESC' },
          })
        : await this.personalDetailsRepository.find({
            where: { id: Not(In(mappedIds)), status: PersonStatus.ACTIVE },
            order: { createdAt: 'DESC' },
          });
    return toPaginatedResult(items, items.length, 1, items.length || 10);
  }

  async findAllPosts(
    pagination: PaginationInput = {},
  ): Promise<PaginatedResult<PostDetails>> {
    const { currentPage, itemsPerPage, skip, take } =
      normalizePagination(pagination);
    const search = pagination.search?.trim();

    const qb = this.postDetailsRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.role', 'role')
      .orderBy('p.createdAt', 'DESC')
      .skip(skip)
      .take(take);

    if (search) {
      const q = `%${search}%`;
      qb.andWhere(
        `(p.postName LIKE :q OR p.postId LIKE :q OR p.roleName LIKE :q
          OR p.location LIKE :q OR p.email LIKE :q OR role.name LIKE :q)`,
        { q },
      );
    }

    const [posts, totalItems] = await qb.getManyAndCount();
    // Heal stale denormalized roleName so list/API always match Role
    for (const post of posts) {
      if (post.role?.name && post.roleName !== post.role.name) {
        post.roleName = post.role.name;
        await this.postDetailsRepository.update(
          { id: post.id },
          { roleName: post.role.name },
        );
      }
    }
    return toPaginatedResult(posts, totalItems, currentPage, itemsPerPage);
  }

  async findAllPeople(
    pagination: PaginationInput = {},
  ): Promise<PaginatedResult<PersonalDetails>> {
    const { currentPage, itemsPerPage, skip, take } =
      normalizePagination(pagination);
    const search = pagination.search?.trim();

    const qb = this.personalDetailsRepository
      .createQueryBuilder('p')
      .orderBy('p.createdAt', 'DESC')
      .skip(skip)
      .take(take);

    if (search) {
      const q = `%${search}%`;
      qb.andWhere(
        `(p.personUniqueId LIKE :q OR p.firstName LIKE :q OR p.lastName LIKE :q
          OR p.email LIKE :q OR p.mobileNumber LIKE :q
          OR p.department LIKE :q OR p.districtName LIKE :q
          OR CONCAT(COALESCE(p.firstName, ''), ' ', p.lastName) LIKE :q)`,
        { q },
      );
    }

    const [items, totalItems] = await qb.getManyAndCount();
    return toPaginatedResult(items, totalItems, currentPage, itemsPerPage);
  }

  async findAllRoles(
    pagination: PaginationInput = {},
  ): Promise<PaginatedResult<Role>> {
    const { currentPage, itemsPerPage, skip, take } =
      normalizePagination(pagination);
    const search = pagination.search?.trim();

    const qb = this.roleRepository
      .createQueryBuilder('r')
      .orderBy('r.id', 'ASC')
      .skip(skip)
      .take(take);

    if (search) {
      const q = `%${search}%`;
      qb.andWhere(
        `(r.name LIKE :q OR r.description LIKE :q OR CAST(r.id AS CHAR) LIKE :q)`,
        { q },
      );
    }

    const [items, totalItems] = await qb.getManyAndCount();
    return toPaginatedResult(items, totalItems, currentPage, itemsPerPage);
  }

  /** Normalize role label to machine key: "Case Worker" → "case_worker" */
  private toRoleKey(raw: string): string {
    return raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  async findRoleById(id: number): Promise<Role> {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async createRole(dto: {
    name: string;
    description?: string | null;
  }): Promise<Role> {
    try {
      const key = this.toRoleKey(dto.name || '');
      if (!key) {
        throw new BadRequestException('Role name is required');
      }

      const existing = await this.roleRepository.findOne({
        where: [{ name: key }, { code: key }],
      });
      if (existing) {
        throw new ConflictException(
          'Role name already exists. Please use a different name.',
        );
      }

      const role = this.roleRepository.create({
        name: key,
        code: key,
        description: dto.description?.trim() ? dto.description.trim() : undefined,
      });
      const saved = await this.roleRepository.save(role);
      return saved;
    } catch (error) {
      this.rethrow(error, 'Failed to create role');
    }
  }

  async updateRole(
    id: number,
    dto: { description?: string | null },
  ): Promise<Role> {
    try {
      const role = await this.findRoleById(id);
      // Role name/code are immutable — only privileges description may change.
      if (dto.description !== undefined) {
        const trimmed = dto.description?.trim() ?? '';
        role.description = trimmed ? trimmed : null;
      }
      return await this.roleRepository.save(role);
    } catch (error) {
      this.rethrow(error, 'Failed to update role');
    }
  }

  async mapPersonToPost(dto: {
    personId: string;
    postId: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<PostPersonMapping> {
    try {
      const person = await this.personalDetailsRepository.findOne({ where: { id: dto.personId } });
      if (!person) throw new NotFoundException('Physical officer profile not found');
      if (!person.personUniqueId) {
        throw new BadRequestException('Person must have a personUniqueId before mapping');
      }

      const post = await this.postDetailsRepository.findOne({
        where: { id: dto.postId },
        relations: {
          role: true,
        },
      });
      if (!post) throw new NotFoundException('Designation seat not found');

      if (person.status !== PersonStatus.ACTIVE) {
        throw new BadRequestException('Person profile is not active');
      }

      const samePair = await this.mappingRepository.findOne({
        where: {
          postId: post.id,
          personId: person.id,
          status: MappingStatus.ACTIVE,
        },
      });
      if (samePair) {
        throw new ConflictException('This person is already actively mapped to this post');
      }

      const personElsewhere = await this.findActiveAssignmentForPerson(person.id);
      if (personElsewhere) {
        throw new ConflictException(
          `This person is already actively mapped to another post (${personElsewhere.post?.postName || personElsewhere.postId})`,
        );
      }

      const postOccupied = await this.findActiveMappingByPostId(post.id);
      if (postOccupied) {
        throw new ConflictException(
          `This post already has an active mapping (${postOccupied.person?.personUniqueId || postOccupied.personId})`,
        );
      }

      const mapping = this.mappingRepository.create({
        postId: post.id,
        personId: person.id,
        startDate: dto.startDate || new Date(),
        endDate: dto.endDate,
        status: MappingStatus.ACTIVE,
      });

      const savedMapping = await this.mappingRepository.save(mapping);

      // Login identity: users.loginId = personal_details.personUniqueId
      // Clear this loginId from any other rows first (one loginId owner).
      await this.userRepository
        .createQueryBuilder()
        .update(User)
        .set({ loginId: null })
        .where('loginId = :loginId', { loginId: person.personUniqueId })
        .execute();

      let user = await this.userRepository.findOne({ where: { email: person.email } });

      if (!user) {
        const hash = await bcrypt.hash('Okay@123', 10);
        user = this.userRepository.create({
          name: `${person.firstName || ''} ${person.lastName}`.trim(),
          email: person.email,
          loginId: person.personUniqueId,
          aliasName: post.aliasName || null,
          password: hash,
          userType: (post.role?.code as UserType) || (post.role?.name as UserType) || UserType.ENGINEER,
          status: UserStatus.ACTIVE,
          isDeletable: true,
        });
      } else {
        user.loginId = person.personUniqueId;
        user.email = person.email || user.email;
        user.name = `${person.firstName || ''} ${person.lastName}`.trim() || user.name;
        user.aliasName = post.aliasName || user.aliasName;
        user.userType =
          (post.role?.code as UserType) ||
          (post.role?.name as UserType) ||
          user.userType;
        user.status = UserStatus.ACTIVE;
      }

      await this.userRepository.save(user);

      const full = await this.mappingRepository.findOne({
        where: { id: savedMapping.id },
        relations: { post: { role: true }, person: true },
      });
      if (!full) throw new NotFoundException('Mapping created but could not be reloaded');
      return full;
    } catch (error) {
      this.rethrow(error, 'Failed to map person to post');
    }
  }

  async unmapPersonFromPost(id: number): Promise<PostPersonMapping> {
    const mapping = await this.mappingRepository.findOne({
      where: { id },
      relations: {
        person: true,
        post: { role: true },
      },
    });
    if (!mapping) throw new NotFoundException('Seat mapping not found');
    if (mapping.status !== MappingStatus.ACTIVE) {
      throw new BadRequestException('Mapping is already inactive');
    }

    mapping.status = MappingStatus.INACTIVE;
    mapping.endDate = new Date();
    const saved = await this.mappingRepository.save(mapping);

    const person = mapping.person;
    if (person) {
      const user =
        (await this.userRepository.findOne({ where: { loginId: person.personUniqueId } })) ||
        (await this.userRepository.findOne({ where: { email: person.email } }));
      if (user && user.userType !== UserType.SUPER_ADMIN) {
        user.status = UserStatus.INACTIVE;
        user.loginId = null;
        await this.userRepository.save(user);
      }
    }

    return saved;
  }

  async findByIdentifier(identifier: string): Promise<User | null> {
    const value = identifier?.trim();
    if (!value) return null;

    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where(
        'user.email = :value OR user.loginId = :value OR user.aliasName = :value',
        { value },
      )
      .getOne();
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async touchLastLoggedIn(userId: string): Promise<void> {
    await this.userRepository.update(
      { id: userId },
      { lastLoggedIn: new Date() },
    );
  }

  async create(userData: Partial<User>): Promise<User> {
    try {
      if (!userData.password) {
        throw new BadRequestException('Password is required');
      }
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const user = this.userRepository.create({
        name: userData.name,
        email: userData.email,
        loginId: userData.loginId,
        password: hashedPassword,
        userType: UserType.ENGINEER,
        status: UserStatus.ACTIVE,
        isDeletable: true,
      });
      return await this.userRepository.save(user);
    } catch (error) {
      this.rethrow(error, 'Failed to create user');
    }
  }

  private normalizePersonMobile(value: unknown): string | undefined {
    try {
      const normalized = assertOptionalIndianMobile(value, 'Mobile number');
      return normalized ?? undefined;
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error
          ? e.message
          : 'Mobile number must be exactly 10 digits and start with 6, 7, 8, or 9',
      );
    }
  }

  private normalizePostPhone(value: unknown): string | undefined {
    try {
      const normalized = assertOptionalIndianMobile(value, 'Phone number');
      return normalized ?? undefined;
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error
          ? e.message
          : 'Phone number must be exactly 10 digits and start with 6, 7, 8, or 9',
      );
    }
  }

  async createPerson(dto: Partial<PersonalDetails>): Promise<PersonalDetails> {
    try {
      const payload = { ...dto };

      if (payload.mobileNumber !== undefined) {
        payload.mobileNumber = this.normalizePersonMobile(payload.mobileNumber) as string;
      }

      if (!payload.personUniqueId) {
        // Same series as login IDs: users.loginId will equal this when mapped to a post
        payload.personUniqueId = await this.seriesGeneratorService.generateAndSavePrefix(
          'CDRMS',
          5,
        );
      }

      if (!payload.state) payload.state = 'Karnataka';
      if (!payload.status) payload.status = PersonStatus.ACTIVE;

      const person = this.personalDetailsRepository.create(payload);
      return await this.personalDetailsRepository.save(person);
    } catch (error) {
      this.rethrow(error, 'Failed to create person details');
    }
  }

  async createPost(dto: Partial<PostDetails>): Promise<PostDetails> {
    try {
      const payload = { ...dto };

      if (payload.phoneNumber !== undefined) {
        payload.phoneNumber = this.normalizePostPhone(payload.phoneNumber) as string;
      }

      if (!payload.postId) {
        // Keep series in sync with highest existing POST##### (avoids duplicate key)
        const raw = await this.postDetailsRepository
          .createQueryBuilder('p')
          .select(
            `MAX(CAST(SUBSTRING(p.postId, ${'POST'.length + 1}) AS UNSIGNED))`,
            'maxNum',
          )
          .where('p.postId LIKE :pattern', { pattern: 'POST%' })
          .getRawOne<{ maxNum: string | null }>();
        const maxNum = Number(raw?.maxNum || 0);
        await this.seriesGeneratorService.ensureAtLeast('POST', maxNum, 5);
        payload.postId = await this.seriesGeneratorService.generateAndSavePrefix(
          'POST',
          5,
        );
      }

      if (payload.roleId) {
        const role = await this.roleRepository.findOne({
          where: { id: Number(payload.roleId) },
        });
        if (!role) {
          throw new BadRequestException(`Role id ${payload.roleId} not found`);
        }
        payload.roleName = role.name;
      }

      const post = this.postDetailsRepository.create(payload);
      return await this.postDetailsRepository.save(post);
    } catch (error) {
      this.rethrow(error, 'Failed to create post details');
    }
  }

  async findPersonById(id: string): Promise<PersonalDetails> {
    const person = await this.personalDetailsRepository.findOne({ where: { id } });
    if (!person) throw new NotFoundException('Officer profile not found');
    return person;
  }

  async updatePerson(id: string, dto: Partial<PersonalDetails>): Promise<PersonalDetails> {
    try {
      const person = await this.findPersonById(id);
      const previousUniqueId = person.personUniqueId;
      const previousEmail = person.email;

      const payload = { ...dto };
      if (payload.mobileNumber !== undefined) {
        payload.mobileNumber = this.normalizePersonMobile(
          payload.mobileNumber,
        ) as string;
      }

      Object.assign(person, payload);
      const saved = await this.personalDetailsRepository.save(person);

      // Keep User.loginId = PersonalDetails.personUniqueId in sync
      const user =
        (await this.userRepository.findOne({ where: { loginId: previousUniqueId } })) ||
        (await this.userRepository.findOne({ where: { email: previousEmail } }));
      if (user) {
        user.loginId = saved.personUniqueId;
        user.email = saved.email || user.email;
        user.name = `${saved.firstName || ''} ${saved.lastName}`.trim() || user.name;
        await this.userRepository.save(user);
      }

      return saved;
    } catch (error) {
      this.rethrow(error, 'Failed to update person details');
    }
  }

  async deletePerson(id: string): Promise<void> {
    const person = await this.findPersonById(id);

    const activeMappings = await this.mappingRepository.find({
      where: { personId: person.id, status: MappingStatus.ACTIVE },
    });
    for (const mapping of activeMappings) {
      await this.unmapPersonFromPost(mapping.id);
    }

    const user =
      (await this.userRepository.findOne({
        where: { loginId: person.personUniqueId },
      })) ||
      (await this.userRepository.findOne({ where: { email: person.email } }));
    if (user && user.userType !== UserType.SUPER_ADMIN) {
      user.status = UserStatus.INACTIVE;
      user.loginId = null;
      await this.userRepository.save(user);
    }

    await this.personalDetailsRepository.remove(person);
  }

  async findPostById(id: string): Promise<PostDetails> {
    const post = await this.postDetailsRepository.findOne({
      where: { id },
      relations: { role: true },
    });
    if (!post) throw new NotFoundException('Designation seat not found');
    if (post.role?.name && post.roleName !== post.role.name) {
      post.roleName = post.role.name;
      await this.postDetailsRepository.update(
        { id: post.id },
        { roleName: post.role.name },
      );
    }
    return post;
  }

  async updatePost(id: string, dto: Partial<PostDetails>): Promise<PostDetails> {
    try {
      const post = await this.findPostById(id);
      const previousRoleId = post.roleId;

      if (dto.postName !== undefined) post.postName = String(dto.postName).trim();
      if (dto.departmentName !== undefined) {
        post.departmentName = String(dto.departmentName).trim();
      }
      if (dto.location !== undefined) post.location = String(dto.location).trim();
      if (dto.ofcAddress !== undefined) {
        post.ofcAddress = String(dto.ofcAddress).trim();
      }
      if (dto.email !== undefined) post.email = String(dto.email).trim();
      if (dto.phoneNumber !== undefined) {
        post.phoneNumber = this.normalizePostPhone(dto.phoneNumber) as string;
      }
      if (dto.aliasName !== undefined) {
        post.aliasName = dto.aliasName ? String(dto.aliasName).trim() : (null as any);
      }
      if (dto.locationId !== undefined) {
        post.locationId = dto.locationId == null ? null : Number(dto.locationId);
      }

      if (dto.roleId != null) {
        const roleId = Number(dto.roleId);
        const role = await this.roleRepository.findOne({ where: { id: roleId } });
        if (!role) {
          throw new BadRequestException(`Role id ${dto.roleId} not found`);
        }
        post.roleId = roleId;
        post.roleName = role.name; // always overwrite denormalized cache
        post.role = role;

        if (roleId !== previousRoleId) {
          const active = await this.findActiveMappingByPostId(post.id);
          if (active?.person) {
            const user = await this.userRepository.findOne({
              where: { loginId: active.person.personUniqueId },
            });
            if (user && user.userType !== UserType.SUPER_ADMIN) {
              user.userType = role.name as UserType;
              await this.userRepository.save(user);
            }
          }
        }
      }

      await this.postDetailsRepository.save(post);
      return await this.findPostById(id);
    } catch (error) {
      this.rethrow(error, 'Failed to update post details');
    }
  }

  async deletePost(id: string): Promise<void> {
    const post = await this.findPostById(id);

    const activeMappings = await this.mappingRepository.find({
      where: { postId: post.id, status: MappingStatus.ACTIVE },
    });
    for (const mapping of activeMappings) {
      await this.unmapPersonFromPost(mapping.id);
    }

    await this.postDetailsRepository.remove(post);
  }

  async findAll(
    pagination: PaginationInput = {},
  ): Promise<PaginatedResult<User>> {
    const { currentPage, itemsPerPage, skip, take } =
      normalizePagination(pagination);
    const [items, totalItems] = await this.userRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return toPaginatedResult(items, totalItems, currentPage, itemsPerPage);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    if (!user.isDeletable || user.userType === UserType.SUPER_ADMIN) {
      throw new ForbiddenException('Super Admin and non-deletable users cannot be deleted!');
    }

    await this.userRepository.remove(user);
  }
}
