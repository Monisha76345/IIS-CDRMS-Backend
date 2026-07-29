import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/core/models/base.entity';
import { Role } from '../../roles/entities/role.entity';

@Entity('post_details')
export class PostDetails extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Business code for the seat (e.g. POST00001). Uniqueness enforced in service. */
  @Column()
  postId: string;

  @Column()
  postName: string;

  @Column({ nullable: true })
  departmentName: string;

  @Column()
  roleId: number;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role: Role;

  /** Denormalized copy of Role.name for faster list UIs. */
  @Column({ nullable: true })
  roleName: string;

  @Column({ type: 'int', nullable: true })
  locationId: number | null;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  ofcAddress: string;

  @Column({ nullable: true })
  email: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  phoneNumber: string;

  @Column({ nullable: true })
  aliasName: string;

  /** FK → master_zones.id (CPMS-style zone for ZC / engineer scoping) */
  @Column({ type: 'int', nullable: true })
  zoneId: number | null;

  /** Denormalized master_zones.zone_code e.g. SOUTH */
  @Column({ type: 'varchar', length: 50, nullable: true })
  zoneCode: string | null;
}
