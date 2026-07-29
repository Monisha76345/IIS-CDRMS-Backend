import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { BaseEntity } from '../../common/core/models/base.entity';

@Entity('roles')
export class Role extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** Machine code for guards / JWT (e.g. super_admin). Backfill via POST /public/roles/seed. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  code: string | null;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;
}
