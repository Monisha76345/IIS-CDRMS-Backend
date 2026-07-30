import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../common/core/models/base.entity';

@Entity('notifications')
export class Notification extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Recipient user id (engineer / CAO / ZC). */
  @Index()
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @Column({ type: 'varchar', length: 180 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  /**
   * Visual / semantic type:
   * task_assigned | task_submitted | task_verified | task_returned | task_rejected | general
   */
  @Column({ type: 'varchar', length: 40, default: 'general' })
  type: string;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'varchar', length: 36, nullable: true })
  applicationId: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  applicationNumber: string | null;

  /** Deep-link path for the recipient role, e.g. /engineer/tasks/:id */
  @Column({ type: 'varchar', length: 255, nullable: true })
  linkPath: string | null;
}
