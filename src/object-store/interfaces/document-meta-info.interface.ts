import { EntityType } from '../enums/entity-type.enum';
import { ReferenceType } from '../enums/reference-type.enum';

export interface DocumentMetaInfo {
  entityType: EntityType;
  entityId: number;
  refType: ReferenceType;
  refId: number | string;
}
