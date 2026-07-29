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
} from 'class-validator';
import { Type } from 'class-transformer';
import { OccupancyStatus } from '../enums/application.enums';

class SchedulePhotosDto {
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

export class EngineerSubmitApplicationDto {
  @IsString()
  @IsNotEmpty()
  engineerSiteDetails: string;

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

  @IsOptional()
  @IsNumberString()
  totalSiteArea?: string;

  @IsString()
  @IsNotEmpty()
  selfieUrl: string;

  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  photoUrls: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => SchedulePhotosDto)
  schedulePhotoUrls?: SchedulePhotosDto;

  @IsString()
  @IsNotEmpty()
  videoUrl: string;

  @IsString()
  @IsNotEmpty()
  engineerComments: string;
}
