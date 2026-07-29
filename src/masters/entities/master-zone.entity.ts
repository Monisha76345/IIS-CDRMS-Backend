import { Column, Entity, PrimaryColumn } from 'typeorm';
import { BaseEntity } from '../../common/core/models/base.entity';

@Entity('master_zones')
export class MasterZone extends BaseEntity {
  @PrimaryColumn()
  id: number;

  @Column({ name: 'zone_code' })
  zoneCode: string;

  @Column({ name: 'zone_name' })
  zoneName: string;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @Column({ name: 'is_active', type: 'tinyint', default: 1 })
  isActive: number;
}
