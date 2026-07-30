import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import * as mysql from 'mysql2/promise';
import { loadEnvironment, requireEnv, requireEnvNumber, envOr } from './config/load-env';
import {
  AllExceptionsFilter,
  validationExceptionFactory,
} from './admin/common/filters/all-exceptions.filter';

async function bootstrap() {
  const envName = loadEnvironment();

  const dbHost = requireEnv('DB_HOST');
  const dbPort = requireEnvNumber('DB_PORT');
  const dbUser = requireEnv('DB_USERNAME');
  const dbPass = requireEnv('DB_PASSWORD');
  const dbName = requireEnv('DB_DATABASE');
  const appPort = requireEnvNumber('APP_PORT');
  const listenHost = envOr('APP_HOST', '0.0.0.0');
  const corsOriginString = requireEnv('CORS_ORIGIN');
  const corsOrigins = corsOriginString
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const environment = requireEnv('ENVIRONMENT');

  try {
    const connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPass,
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await connection.end();
    console.log(`[${envName}] Database "${dbName}" verified or created successfully.`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${envName}] Database auto-creation check failed: ${message}`);
  }

  // Allow base64 profile photos (default Nest/Express limit is ~100kb).
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser('json', { limit: '8mb' });
  app.useBodyParser('urlencoded', { limit: '8mb', extended: true });

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      exceptionFactory: validationExceptionFactory,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(appPort, listenHost);
  console.log(`[${environment}] Application is running on: http://${listenHost}:${appPort}`);
}

bootstrap();
