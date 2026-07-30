import { Module } from '@nestjs/common';
import { MastersModule } from '../masters/masters.module';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

/**
 * Admin-owned public common-data APIs (`/api/public/*`).
 * No JWT — read-only reference data for login forms / dropdowns.
 */
@Module({
  imports: [MastersModule],
  controllers: [PublicController],
  providers: [PublicService],
  exports: [PublicService],
})
export class PublicModule {}
