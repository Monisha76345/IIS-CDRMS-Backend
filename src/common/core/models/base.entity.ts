import { Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export abstract class BaseEntity {
  @Column({ type: 'varchar', length: 255, nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ type: 'datetime', precision: 6, nullable: true })
  createdAt?: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  updatedBy?: string | null;

  @UpdateDateColumn({ type: 'datetime', precision: 6, nullable: true })
  updatedAt?: Date | null;
}
