import {
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OccupancyStatus } from '../enums/application.enums';
import { EngineerGeoAddressDto } from './engineer-geo-address.dto';

/** Partial schedule photos — only provided sides are updated. Empty string clears. */
class SchedulePhotosDraftDto {
  @IsOptional()
  @IsString()
  N?: string;

  @IsOptional()
  @IsString()
  S?: string;

  @IsOptional()
  @IsString()
  E?: string;

  @IsOptional()
  @IsString()
  W?: string;
}

class ScheduleRoadFlagsDraftDto {
  @IsOptional()
  @IsBoolean()
  N?: boolean;

  @IsOptional()
  @IsBoolean()
  S?: boolean;

  @IsOptional()
  @IsBoolean()
  E?: boolean;

  @IsOptional()
  @IsBoolean()
  W?: boolean;
}

class EngineerScheduleNotesDraftDto {
  @IsOptional()
  @IsString()
  N?: string;

  @IsOptional()
  @IsString()
  S?: string;

  @IsOptional()
  @IsString()
  E?: string;

  @IsOptional()
  @IsString()
  W?: string;
}

/** Engineer N/S/E/W dimensions — separate from ZC siteDimension. */
class EngineerDimensionsDraftDto {
  @IsOptional()
  @IsNumberString()
  N?: string;

  @IsOptional()
  @IsNumberString()
  S?: string;

  @IsOptional()
  @IsNumberString()
  E?: string;

  @IsOptional()
  @IsNumberString()
  W?: string;
}

/**
 * Partial engineer capture — persists progress without submitting to CAO.
 * Only provided fields are written; status stays in_progress.
 */
export class EngineerDraftApplicationDto {
  @IsOptional()
  @IsString()
  engineerSiteDetails?: string;

  @IsOptional()
  @IsString()
  compass?: string;

  @IsOptional()
  @IsNumberString()
  latitude?: string;

  @IsOptional()
  @IsNumberString()
  longitude?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EngineerGeoAddressDto)
  engineerGeoAddress?: EngineerGeoAddressDto;

  @IsOptional()
  @IsEnum(OccupancyStatus)
  occupancy?: OccupancyStatus;

  @IsOptional()
  @IsString()
  occupancyReason?: string;

  @IsOptional()
  @IsNumberString()
  dimNorth?: string;

  @IsOptional()
  @IsNumberString()
  dimSouth?: string;

  @IsOptional()
  @IsNumberString()
  dimEast?: string;

  @IsOptional()
  @IsNumberString()
  dimWest?: string;

  /** Preferred: engineer N/S/E/W dims (does not touch ZC siteDimension). */
  @IsOptional()
  @ValidateNested()
  @Type(() => EngineerDimensionsDraftDto)
  engineerDimensions?: EngineerDimensionsDraftDto;

  @IsOptional()
  @IsNumberString()
  totalSiteArea?: string;

  @IsOptional()
  @IsString()
  selfieUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  photoUrls?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => SchedulePhotosDraftDto)
  schedulePhotoUrls?: SchedulePhotosDraftDto;

  /** @deprecated Engineer no longer overwrites ZC schedules — use engineerScheduleNotes. */
  @IsOptional()
  @IsString()
  scheduleNorth?: string;

  @IsOptional()
  @IsString()
  scheduleSouth?: string;

  @IsOptional()
  @IsString()
  scheduleWest?: string;

  @IsOptional()
  @IsString()
  scheduleEast?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EngineerScheduleNotesDraftDto)
  engineerScheduleNotes?: EngineerScheduleNotesDraftDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleRoadFlagsDraftDto)
  scheduleRoadFlags?: ScheduleRoadFlagsDraftDto;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  engineerComments?: string;
}
