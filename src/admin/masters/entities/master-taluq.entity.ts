import { Column, Entity, PrimaryColumn } from 'typeorm';
import { BaseEntity } from '../../common/core/models/base.entity';

@Entity('master_taluq')
export class MasterTaluq extends BaseEntity {
  @PrimaryColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  districtId: number;

  @Column({ nullable: true })
  taluqCode: string;

  @Column({ type: 'tinyint', default: 1 })
  activeYn: number;

  @Column({ type: 'int', default: 0 })
  version: number;
}
