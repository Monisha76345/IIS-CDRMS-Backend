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

loadEnvironment();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Vars already loaded by loadEnvironment() from .env → .env.{local|dev}
      ignoreEnvFile: true,
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 5 * 60 * 1000,
      max: 2000,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const required = (key: string) => {
          const value = configService.get<string>(key);
          if (value == null || String(value).trim() === '') {
            throw new Error(`Missing required env: ${key}`);
          }
          return value;
        };
        return {
          type: required('DB_TYPE') as 'mysql',
          host: required('DB_HOST'),
          port: Number(required('DB_PORT')),
          username: required('DB_USERNAME'),
          password: required('DB_PASSWORD'),
          database: required('DB_DATABASE'),
          autoLoadEntities: true,
          synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true',
          logging: configService.get<string>('DB_LOGGING') === 'true',
        };
      },
    }),
    AdminModule,
    ObjectStoreModule,
    ApplicationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
