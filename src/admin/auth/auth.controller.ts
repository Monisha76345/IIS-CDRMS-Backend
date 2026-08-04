import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CachingUtil } from '../common/utils/caching.util';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cachingUtil: CachingUtil,
    private readonly jwtService: JwtService,
  ) {}

  @Post('register')
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  async register(@Body() registerDto: RegisterDto) {
    const user = await this.authService.register(registerDto);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { user, accessToken, refreshToken } =
      await this.authService.login(loginDto);

    response.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600 * 1000,
    });

    return {
      user,
      accessToken,
      refreshToken,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookieAccess = request.cookies?.['access_token'] as string | undefined;
    const cookieRefresh = request.cookies?.['refresh_token'] as
      | string
      | undefined;
    const authHeader = request.headers?.authorization;
    const bearerToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : undefined;

    const accessToken = cookieAccess || bearerToken;
    const refreshToken = cookieRefresh;

    if (accessToken) {
      await this.cachingUtil.setCache(
        `token:blacklist:${accessToken}`,
        '1',
        this.blacklistTtlMs(accessToken, 3600 * 1000),
      );
    }
    if (refreshToken) {
      await this.cachingUtil.setCache(
        `token:blacklist:${refreshToken}`,
        '1',
        this.blacklistTtlMs(refreshToken, 7 * 24 * 3600 * 1000),
      );
    }

    response.clearCookie('access_token');
    response.clearCookie('refresh_token');
    return { message: 'Logged out successfully' };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() request: Request) {
    const userId = request['user'].sub;
    return this.authService.getEnrichedProfile(userId);
  }

  @Post('profile/avatar')
  @UseGuards(JwtAuthGuard)
  async updateAvatar(
    @Req() request: Request,
    @Body() body: { profilePhoto?: string; avatarData?: string },
  ) {
    const userId = request['user'].sub;
    const photo = body.profilePhoto || body.avatarData || null;
    return this.authService.usersService.updateProfilePhoto(userId, photo);
  }

  @Delete('profile/avatar')
  @UseGuards(JwtAuthGuard)
  async deleteAvatar(@Req() request: Request) {
    const userId = request['user'].sub;
    return this.authService.usersService.deleteProfilePhoto(userId);
  }

  @Patch('profile/theme')
  @UseGuards(JwtAuthGuard)
  async updateTheme(@Req() request: Request, @Body() dto: UpdateThemeDto) {
    const userId = request['user'].sub;
    return this.authService.usersService.updateThemePreference(
      userId,
      dto.themePreference,
    );
  }

  /** Prefer JWT `exp` remaining life so blacklist entries don't outlive the token. */
  private blacklistTtlMs(token: string, fallbackMs: number): number {
    try {
      const payload = this.jwtService.decode(token) as { exp?: number } | null;
      if (payload?.exp) {
        return Math.max(1000, payload.exp * 1000 - Date.now());
      }
    } catch {
      // fall through
    }
    return fallbackMs;
  }
}
