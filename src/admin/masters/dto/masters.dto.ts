import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MasterStatus } from '../enums/master-status.enum';
import { AttributeMasterType } from '../enums/attribute-master-type.enum';

export class UpsertGeoLocationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code: string;

  @IsOptional()
  @IsEnum(MasterStatus)
  status?: MasterStatus;
}

export class UpsertAttributeMasterDto {
  @IsEnum(AttributeMasterType)
  type: AttributeMasterType;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  label: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code: string;

  @IsOptional()
  @IsEnum(MasterStatus)
  status?: MasterStatus;
}

export class UpsertSystemParameterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  value: string;
}

export class UpsertDistrictDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsEnum(MasterStatus)
  status?: MasterStatus;
}

export class UpsertTalukDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;

  @IsUUID()
  districtId: string;

  @IsOptional()
  @IsEnum(MasterStatus)
  status?: MasterStatus;
}

export class UpsertVillageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;

  @IsUUID()
  talukId: string;

  @IsUUID()
  districtId: string;

  @IsOptional()
  @IsEnum(MasterStatus)
  status?: MasterStatus;
}

export class UpdateMasterStatusDto {
  @IsEnum(MasterStatus)
  status: MasterStatus;
}
