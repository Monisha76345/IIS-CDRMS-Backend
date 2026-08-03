import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../common/core/models/base.entity';
import {
  ApplicationStatus,
  OccupancyStatus,
  SiteDimensionType,
} from '../enums/application.enums';
import type { ApplicationHistoryItem } from '../models/application-history-item.interface';

@Entity('applications')
export class Application extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** e.g. ZC-SOUTH-AUC-0001 */
  @Column({ unique: true })
  applicationNumber: string;

  /** E-office file / reference number — unique across applications. */
  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  eOfficeNumber: string | null;

  @Column()
  siteNo: string;

  @Column()
  addressArea: string;

  @Column()
  addressBlock: string;

  @Column({ length: 20 })
  addressPincode: string;

  /** Even / Odd site type (legacy rows may still say Regular). */
  @Column({ type: 'varchar', length: 20 })
  siteDimensionType: SiteDimensionType | string;

  /** Selected plot size e.g. 20*40 or 20*40*50*40 */
  @Column({ type: 'varchar', length: 100, nullable: true })
  siteDimension: string | null;

  @Column({ type: 'text', nullable: true })
  siteDimensionComment: string | null;

  /** ZC schedule / surrounding notes per direction (read-only for engineer UI). */
  @Column({ type: 'text', nullable: true })
  scheduleNorth: string | null;

  @Column({ type: 'text', nullable: true })
  scheduleSouth: string | null;

  @Column({ type: 'text', nullable: true })
  scheduleWest: string | null;

  @Column({ type: 'text', nullable: true })
  scheduleEast: string | null;

  /**
   * Engineer-entered schedule notes per side (N/S/E/W).
   * Separate from ZC scheduleNorth… so ZC values stay intact.
   */
  @Column({ type: 'json', nullable: true })
  engineerScheduleNotes: Record<string, string> | null;

  /** Per-side "Road?" checkbox — true when checked, false otherwise. */
  @Column({ type: 'json', nullable: true })
  scheduleRoadFlags: Record<string, boolean> | null;

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
    type: 'varchar',
    length: 50,
    default: ApplicationStatus.ASSIGNED,
  })
  status: ApplicationStatus;

  // ── Engineer capture ───────────────────────────────────────

  @Column({ type: 'text', nullable: true })
  engineerSiteDetails: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  compass: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 8, nullable: true })
  latitude: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 8, nullable: true })
  longitude: string | null;

  /**
   * Reverse-geocoded place captured with engineer GPS (step 2 / submit).
   * Keys: displayName, village, taluk, district, state, street, area, block,
   * postalCode, country, accuracy.
   */
  @Column({ type: 'json', nullable: true })
  engineerGeoAddress: Record<string, string | number | null> | null;

  @Column({ type: 'enum', enum: OccupancyStatus, nullable: true })
  occupancy: OccupancyStatus | null;

  @Column({ type: 'text', nullable: true })
  occupancyReason: string | null;

  /**
   * Engineer-measured side lengths per direction (N/S/E/W).
   * Separate from ZC `siteDimension` (e.g. "20*40") — same idea as engineerScheduleNotes.
   */
  @Column({ type: 'json', nullable: true })
  engineerDimensions: Record<string, string> | null;

  /** @deprecated Prefer engineerDimensions.N — kept in sync for existing readers. */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  dimNorth: string | null;

  /** @deprecated Prefer engineerDimensions.S */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  dimSouth: string | null;

  /** @deprecated Prefer engineerDimensions.E */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  dimEast: string | null;

  /** @deprecated Prefer engineerDimensions.W */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  dimWest: string | null;

  /** Engineer-computed plot area from N/S/E/W (not ZC siteDimension). */
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
