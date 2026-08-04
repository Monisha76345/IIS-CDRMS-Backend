import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { CachingUtil } from '../../common/utils/caching.util';

/**
 * Accepts either officer `access_token` or tenant `tenant_access_token`.
 * Sets `request.user` and `request.authKind` = 'officer' | 'tenant'.
 */
@Injectable()
export class JwtOrTenantAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cachingUtil: CachingUtil,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const officerToken = request.cookies?.['access_token'] as string | undefined;
    const tenantToken = request.cookies?.['tenant_access_token'] as
      | string
      | undefined;
    const token = officerToken || tenantToken;
    const kind = officerToken ? 'officer' : tenantToken ? 'tenant' : null;

    if (!token || !kind) {
      throw new UnauthorizedException('Authentication token missing');
    }

    const blacklisted = await this.cachingUtil.getCache(
      `token:blacklist:${token}`,
    );
    if (blacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      if (!secret?.trim()) {
        throw new UnauthorizedException('JWT_SECRET is not configured');
      }
      const payload = await this.jwtService.verifyAsync(token, { secret });
      if (kind === 'tenant' && payload?.typ !== 'tenant') {
        throw new UnauthorizedException('Invalid tenant token');
      }
      request['user'] = payload;
      request['authKind'] = kind;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }
}
