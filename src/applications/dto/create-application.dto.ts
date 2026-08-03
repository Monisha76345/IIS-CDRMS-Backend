import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SiteDimensionType } from '../enums/application.enums';

export class CreateApplicationDto {
  /** Super Admin may create on behalf of a zone (no zone on their own post). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  zoneId?: number;

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

  /** Indian PIN code — exactly 6 digits, first digit 1–9. */
  @IsString()
  @IsNotEmpty()
  @Matches(/^[1-9][0-9]{5}$/, {
    message: 'Pincode must be a valid 6-digit Indian PIN code (cannot start with 0)',
  })
  addressPincode: string;

  @IsEnum(SiteDimensionType)
  siteDimensionType: SiteDimensionType;

  /** Plot size e.g. 20*40 or 20*40*50*40 */
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
