import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../common/core/models/base.entity';
import {
  ApplicationStatus,
  OccupancyStatus,
  SiteDimensionType,
} from '../enums/application.enums';

@Entity('applications')
export class Application extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** e.g. ZC-SOUTH-AUC-0001 */
  @Column({ unique: true })
  applicationNumber: string;

  @Column()
  siteNo: string;

  @Column()
  addressArea: string;

  @Column()
  addressBlock: string;

  @Column({ length: 20 })
  addressPincode: string;

  @Column({ type: 'enum', enum: SiteDimensionType })
  siteDimensionType: SiteDimensionType;

  @Column({ type: 'text', nullable: true })
  siteDimensionComment: string | null;

  /** ZC schedule / surrounding notes per direction */
  @Column({ type: 'text', nullable: true })
  scheduleNorth: string | null;

  @Column({ type: 'text', nullable: true })
  scheduleSouth: string | null;

  @Column({ type: 'text', nullable: true })
  scheduleWest: string | null;

  @Column({ type: 'text', nullable: true })
  scheduleEast: string | null;

  @Column({ type: 'int' })
  zoneId: number;

  @Column({ length: 50 })
  zoneCode: string;

  @Column({ type: 'varchar', length: 36 })
  assignedEngineerUserId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  assignedEngineerName: string | null;

  @Column({ type: 'varchar', length: 36 })
  createdByZcUserId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  createdByZcName: string | null;

  /** Zone CAO who must verify/approve after engineer submit */
  @Column({ type: 'varchar', length: 36, nullable: true })
  assignedCaoUserId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  assignedCaoName: string | null;

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.ASSIGNED,
  })
  status: ApplicationStatus;

  @Column({ type: 'text', nullable: true })
  caoRemarks: string | null;

  @Column({ type: 'datetime', nullable: true })
  caoReviewedAt: Date | null;

  // ── Engineer capture ───────────────────────────────────────

  @Column({ type: 'text', nullable: true })
  engineerSiteDetails: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  compass: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 8, nullable: true })
  latitude: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 8, nullable: true })
  longitude: string | null;

  @Column({ type: 'enum', enum: OccupancyStatus, nullable: true })
  occupancy: OccupancyStatus | null;

  @Column({ type: 'text', nullable: true })
  occupancyReason: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  dimNorth: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  dimSouth: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  dimEast: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  dimWest: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  totalSiteArea: string | null;

  /** Object-store / URL references (JSON arrays or single strings) */
  @Column({ type: 'varchar', length: 500, nullable: true })
  selfieUrl: string | null;

  @Column({ type: 'json', nullable: true })
  photoUrls: string[] | null;

  @Column({ type: 'json', nullable: true })
  schedulePhotoUrls: Record<string, string> | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  videoUrl: string | null;

  @Column({ type: 'text', nullable: true })
  engineerComments: string | null;

  @Column({ type: 'datetime', nullable: true })
  engineerSubmittedAt: Date | null;
}
