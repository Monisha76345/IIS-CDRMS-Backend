import { Column, Entity, PrimaryColumn } from 'typeorm';
import { BaseEntity } from '../../common/core/models/base.entity';

@Entity('master_country')
export class MasterCountry extends BaseEntity {
  @PrimaryColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  countryCode: string;

  @Column({ type: 'tinyint', default: 1 })
  activeYn: number;

  @Column({ type: 'int', default: 0 })
  version: number;
}
