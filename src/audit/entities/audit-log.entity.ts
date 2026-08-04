import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseEntity } from '../../admin/common/core/models/base.entity';

/**
 * Matches live `audit_logs` table:
 * createdBy, createdAt, updatedBy, updatedAt, id, actionType, title, meta, userId, userName
 */
@Entity('audit_logs')
@Index('IDX_AUDIT_USER_CREATED', ['userId', 'createdAt'])
@Index('IDX_AUDIT_ACTION_TYPE', ['actionType'])
export class AuditLog extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  actionType: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  /** JSON string with request details (method, path, status, ip, body, …). */
  @Column({ type: 'text', nullable: true })
  meta: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userName: string | null;
}
