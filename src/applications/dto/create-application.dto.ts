import {
  IsBoolean,
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
  @MaxLength(255)
  addressLine1: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine2?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  addressBlock: string;

  /**
   * Optional — ignored on write. City is stamped from server defaults
   * (APPLICATION_DEFAULT_CITY). Accepted so older clients do not fail validation.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  addressCity?: string;

  /**
   * Optional — ignored on write. State is stamped from server defaults
   * (APPLICATION_DEFAULT_STATE).
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  addressState?: string;

  /** Pincode — exactly 6 digits. */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, {
    message: 'Pincode must be a 6-digit number',
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

  /** When true, application stays in draft until ZC submits to engineer. */
  @IsOptional()
  @IsBoolean()
  saveAsDraft?: boolean;
}
