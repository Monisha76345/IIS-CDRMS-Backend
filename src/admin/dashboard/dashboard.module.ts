import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { User } from '../users/entities/user.entity';
import { Application } from '../../applications/entities/application.entity';
import { GeoLocation } from '../masters/entities/geo-location.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Application, GeoLocation]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
