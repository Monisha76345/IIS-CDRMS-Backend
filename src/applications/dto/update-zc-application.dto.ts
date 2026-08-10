import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { SiteDimensionType } from '../enums/application.enums';

export class UpdateZcApplicationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  eOfficeNumber: string;

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
  @Matches(/^\d{6}$/, {
    message: 'Pincode must be a 6-digit number',
  })
  addressPincode: string;

  @IsEnum(SiteDimensionType)
  siteDimensionType: SiteDimensionType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  siteDimension: string;

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
