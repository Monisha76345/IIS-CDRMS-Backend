import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { EntityType } from '../enums/entity-type.enum';
import { ReferenceType } from '../enums/reference-type.enum';

export class UploadDocumentDto {
  @IsEnum(EntityType)
  entityType: EntityType;

  @Type(() => Number)
  @IsNumber()
  entityId: number;

  @IsEnum(ReferenceType)
  refType: ReferenceType;

  @IsString()
  refId: string;
}

export class DocumentQueryDto {
  @IsOptional()
  @IsEnum(EntityType)
  entityType?: EntityType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  entityId?: number;

  @IsOptional()
  @IsEnum(ReferenceType)
  refType?: ReferenceType;
}
