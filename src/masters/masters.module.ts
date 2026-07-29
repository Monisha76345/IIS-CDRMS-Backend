import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeoLocation } from './entities/geo-location.entity';
import { AttributeMaster } from './entities/attribute-master.entity';
import { ApplicationStatusEntity } from './entities/application-status.entity';
import { SystemParameter } from './entities/system-parameter.entity';
import { District } from './entities/district.entity';
import { Taluk } from './entities/taluk.entity';
import { Village } from './entities/village.entity';
import { MastersService } from './masters.service';
import { MastersController } from './masters.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GeoLocation,
      AttributeMaster,
      ApplicationStatusEntity,
      SystemParameter,
      District,
      Taluk,
      Village,
    ]),
  ],
  providers: [MastersService],
  controllers: [MastersController],
  exports: [MastersService, TypeOrmModule],
})
export class MastersModule {}
