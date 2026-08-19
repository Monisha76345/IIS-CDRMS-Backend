import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { getAuditContext } from './audit-context';
import { User } from '../admin/users/entities/user.entity';
import { PostDetails } from '../admin/users/entities/post-details.entity';
import { PersonalDetails } from '../admin/users/entities/personal-details.entity';
import { PostPersonMapping } from '../admin/users/entities/post-person-mapping.entity';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'UPLOAD'
  | 'DOWNLOAD'
  | 'SECURITY_REJECT'
  | 'POST_CREATED'
  | 'POST_UPDATED'
  | 'POST_DELETED'
  | 'PERSON_MAPPED'
  | 'PERSON_UNMAPPED'
  | 'PERSON_CREATED'
  | 'PERSON_UPDATED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'GEO_ASSIGNED'
  | 'ROLE_CREATED'
  | 'OTHER';

export interface CreateAuditLogInput {
  userId?: string | null;
  username?: string | null;
  module?: string;
  action: AuditAction | string;
  title?: string | null;
  meta?: Record<string, unknown> | string | null;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}

export interface ActivitySummaryItem {
  id: string;
  actionType: string;
  title: string;
  meta: string;
  userName: string | null;
  userId: string | null;
  createdAt: string;
}

export interface AuditLogQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  actionType?: string;
}

