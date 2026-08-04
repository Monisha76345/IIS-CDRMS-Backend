import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/** Throttler that no-ops when ENABLE_RATE_LIMITING is not "true". */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard implements CanActivate {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (process.env.ENABLE_RATE_LIMITING !== 'true') {
      return true;
    }
    return super.shouldSkip(context);
  }
}
