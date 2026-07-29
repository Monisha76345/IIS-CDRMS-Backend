import { Entity, PrimaryColumn, Column } from 'typeorm';
import { BaseEntity } from '../../common/core/models/base.entity';

@Entity('series_generator')
export class SeriesGenerator extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  prefix: string;

  @Column({ type: 'varchar', length: 50, default: '000001' })
  value: string;
}
