import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AllExceptionsFilter } from './admin/common/filters/all-exceptions.filter';
import { loadEnvironment } from './config/load-env';
import { AdminModule } from './admin/admin.module';
import { ObjectStoreModule } from './object-store/object-store.module';
import { ApplicationsModule } from './applications/applications.module';
import { NotificationsModule } from './notifications/notifications.module';

loadEnvironment();

function requireConfig(configService: ConfigService, key: string): string {
  const value = configService.get<string>(key);
  if (value == null || String(value).trim() === '') {
    throw new Error(`Missing required env: ${key}`);
  }
  return String(value).trim();
}

function requireConfigNumber(configService: ConfigService, key: string): number {
  const raw = requireConfig(configService, key);
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`Env ${key} must be a number, got: ${raw}`);
  }
  return n;
}

function envFlagTrue(configService: ConfigService, key: string): boolean {
  return requireConfig(configService, key).toLowerCase() === 'true';
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Vars already loaded by loadEnvironment() from .env → .env.{local|dev}
      ignoreEnvFile: true,
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ttl: requireConfigNumber(configService, 'CACHE_TTL_MS'),
        max: requireConfigNumber(configService, 'CACHE_MAX'),
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: requireConfig(configService, 'DB_TYPE') as 'mysql',
        host: requireConfig(configService, 'DB_HOST'),
        port: requireConfigNumber(configService, 'DB_PORT'),
        username: requireConfig(configService, 'DB_USERNAME'),
        password: requireConfig(configService, 'DB_PASSWORD'),
        database: requireConfig(configService, 'DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: envFlagTrue(configService, 'DB_SYNCHRONIZE'),
        logging: envFlagTrue(configService, 'DB_LOGGING'),
      }),
    }),
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
