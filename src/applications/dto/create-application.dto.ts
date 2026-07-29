import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SiteDimensionType } from '../enums/application.enums';

export class CreateApplicationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  siteNo: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  addressArea: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  addressBlock: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(20)
  addressPincode: string;

  @IsEnum(SiteDimensionType)
  siteDimensionType: SiteDimensionType;

  @IsOptional()
  @IsString()
  siteDimensionComment?: string;

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

  @IsUUID()
  assignedEngineerUserId: string;
}
