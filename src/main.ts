import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as mysql from 'mysql2/promise';
import { initializeTransactionalContext } from 'typeorm-transactional';
import { loadEnvironment, requireEnv, requireEnvNumber, envOr } from './config/load-env';
import {
  AllExceptionsFilter,
  validationExceptionFactory,
} from './admin/common/filters/all-exceptions.filter';
import { SanitizePipe } from './admin/common/pipes/sanitize.pipe';

async function bootstrap() {
  // Must run before NestFactory.create — enables @Transactional() (Keonics pattern).
  initializeTransactionalContext();

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

  const helmetEnabled = process.env.ENABLE_HELMET === 'true';
  const cspEnabled = process.env.ENABLE_CSP === 'true';
  const hstsEnabled = process.env.ENABLE_HSTS === 'true';
  const hstsMaxAge = parseInt(process.env.HSTS_MAX_AGE || '31536000', 10);

  if (helmetEnabled) {
    app.use(
      helmet({
        contentSecurityPolicy: cspEnabled
          ? {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              scriptSrc: ["'self'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'"],
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              mediaSrc: ["'self'"],
              frameSrc: ["'none'"],
            },
          }
          : false,
        crossOriginEmbedderPolicy: false,
        hsts: hstsEnabled
          ? {
            maxAge: hstsMaxAge,
            includeSubDomains: true,
            preload: true,
          }
          : false,
        noSniff: true,
        xssFilter: true,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
        frameguard: { action: 'deny' },
      }),
    );
  }

  app.setGlobalPrefix('api');

  const allowLanWebOrigins =
    environment === 'dev' || envName === 'local' || environment === 'local';

  const isLanDevOrigin = (origin: string): boolean => {
    try {
      const url = new URL(origin);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
      const host = url.hostname;
      if (host === 'localhost' || host === '127.0.0.1') return true;
      if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
      if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
      if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
      return false;
    } catch {
      return false;
    }
  };

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      if (allowLanWebOrigins && isLanDevOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      exceptionFactory: validationExceptionFactory,
    }),
    new SanitizePipe(),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(appPort, listenHost);
  console.log(`[${environment}] Application is running on: http://${listenHost}:${appPort}`);
}

bootstrap();

