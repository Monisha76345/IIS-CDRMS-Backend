import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { BaseEntity } from '../../common/core/models/base.entity';
import { AttributeMasterType } from '../enums/attribute-master-type.enum';
import { MasterStatus } from '../enums/master-status.enum';

@Entity('attribute_masters')
@Unique(['type', 'code'])
@Index(['type', 'status'])
export class AttributeMaster extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: AttributeMasterType,
  })
  type: AttributeMasterType;

  @Column({ type: 'varchar', length: 150 })
  label: string;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({
    type: 'enum',
    enum: MasterStatus,
    default: MasterStatus.ACTIVE,
  })
  status: MasterStatus;
}