function formatUserRole(userType?: string | null): string {
  switch ((userType || '').toLowerCase()) {
    case 'super_admin':
      return 'Super Administrator';
    case 'zonal_commissioner':
      return 'Zonal Commissioner';
    case 'cao':
      return 'Chief Administrative Officer';
    case 'engineer':
      return 'Site Engineer';
    default:
      return 'User';
  }
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PostDetails)
    private readonly postDetailsRepo: Repository<PostDetails>,
    @InjectRepository(PersonalDetails)
    private readonly personalDetailsRepo: Repository<PersonalDetails>,
    @InjectRepository(PostPersonMapping)
    private readonly mappingRepo: Repository<PostPersonMapping>,
  ) {}

  async log(input: CreateAuditLogInput): Promise<void> {
    try {
      const ctx = getAuditContext();
      const userId = input.userId ?? ctx?.userId ?? null;
      const userName = input.username ?? ctx?.username ?? null;
      const ipAddress = input.ipAddress ?? ctx?.ipAddress ?? null;
      const userAgent = input.userAgent ?? ctx?.userAgent ?? null;

      const actionType = String(input.action || 'OTHER').slice(0, 255);
      const title =
        input.title?.slice(0, 255) ||
        `${actionType} ${input.module || 'app'}`.slice(0, 255);

      let metaStr: string;
      if (typeof input.meta === 'string') {
        metaStr = input.meta;
      } else if (input.meta && typeof input.meta === 'object') {
        metaStr = JSON.stringify(input.meta);
      } else {
        metaStr = JSON.stringify({
          module: input.module ?? null,
          method: input.method ?? null,
          path: input.path ?? null,
          statusCode: input.statusCode ?? null,
          ipAddress,
          userAgent: userAgent?.slice(0, 512) ?? null,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          oldValue: input.oldValue ?? null,
          newValue: input.newValue ?? null,
        });
      }

      const row = this.auditRepo.create({
        actionType,
        title,
        meta: metaStr,
        userId,
        userName,
        createdBy: userName ?? userId ?? null,
        updatedBy: userName ?? userId ?? null,
      });
      await this.auditRepo.save(row);
    } catch (err) {
      this.logger.warn(
        `Failed to write audit log: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async logActivity(input: {
    action: AuditAction | string;
    module?: string;
    title: string;
    meta?: Record<string, unknown> | string;
    entityType?: string;
    entityId?: string;
    userId?: string;
    username?: string;
  }): Promise<void> {
    return this.log({
      action: input.action,
      module: input.module || 'admin',
      title: input.title,
      meta: input.meta,
      entityType: input.entityType,
      entityId: input.entityId,
      userId: input.userId,
      username: input.username,
    });
  }

  async getRecentActivities(limit = 30): Promise<ActivitySummaryItem[]> {
    try {
      const logs = await this.auditRepo.find({
        order: { createdAt: 'DESC' },
        take: limit,
      });

      // Extract IDs to batch-resolve
      const postIds = new Set<string>();
      const personIds = new Set<string>();
      const mappingIds = new Set<number>();

      for (const l of logs) {
        if (!l.meta) continue;
        try {
          const parsed = JSON.parse(l.meta) as Record<string, unknown>;
          const path = String(parsed.path || '');
          const mapMatch = path.match(/\/mappings\/post\/([^\/]+)\/person\/([^\/]+)/i);
          if (mapMatch) {
            postIds.add(mapMatch[1]);
            personIds.add(mapMatch[2]);
          }
          const unmapMatch = path.match(/\/mappings\/(\d+)\/unmap/i);
          if (unmapMatch) {
            mappingIds.add(Number(unmapMatch[1]));
          }
        } catch {
          // ignore
        }
      }

      let postsList: PostDetails[] = [];
      let peopleList: PersonalDetails[] = [];
      let mappingsList: PostPersonMapping[] = [];
      let usersList: User[] = [];

      const promises: Promise<unknown>[] = [];

      if (postIds.size > 0) {
        promises.push(
          this.postDetailsRepo
            .find({ where: { id: In(Array.from(postIds)) } })
            .then((res) => (postsList = res)),
        );
      }
      if (personIds.size > 0) {
        promises.push(
          this.personalDetailsRepo
            .find({ where: { id: In(Array.from(personIds)) } })
            .then((res) => (peopleList = res)),
        );
      }
      if (mappingIds.size > 0) {
        promises.push(
          this.mappingRepo
            .find({
              where: { id: In(Array.from(mappingIds)) },
              relations: { post: true, person: true },
            })
            .then((res) => (mappingsList = res)),
        );
      }

      promises.push(this.userRepo.find().then((res) => (usersList = res)));

      await Promise.all(promises);

      const postMap = new Map<string, PostDetails>();
      for (const p of postsList) postMap.set(p.id, p);

      const personMap = new Map<string, PersonalDetails>();
      for (const p of peopleList) personMap.set(p.id, p);

      const mappingMap = new Map<number, PostPersonMapping>();
      for (const m of mappingsList) mappingMap.set(m.id, m);

      const userMap = new Map<string, User>();
      for (const u of usersList) {
        if (u.id) userMap.set(u.id.toLowerCase(), u);
        if (u.email) userMap.set(u.email.toLowerCase(), u);
        if (u.loginId) userMap.set(u.loginId.toLowerCase(), u);
      }

      return logs.map((l) => {
        let actionType = (l.actionType || 'OTHER').toUpperCase();
        let title = l.title || 'System Event';
        let metaDisplay = '';

        let parsed: Record<string, unknown> = {};
        if (l.meta) {
          try {
            parsed = JSON.parse(l.meta);
          } catch {
            // raw
          }
        }

        const path = String(parsed.path || '').toLowerCase();
        const nv = (parsed.newValue as Record<string, unknown>) || {};
        const lowerTitle = (l.title || '').toLowerCase();
        const lowerAction = actionType.toLowerCase();

        const mapMatch = ((parsed.path as string) || '').match(
          /\/mappings\/post\/([^\/]+)\/person\/([^\/]+)/i,
        );
        const unmapMatch = ((parsed.path as string) || '').match(
          /\/mappings\/(\d+)\/unmap/i,
        );

        // 1. Person Mapped (direct or via route)
        if (
          mapMatch ||
          lowerAction === 'person_mapped' ||
          lowerTitle.includes('mapped')
        ) {
          actionType = 'PERSON_MAPPED';
          title = 'Officer Mapped to Post';
          if (mapMatch) {
            const post = postMap.get(mapMatch[1]);
            const person = personMap.get(mapMatch[2]);
            const pName = person
              ? `${person.firstName || ''} ${person.lastName || ''}`.trim()
              : 'Officer';
            const pCode = person?.personUniqueId
              ? ` (${person.personUniqueId})`
              : '';
            const postTitle = post?.postName || 'Post';
            const postCode = post?.postId ? ` (${post.postId})` : '';
            const zone = post?.zoneCode ? ` · Zone ${post.zoneCode}` : '';
            metaDisplay = `${pName}${pCode} → ${postTitle}${postCode}${zone}`;
          } else {
            metaDisplay =
              (parsed.summary as string) ||
              (parsed.personName && parsed.postName
                ? `${parsed.personName} → ${parsed.postName}`
                : l.userName
                ? `Mapped by ${l.userName}`
                : 'Officer assigned to post');
          }
        }
        // 2. Person Unmapped
        else if (
          unmapMatch ||
          lowerAction === 'person_unmapped' ||
          lowerTitle.includes('unmap') ||
          path.includes('unmap')
        ) {
          actionType = 'PERSON_UNMAPPED';
          title = 'Officer Unmapped from Post';
          if (unmapMatch) {
            const m = mappingMap.get(Number(unmapMatch[1]));
            const pName = m?.person
              ? `${m.person.firstName || ''} ${m.person.lastName || ''}`.trim()
              : 'Officer';
            const postTitle = m?.post?.postName || 'post';
            metaDisplay = `${pName} relieved from ${postTitle}`;
          } else {
            metaDisplay =
              (parsed.summary as string) ||
              (parsed.personName
                ? `${parsed.personName} relieved from post`
                : 'Seat assignment released');
          }
        }
        // 3. Post Created
        else if (
          path.includes('/users/posts') ||
          lowerAction === 'post_created' ||
          lowerTitle.includes('posts')
        ) {
          actionType = 'POST_CREATED';
          title = 'New Post Created';
          const postName =
            (nv.postName as string) ||
            (parsed.postName as string) ||
            'New Post';
          const zone =
            (nv.zoneCode as string) || (parsed.zoneCode as string) || '';
          const role =
            (nv.roleName as string) || (parsed.roleName as string) || '';
          metaDisplay = `${postName}${zone ? ` · Zone ${zone}` : ''}${
            role ? ` (${role})` : ''
          }`;
        }
        // 4. Person Profile Created
        else if (
          path.includes('/users/people') ||
          lowerAction === 'person_created' ||
          lowerTitle.includes('people')
        ) {
          actionType = 'PERSON_CREATED';
          title = 'New Officer Profile Created';
          const pName = `${(nv.firstName as string) || ''} ${
            (nv.lastName as string) || ''
          }`.trim();
          const email = (nv.email as string) || (parsed.email as string) || '';
          metaDisplay = `${pName || 'Officer Profile'}${
            email ? ` · ${email}` : ''
          }`;
        }
        // 5. User Login
        else if (path.includes('/auth/login') || lowerAction === 'login' || lowerTitle.includes('login')) {
          actionType = 'LOGIN';
          const inputKey = (
            (nv.email as string) ||
            (l.userName as string) ||
            (l.userId as string) ||
            ''
          )
            .toLowerCase()
            .trim();
          const u =
            userMap.get(inputKey) ||
            (l.userId ? userMap.get(l.userId.toLowerCase()) : null);

          const name = u?.name || l.userName || 'User';
          const role = formatUserRole(u?.userType);
          const loginId = u?.loginId ? ` (${u.loginId})` : '';

          title = `${name} Logged In`;
          metaDisplay = `${role}${loginId} · Web Portal Session`;
        }
        // 6. User Logout
        else if (path.includes('/auth/logout') || lowerAction === 'logout' || lowerTitle.includes('logout')) {
          actionType = 'LOGOUT';
          const inputKey = (
            (nv.email as string) ||
            (l.userName as string) ||
            (l.userId as string) ||
            ''
          )
            .toLowerCase()
            .trim();
          const u =
            userMap.get(inputKey) ||
            (l.userId ? userMap.get(l.userId.toLowerCase()) : null);

          const name = u?.name || l.userName || 'User';
          const role = formatUserRole(u?.userType);
          const loginId = u?.loginId ? ` (${u.loginId})` : '';

          title = `${name} Logged Out`;
          metaDisplay = `${role}${loginId} · Session ended`;
        }
        // 7. Role Created
        else if (
          path.includes('/users/roles') ||
          lowerAction === 'role_created'
        ) {
          actionType = 'ROLE_CREATED';
          title = 'New Role Created';
          metaDisplay =
            (parsed.summary as string) ||
            (nv.name as string) ||
            'Security RBAC role';
        }
        // 8. Fallback
        else {
          metaDisplay =
            (parsed.summary as string) || l.userName || 'System event';
        }

        return {
          id: l.id,
          actionType,
          title,
          meta: metaDisplay,
          userName: l.userName,
          userId: l.userId,
          createdAt: l.createdAt
            ? new Date(l.createdAt).toISOString()
            : new Date().toISOString(),
        };
      });
    } catch (err) {
      this.logger.warn(
        `Failed to fetch recent activities: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return [];
    }
  }

  async findAuditLogs(query: AuditLogQueryParams = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const qb = this.auditRepo
      .createQueryBuilder('a')
      .orderBy('a.createdAt', 'DESC');

    if (query.search?.trim()) {
      const s = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(a.title) LIKE :s OR LOWER(COALESCE(a.actionType, \'\')) LIKE :s OR LOWER(COALESCE(a.userName, \'\')) LIKE :s OR LOWER(COALESCE(a.meta, \'\')) LIKE :s)',
        { s },
      );
    }

    if (query.actionType?.trim() && query.actionType !== 'all') {
      qb.andWhere('a.actionType = :act', { act: query.actionType.trim() });
    }

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      items: items.map((l) => ({
        id: l.id,
        actionType: l.actionType,
        title: l.title,
        meta: l.meta,
        userId: l.userId,
        userName: l.userName,
        createdAt: l.createdAt
          ? new Date(l.createdAt).toISOString()
          : new Date().toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
