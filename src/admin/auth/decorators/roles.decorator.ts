import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Alias for role-based route access (same codes as `@Permissions`). */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
