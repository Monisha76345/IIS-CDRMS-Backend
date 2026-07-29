import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from './entities/application.entity';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { SeriesGeneratorModule } from '../admin/series-generator/series-generator.module';
import { UsersModule } from '../admin/users/users.module';
import { MasterZone } from '../admin/masters/entities/master-zone.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Application, MasterZone]),
    SeriesGeneratorModule,
    UsersModule,
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
