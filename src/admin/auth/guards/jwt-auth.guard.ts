import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { CachingUtil } from '../../common/utils/caching.util';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cachingUtil: CachingUtil,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const cookieToken = request.cookies?.['access_token'] as string | undefined;
    const authHeader = request.headers?.authorization;
    const bearerToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : undefined;
    const token = cookieToken || bearerToken;

    if (!token) {
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
      request['user'] = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }
}
