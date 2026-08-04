import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('audit_logs')
@Index('IDX_AUDIT_USER_CREATED', ['userId', 'createdAt'])
@Index('IDX_AUDIT_MODULE_ACTION', ['module', 'action'])
export class AuditLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 255, nullable: true })
  userId: string | null;

  @Column({ name: 'username', type: 'varchar', length: 255, nullable: true })
  username: string | null;

  @Column({ name: 'module', type: 'varchar', length: 128, nullable: false })
  module: string;

  @Column({ name: 'action', type: 'varchar', length: 64, nullable: false })
  action: string;

  @Column({ name: 'method', type: 'varchar', length: 16, nullable: true })
  method: string | null;

  @Column({ name: 'path', type: 'varchar', length: 512, nullable: true })
  path: string | null;

  @Column({ name: 'status_code', type: 'int', nullable: true })
  statusCode: number | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
  userAgent: string | null;

  @Column({ name: 'entity_type', type: 'varchar', length: 128, nullable: true })
  entityType: string | null;

  @Column({ name: 'entity_id', type: 'varchar', length: 128, nullable: true })
  entityId: string | null;

  @Column({ name: 'old_value', type: 'json', nullable: true })
  oldValue: Record<string, unknown> | null;

  @Column({ name: 'new_value', type: 'json', nullable: true })
  newValue: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
