import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { BaseEntity } from '../../common/core/models/base.entity';
import { MasterStatus } from '../enums/master-status.enum';

@Entity('villages')
@Unique(['code'])
@Index(['talukId'])
@Index(['districtId'])
export class Village extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'uuid' })
  talukId: string;

  @Column({ type: 'uuid' })
  districtId: string;

  @Column({
    type: 'enum',
    enum: MasterStatus,
    default: MasterStatus.ACTIVE,
  })
  status: MasterStatus;
}
