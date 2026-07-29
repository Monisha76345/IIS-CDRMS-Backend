import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { BaseEntity } from '../../common/core/models/base.entity';
import { ApplicationStatusCode } from '../enums/application-status-code.enum';
import { MasterStatus } from '../enums/master-status.enum';

@Entity('application_statuses')
@Unique(['code'])
export class ApplicationStatusEntity extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ApplicationStatusCode,
  })
  code: ApplicationStatusCode;

  @Column({ type: 'varchar', length: 100 })
  label: string;

  @Column({
    type: 'enum',
    enum: MasterStatus,
    default: MasterStatus.ACTIVE,
  })
  status: MasterStatus;

  @Column({ type: 'boolean', default: true })
  isSystem: boolean;
}
