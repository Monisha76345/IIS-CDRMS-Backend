import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AllExceptionsFilter } from './admin/common/filters/all-exceptions.filter';
import {
  loadEnvironment,
  requireEnv,
  requireEnvBool,
  requireEnvList,
  requireEnvNumber,
} from './config/load-env';
import { AdminModule } from './admin/admin.module';
import { ObjectStoreModule } from './object-store/object-store.module';
import { ApplicationsModule } from './applications/applications.module';
import { NotificationsModule } from './notifications/notifications.module';

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
      envFilePath: '.env',
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: requireEnvNumber('CACHE_TTL_MS'),
      max: requireEnvNumber('CACHE_MAX'),
    }),
    TypeOrmModule.forRoot(typeOrmOptionsFromEnv()),
    AdminModule,
    ObjectStoreModule,
    ApplicationsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
