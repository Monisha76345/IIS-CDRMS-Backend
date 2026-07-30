import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeoLocation } from './entities/geo-location.entity';
import { AttributeMaster } from './entities/attribute-master.entity';
import { SystemParameter } from './entities/system-parameter.entity';
import { District } from './entities/district.entity';
import { Taluk } from './entities/taluk.entity';
import { Village } from './entities/village.entity';
import { MasterCountry } from './entities/master-country.entity';
import { MasterState } from './entities/master-state.entity';
import { MasterDistrict } from './entities/master-district.entity';
import { MasterTaluq } from './entities/master-taluq.entity';
import { MasterZone } from './entities/master-zone.entity';
import { MastersService } from './masters.service';
import { MastersController } from './masters.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GeoLocation,
      AttributeMaster,
      SystemParameter,
      District,
      Taluk,
      Village,
      MasterCountry,
      MasterState,
      MasterDistrict,
      MasterTaluq,
      MasterZone,
    ]),
  ],
  providers: [MastersService],
  controllers: [MastersController],
  exports: [MastersService, TypeOrmModule],
})
export class MastersModule {}
