import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { addTransactionalDataSource } from 'typeorm-transactional';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AllExceptionsFilter } from './admin/common/filters/all-exceptions.filter';
import { AppThrottlerGuard } from './admin/common/guards/app-throttler.guard';
import { AdminModule } from './admin/admin.module';
import { ObjectStoreModule } from './object-store/object-store.module';
import { ApplicationsModule } from './applications/applications.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditModule } from './audit/audit.module';
import {
  loadEnvironment,
  requireEnv,
  requireEnvBool,
  requireEnvList,
  requireEnvNumber,
} from './config/load-env';
import { cacheModuleOptionsFromEnv } from './config/cache.config';

loadEnvironment();

function typeOrmOptionsFromEnv(): TypeOrmModuleOptions {
  // Cast whole object — TypeORM's options are a discriminated union on `type`.
  return {
    type: requireEnv('DB_TYPE'),
    host: requireEnv('DB_HOST'),
    port: requireEnvNumber('DB_PORT'),
    username: requireEnv('DB_USERNAME'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_DATABASE'),
    entities: requireEnvList('DB_ENTITIES'),
    autoLoadEntities: requireEnvBool('DB_AUTO_LOAD_ENTITIES'),
    synchronize: requireEnvBool('DB_SYNCHRONIZE'),
    logging: requireEnvBool('DB_LOGGING'),
  } as TypeOrmModuleOptions;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Vars already loaded by loadEnvironment() from `.env` → `.env.local`
      ignoreEnvFile: true,
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => cacheModuleOptionsFromEnv(),
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
        limit: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
      },
      {
        name: 'auth',
        ttl: 60_000,
        limit: 10,
      },
    ]),
    TypeOrmModule.forRootAsync({
      useFactory: () => typeOrmOptionsFromEnv(),
      async dataSourceFactory(options) {
        if (!options) {
          throw new Error('Invalid TypeORM options');
        }
        return addTransactionalDataSource(new DataSource(options));
      },
    }),
    AdminModule,
    ObjectStoreModule,
    ApplicationsModule,
    NotificationsModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
  ],
})
export class AppModule {}
