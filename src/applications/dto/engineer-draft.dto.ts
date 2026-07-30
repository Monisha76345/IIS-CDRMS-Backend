import {
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OccupancyStatus } from '../enums/application.enums';

/** Partial schedule photos — only provided sides are updated. */
class SchedulePhotosDraftDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  N?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  S?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  E?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
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
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  engineerComments?: string;
}
