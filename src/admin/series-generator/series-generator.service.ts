import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transactional } from 'typeorm-transactional';
import { SeriesGenerator } from './entities/series-generator.entity';

@Injectable()
export class SeriesGeneratorService {
  constructor(
    @InjectRepository(SeriesGenerator)
    private readonly repository: Repository<SeriesGenerator>,
  ) {}

  /**
   * Ensure the stored counter is at least `minValue` so the next
   * generateAndSavePrefix call returns minValue + 1 (or higher).
   * Use when existing rows already hold higher codes than the series table.
   */
  async ensureAtLeast(
    prefix: string,
    minValue: number,
    paddingLength = 5,
  ): Promise<void> {
    if (!Number.isFinite(minValue) || minValue < 0) return;

    let record = await this.repository.findOne({ where: { prefix } });
    const current = record ? parseInt(record.value, 10) || 0 : 0;
    if (current >= minValue) return;

    if (!record) {
      record = this.repository.create({ prefix });
    }
    record.value = minValue.toString().padStart(paddingLength, '0');
    await this.repository.save(record);
  }

  @Transactional()
  async generateAndSavePrefix(prefix: string, paddingLength = 5): Promise<string> {
    let record = await this.repository.findOne({ where: { prefix } });
    let nextNum = 1;
    if (record) {
      nextNum = parseInt(record.value, 10) + 1;
    } else {
      record = this.repository.create({ prefix });
    }
    if (!Number.isFinite(nextNum) || nextNum < 1) nextNum = 1;
    const paddedValue = nextNum.toString().padStart(paddingLength, '0');
    record.value = paddedValue;
    await this.repository.save(record);
    return `${prefix}${paddedValue}`;
  }

  @Transactional()
  async getNextValue(prefix: string): Promise<number> {
    let record = await this.repository.findOne({ where: { prefix } });
    let nextNum = 1;
    if (record) {
      nextNum = parseInt(record.value, 10) + 1;
      record.value = nextNum.toString();
    } else {
      record = this.repository.create({ prefix, value: '1' });
    }
    await this.repository.save(record);
    return nextNum;
  }
}
