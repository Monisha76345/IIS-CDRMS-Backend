import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MastersModule } from './masters/masters.module';
import { SeriesGeneratorModule } from './series-generator/series-generator.module';
import { PublicModule } from './public/public.module';
import { DashboardModule } from './dashboard/dashboard.module';

/**
 * Portable admin surface: auth, users (person/post/mapping), roles, masters, series IDs,
 * and unauthenticated public common-data APIs.
 */
@Module({
  imports: [
    SeriesGeneratorModule,
    UsersModule,
    AuthModule,
    MastersModule,
    PublicModule,
    DashboardModule,
  ],
  exports: [
    SeriesGeneratorModule,
    UsersModule,
    AuthModule,
    MastersModule,
    PublicModule,
    DashboardModule,
  ],
})
export class AdminModule {}
