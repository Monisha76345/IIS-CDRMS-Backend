import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { BaseEntity } from '../../common/core/models/base.entity';
import { MasterStatus } from '../enums/master-status.enum';

@Entity('geo_locations')
@Unique(['code'])
export class GeoLocation extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({
    type: 'enum',
    enum: MasterStatus,
    default: MasterStatus.ACTIVE,
  })
  status: MasterStatus;
}
