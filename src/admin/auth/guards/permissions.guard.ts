import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { JwtRequestUser } from '../../common/decorators/current-user.decorator';
import { normalizeAccessKey } from '../../common/utils/normalize-access-key';
import { UserType } from '../../users/enums/user-types.enum';

/**
 * Enforces `@Permissions` / `@Roles` metadata against JWT `userType` + `role`.
 * Unlike the Keonics stub (always true), this guard actually checks access.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ??
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request['user'] as JwtRequestUser | undefined;
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    const userKeys = expandAccessKeys([
      user.userType,
      user.role,
      user.roleName,
    ]);

    const allowed = required.some((code) => {
      const needed = expandAccessKeys([code]);
      return [...needed].some((n) => userKeys.has(n));
    });

    if (!allowed) {
      throw new ForbiddenException('Insufficient permissions for this action');
    }
    return true;
  }
}

/** Normalize + add common aliases used across web/mobile. */
function expandAccessKeys(raw: Array<string | null | undefined>): Set<string> {
  const out = new Set<string>();
  for (const value of raw) {
    const key = normalizeAccessKey(value);
    if (!key) continue;
    out.add(key);

    if (key.includes('super_admin') || key === 'admin') {
      out.add(UserType.SUPER_ADMIN);
      out.add('super_admin');
      out.add('admin');
    }
    if (key.includes('zonal') || key === 'zc') {
      out.add(UserType.ZONAL_COMMISSIONER);
      out.add('zonal_commissioner');
      out.add('zc');
    }
    if (key.includes('engineer')) {
      out.add(UserType.ENGINEER);
      out.add('engineer');
    }
    if (key.includes('cao') || key.includes('chief_administrative')) {
      out.add(UserType.CAO);
      out.add('cao');
    }
  }
  return out;
}

/** Nest-style alias matching Keonics RolesGuard naming. */
export { PermissionsGuard as RolesGuard };
