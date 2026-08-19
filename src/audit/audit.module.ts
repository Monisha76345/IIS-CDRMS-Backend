import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLog } from './entities/audit-log.entity';
import { AuditService } from './audit.service';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { AuditController } from './audit.controller';
import { User } from '../admin/users/entities/user.entity';
import { PostDetails } from '../admin/users/entities/post-details.entity';
import { PersonalDetails } from '../admin/users/entities/personal-details.entity';
import { PostPersonMapping } from '../admin/users/entities/post-person-mapping.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditLog,
      User,
      PostDetails,
      PersonalDetails,
      PostPersonMapping,
    ]),
  ],
  controllers: [AuditController],
  providers: [
    AuditService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
  exports: [AuditService],
})
export class AuditModule {}
