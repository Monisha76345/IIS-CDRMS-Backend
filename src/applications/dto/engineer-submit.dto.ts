import {
  IsEnum,
  IsNotEmpty,
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

class SchedulePhotosDto {
  @IsString()
  @IsNotEmpty()
  N!: string;

  @IsString()
  @IsNotEmpty()
  S!: string;

  @IsString()
  @IsNotEmpty()
  E!: string;

  @IsString()
  @IsNotEmpty()
  W!: string;
}

class EngineerScheduleNotesSubmitDto {
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

class EngineerDimensionsSubmitDto {
  @IsNumberString()
  N!: string;

  @IsNumberString()
  S!: string;

  @IsNumberString()
  E!: string;

  @IsNumberString()
  W!: string;
}

class ScheduleRoadFlagsSubmitDto {
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

export class EngineerSubmitApplicationDto {
  @IsString()
  @IsOptional()
  engineerSiteDetails?: string;

  @IsString()
  @IsNotEmpty()
  compass: string;

  @IsNumberString()
  latitude: string;

  @IsNumberString()
  longitude: string;

  @IsEnum(OccupancyStatus)
  occupancy: OccupancyStatus;

  @IsOptional()
  @IsString()
  occupancyReason?: string;

  @IsNumberString()
  dimNorth: string;

  @IsNumberString()
  dimSouth: string;

  @IsNumberString()
  dimEast: string;

  @IsNumberString()
  dimWest: string;

  /** Preferred: engineer N/S/E/W (separate from ZC siteDimension). */
  @IsOptional()
  @ValidateNested()
  @Type(() => EngineerDimensionsSubmitDto)
  engineerDimensions?: EngineerDimensionsSubmitDto;

  @IsOptional()
  @IsNumberString()
  totalSiteArea?: string;

  @IsString()
  @IsNotEmpty()
  selfieUrl: string;

  /** Optional extra site photos (selfie is separate). */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  photoUrls?: string[];

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => SchedulePhotosDto)
  schedulePhotoUrls!: SchedulePhotosDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => EngineerScheduleNotesSubmitDto)
  engineerScheduleNotes?: EngineerScheduleNotesSubmitDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleRoadFlagsSubmitDto)
  scheduleRoadFlags?: ScheduleRoadFlagsSubmitDto;

  @IsString()
  @IsNotEmpty()
  videoUrl: string;

  @IsString()
  @IsNotEmpty()
  engineerComments: string;
}
