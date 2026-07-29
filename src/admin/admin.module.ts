import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MastersModule } from './masters/masters.module';
import { SeriesGeneratorModule } from './series-generator/series-generator.module';

/**
 * Portable admin surface: auth, users (person/post/mapping), roles, masters, series IDs.
 * Import this single module in the host Nest app after TypeORM + Config are configured.
 */
@Module({
  imports: [
    SeriesGeneratorModule,
    UsersModule,
    AuthModule,
    MastersModule,
  ],
  exports: [
    SeriesGeneratorModule,
    UsersModule,
    AuthModule,
    MastersModule,
  ],
})
export class AdminModule {}
