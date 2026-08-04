import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'UPLOAD'
  | 'DOWNLOAD'
  | 'SECURITY_REJECT'
  | 'OTHER';

export interface CreateAuditLogInput {
  userId?: string | null;
  username?: string | null;
  module: string;
  action: AuditAction | string;
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

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async log(input: CreateAuditLogInput): Promise<void> {
    try {
      const row = this.auditRepo.create({
        userId: input.userId ?? null,
        username: input.username ?? null,
        module: input.module,
        action: String(input.action),
        method: input.method ?? null,
        path: input.path ?? null,
        statusCode: input.statusCode ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent?.slice(0, 512) ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        oldValue: input.oldValue ?? null,
        newValue: input.newValue ?? null,
      });
      await this.auditRepo.save(row);
    } catch (err) {
      this.logger.warn(
        `Failed to write audit log: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
