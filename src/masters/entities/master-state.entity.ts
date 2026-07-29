import { Column, Entity, PrimaryColumn } from 'typeorm';
import { BaseEntity } from '../../common/core/models/base.entity';

@Entity('master_state')
export class MasterState extends BaseEntity {
  @PrimaryColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  stateCode: string;

  @Column()
  countryId: number;

  @Column({ type: 'tinyint', default: 1 })
  activeYn: number;

  @Column({ type: 'int', default: 0 })
  version: number;
}
