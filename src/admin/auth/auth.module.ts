import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtOrTenantAuthGuard } from './guards/jwt-or-tenant-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { CachingUtil } from '../common/utils/caching.util';

@Global()
@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        const expiresIn = configService.get<string>('JWT_EXPIRES_IN');
        if (!secret?.trim()) throw new Error('Missing required env: JWT_SECRET');
        if (!expiresIn?.trim()) throw new Error('Missing required env: JWT_EXPIRES_IN');
        return {
          secret,
          signOptions: { expiresIn: expiresIn as any },
        };
      },
    }),
  ],
  providers: [
    AuthService,
    JwtAuthGuard,
    JwtOrTenantAuthGuard,
    PermissionsGuard,
    RolesGuard,
    CachingUtil,
  ],
  controllers: [AuthController],
  exports: [
    AuthService,
    JwtModule,
    JwtAuthGuard,
    JwtOrTenantAuthGuard,
    PermissionsGuard,
    RolesGuard,
    CachingUtil,
  ],
})
export class AuthModule {}
