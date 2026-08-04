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
      const actionType = String(input.action || 'OTHER').slice(0, 255);
      const title = `${actionType} ${input.module || 'app'}`.slice(0, 255);
      const meta = JSON.stringify({
        module: input.module,
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

      const row = this.auditRepo.create({
        actionType,
        title,
        meta,
        userId: input.userId ?? null,
        userName: input.username ?? null,
        createdBy: input.username ?? input.userId ?? null,
        updatedBy: input.username ?? input.userId ?? null,
      });
      await this.auditRepo.save(row);
    } catch (err) {
      this.logger.warn(
        `Failed to write audit log: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
