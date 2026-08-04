import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../common/core/models/base.entity';
import { UserType } from '../enums/user-types.enum';
import { UserStatus } from '../enums/user-status.enum';
import { UserTheme } from '../enums/user-theme.enum';

export { UserStatus } from '../enums/user-status.enum';

@Entity('users')
export class User extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: UserType,
  })
  userType: UserType;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.DRAFT,
  })
  status: UserStatus;

  @Column({ type: 'datetime', nullable: true })
  lastLoggedIn: Date;

  @Column({ type: 'datetime', nullable: true })
  lastLoggedOut: Date;

  @Column({ type: 'tinyint', default: 0 })
  changePasswordRequired: number;

  @Column({ type: 'datetime', nullable: true })
  lastPasswordChanged: Date;

  @Column({ type: 'tinyint', nullable: true })
  resetRequired: number;

  @Column({ type: 'tinyint', nullable: true })
  mobileVerification: number;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  loginId: string | null;

  @Column({ type: 'varchar', length: 255, select: false })
  password: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  randomPassword: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  aliasName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string;

  @Column({ type: 'longtext', nullable: true })
  profilePhoto: string | null;

  @Column({
    type: 'varchar',
    length: 32,
    default: UserTheme.OCEAN,
  })
  themePreference: UserTheme;

  @Column({ type: 'boolean', default: true })
  isDeletable: boolean;
}
