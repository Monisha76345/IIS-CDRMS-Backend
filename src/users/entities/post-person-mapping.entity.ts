import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/core/models/base.entity';
import { PostDetails } from './post-details.entity';
import { PersonalDetails } from './personal-details.entity';
import { MappingStatus } from '../enums/assignment-status';

@Entity('post_person_mappings')
export class PostPersonMapping extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** FK → post_details.id (UUID) */
  @Column({ type: 'varchar', length: 36 })
  postId: string;

  @ManyToOne(() => PostDetails, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: PostDetails;

  /** FK → personal_details.id (UUID) */
  @Column({ type: 'varchar', length: 36 })
  personId: string;

  @ManyToOne(() => PersonalDetails, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'personId' })
  person: PersonalDetails;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  /** Stored as lowercase: active | inactive */
  @Column({
    type: 'enum',
    enum: MappingStatus,
    default: MappingStatus.ACTIVE,
  })
  status: MappingStatus;
}
