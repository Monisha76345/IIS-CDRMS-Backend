import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseEntity } from '../../admin/common/core/models/base.entity';
import { EntityType } from '../enums/entity-type.enum';
import { ReferenceType } from '../enums/reference-type.enum';

@Entity('object_store')
export class DocumentMetaInfoEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: EntityType,
  })
  entityType: EntityType;

  @Column({ type: 'int' })
  entityId: number;

  @Column({
    type: 'enum',
    enum: ReferenceType,
  })
  refType: ReferenceType;

  @Column({ type: 'varchar', length: 255 })
  refId: string;

  @Column({ name: 'file_key', type: 'varchar', length: 512, unique: true })
  fileKey: string;

  @Column({ type: 'varchar', length: 255 })
  filename: string;

  @Column({
    name: 'file_size',
    type: 'bigint',
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number | null) =>
        typeof value === 'number' ? value : parseInt(String(value ?? '0'), 10) || 0,
    },
  })
  fileSize: number;

  @Column({ type: 'varchar', length: 128, nullable: true })
  mimetype: string | null;

  @Column({ name: 'image_url', type: 'varchar', length: 1024, nullable: true })
  imageUrl: string | null;
}
