import { Column, Entity, PrimaryColumn } from 'typeorm';
import { BaseEntity } from '../../common/core/models/base.entity';

@Entity('master_district')
export class MasterDistrict extends BaseEntity {
  @PrimaryColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  stateId: number;

  @Column({ nullable: true })
  districtCode: string;

  @Column({ type: 'tinyint', default: 1 })
  activeYn: number;

  @Column({ type: 'int', default: 0 })
  version: number;
}
