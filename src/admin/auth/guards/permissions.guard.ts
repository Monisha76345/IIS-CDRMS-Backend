import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * CAS-style permissions guard.
 * No role–menu mapping yet — keep annotations; do not enforce until enabled.
 */
const ENABLE_PERMISSION_CHECK = false;

type JwtUserWithPermissions = {
  loginId?: string;
  permissions?: string[];
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (!ENABLE_PERMISSION_CHECK) {
      return true;
    }

    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtUserWithPermissions | undefined;

    if (!user || !user.permissions) {
      this.logger.warn(
        `Permissions Guard: User or user permissions missing in JWT for ${request.method} ${request.url}`,
      );
      throw new ForbiddenException('Missing user permissions.');
    }

    const hasPermission = requiredPermissions.some((permission) =>
      user.permissions!.includes(permission),
    );

    if (!hasPermission) {
      this.logger.warn(
        `Permissions Guard: User ${user.loginId} lacks required permissions for ${request.method} ${request.url}. Required: ${requiredPermissions.join(', ')}, User has: ${user.permissions.join(', ')}`,
      );
      throw new ForbiddenException('Insufficient permissions.');
    }

    return true;
  }
}
