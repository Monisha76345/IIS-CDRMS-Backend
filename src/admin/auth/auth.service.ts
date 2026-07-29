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

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
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

    await this.usersService.touchLastLoggedIn(user.id);

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return {
      user: enriched,
      accessToken,
      refreshToken,
    };
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

    return {
      ...userWithoutPassword,
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
      officer: person || undefined,
    };
  }

  async verifyToken(token: string): Promise<any> {
    try {
      return this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
