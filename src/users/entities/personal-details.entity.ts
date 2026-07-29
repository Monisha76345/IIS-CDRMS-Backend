import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { BaseEntity } from '../../common/core/models/base.entity';
import { PersonStatus } from '../enums/assignment-status';

@Entity('personal_details')
export class PersonalDetails extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Link key: must match users.loginId when a login account exists. */
  @Column({ unique: true })
  personUniqueId: string;

  @Column({ nullable: true })
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  mobileNumber: string;

  @Column({ nullable: true })
  gender: string;

  @Column({ nullable: true, default: 'Karnataka' })
  state: string;

  @Column({ nullable: true })
  districtName: string;

  @Column({ type: 'int', nullable: true })
  districtId: number;

  /** Taluka / sub-district (column name kept as taluk* for existing DB/UI). */
  @Column({ nullable: true })
  talukName: string;

  @Column({ type: 'int', nullable: true })
  talukId: number;

  @Column({ nullable: true })
  department: string;

  @Column({ nullable: true })
  departmentId: string;

  @Column({
    type: 'enum',
    enum: PersonStatus,
    default: PersonStatus.ACTIVE,
    nullable: true,
  })
  status: PersonStatus;
}
