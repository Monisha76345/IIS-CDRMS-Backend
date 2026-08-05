import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User, UserStatus } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { normalizeAccessKey } from '../common/utils/normalize-access-key';
import { CachingUtil } from '../common/utils/caching.util';
import { jwtDurationToMs } from '../common/utils/jwt-duration';

@Injectable()
export class AuthService {
  constructor(
    public readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly cachingUtil: CachingUtil,
  ) {}

  async register(registerDto: RegisterDto): Promise<User> {
    const existing = await this.usersService.findByIdentifier(registerDto.email);
    if (existing) {
      throw new BadRequestException('Login ID or Email already registered');
    }

    const isEmail = registerDto.email.includes('@');
    const userData: Partial<User> = {
      name: registerDto.name,
      password: registerDto.password,
      email: isEmail ? registerDto.email : undefined,
      loginId: isEmail ? undefined : registerDto.email,
    };

    return this.usersService.create(userData);
  }

  /**
   * Login resolves authorization via:
   * User → PersonalDetails (loginId = personUniqueId)
   * → PostPersonMapping (ACTIVE + date-effective)
   * → PostDetails → Role
   */
  async login(
    loginDto: LoginDto,
  ): Promise<{ user: any; accessToken: string; refreshToken: string }> {
    const user = await this.usersService.findByIdentifier(loginDto.email);
    if (!user) {
      throw new UnauthorizedException(
        'Invalid Login ID / Email / Alias or password',
      );
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'Invalid Login ID / Email / Alias or password',
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    const enriched = await this.buildEnrichedUser(user);

    // CDRMS Phase 1: role is on User.userType (Engineer / CAO / Super Admin).
    // Post/person PBAC is deferred per SOW — do not require a post mapping.

    const tokens = await this.issueTokens(user, enriched);
    await this.usersService.touchLastLoggedIn(user.id);

    return {
      user: enriched,
      ...tokens,
    };
  }

  /**
   * Rotate access + refresh from a valid (non-blacklisted) refresh token.
   * Keonics-style: used by clients on 401 before forcing re-login.
   */
  async refresh(
    refreshToken: string,
  ): Promise<{ user: any; accessToken: string; refreshToken: string }> {
    const token = String(refreshToken || '').trim();
    if (!token) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const blacklisted = await this.cachingUtil.getCache(
      `token:blacklist:${token}`,
    );
    if (blacklisted) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    let payload: { sub?: string };
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    const user = await this.usersService.findById(String(payload.sub));
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    const enriched = await this.buildEnrichedUser(user);
    const tokens = await this.issueTokens(user, enriched);

    // One-time refresh rotation — blacklist the used refresh token.
    await this.cachingUtil.setCache(
      `token:blacklist:${token}`,
      '1',
      this.tokenTtlMs(token, jwtDurationToMs(process.env.JWT_REFRESH_EXPIRES_IN, 7 * 24 * 3600 * 1000)),
    );

    return {
      user: enriched,
      ...tokens,
    };
  }

  /** Idle timeout for web/mobile sessions (SoW session_timeout_minutes). */
  getSessionConfig() {
    const minutesRaw = process.env.SESSION_TIMEOUT_MINUTES?.trim();
    const minutes = Number(minutesRaw);
    return {
      sessionTimeoutMinutes:
        Number.isFinite(minutes) && minutes > 0 ? minutes : 30,
      accessExpiresIn: process.env.JWT_EXPIRES_IN?.trim() || '15m',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN?.trim() || '7d',
    };
  }

  private async issueTokens(user: User, enriched: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      loginId: user.loginId,
      userType: user.userType,
      role: normalizeAccessKey(enriched.role) || enriched.role,
      roleName: enriched.roleName,
      postId: enriched.activePost?.postId || '',
      postName: enriched.activePost?.postName || '',
      personUniqueId: enriched.officer?.personUniqueId || '',
      officerName: enriched.officer
        ? `${enriched.officer.firstName || ''} ${enriched.officer.lastName || ''}`.trim()
        : user.name,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshExpiresIn =
      process.env.JWT_REFRESH_EXPIRES_IN?.trim() || '7d';
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: refreshExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    return { accessToken, refreshToken };
  }

  private tokenTtlMs(token: string, fallbackMs: number): number {
    try {
      const decoded = this.jwtService.decode(token) as { exp?: number } | null;
      if (decoded?.exp) {
        return Math.max(1000, decoded.exp * 1000 - Date.now());
      }
    } catch {
      // fall through
    }
    return fallbackMs;
  }

  async getEnrichedProfile(userId: number | string): Promise<any> {
    const user = await this.usersService.findById(String(userId));
    if (!user) return null;
    if (user.status !== UserStatus.ACTIVE) return null;
    return this.buildEnrichedUser(user);
  }

  private async buildEnrichedUser(user: User) {
    const { person, post, roleCode, roleName } =
      await this.usersService.resolvePositionContext(user);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;

    const officerName = person
      ? `${person.firstName || ''} ${person.lastName || ''}`.trim()
      : '';

    // Prefer real uploads; never expose stock /avatars/* placeholders.
    const rawUserPhoto = (user as any)?.profilePhoto as string | null | undefined;
    const rawPersonPhoto = (person as any)?.profilePhoto as
      | string
      | null
      | undefined;
    const profilePhoto = AuthService.pickUploadedPhoto(
      rawUserPhoto,
      rawPersonPhoto,
    );

    // One-shot: wipe leftover stock paths so they never come back.
    const hasStock =
      (typeof rawUserPhoto === 'string' &&
        rawUserPhoto.trim().startsWith('/avatars/')) ||
      (typeof rawPersonPhoto === 'string' &&
        rawPersonPhoto.trim().startsWith('/avatars/'));
    if (hasStock) {
      void this.usersService
        .updateProfilePhoto(String(user.id), profilePhoto)
        .catch(() => undefined);
    }

    const officer = person
      ? {
          ...person,
          profilePhoto,
        }
      : undefined;

    return {
      ...userWithoutPassword,
      profilePhoto,
      /** Prefer mapped User Details name over users.name */
      name: officerName || userWithoutPassword.name,
      /** Authorization code (Role.code) — use this for guards / UI permission checks */
      role: normalizeAccessKey(roleCode) || roleCode,
      roleName,
      activePost: post
        ? {
            postId: post.postId,
            postName: post.postName,
            ofcAddress: post.ofcAddress,
            locationId: post.locationId,
            location: post.location,
            zoneId: post.zoneId,
            zoneCode: post.zoneCode,
          }
        : undefined,
      officer,
    };
  }

  /** Accept data-URL / remote URL only — ignore empty and stock /avatars paths. */
  static pickUploadedPhoto(
    ...candidates: Array<string | null | undefined>
  ): string | null {
    for (const raw of candidates) {
      const photo = typeof raw === 'string' ? raw.trim() : '';
      if (!photo) continue;
      if (photo.startsWith('/avatars/')) continue;
      return photo;
    }
    return null;
  }

  async verifyToken(token: string): Promise<any> {
    try {
      return this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
