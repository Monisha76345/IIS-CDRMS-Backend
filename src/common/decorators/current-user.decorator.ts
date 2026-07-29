import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type JwtRequestUser = {
  sub: string;
  email?: string;
  /** Account category — e.g. property_manager, tenant, estate_officer */
  userType?: string;
  loginId?: string;
  /** Staff RBAC Role.code from post mapping (Estate Officer etc.) */
  role?: string;
  /** Display / Role.name fallback */
  roleName?: string;
  postId?: string;
  postName?: string;
  personUniqueId?: string;
  officerName?: string;
};

/** JWT payload attached by JwtAuthGuard as `request.user`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtRequestUser => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtRequestUser }>();
    return request.user ?? { sub: '' };
  },
);
