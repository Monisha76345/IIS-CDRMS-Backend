import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * CAS-style roles guard.
 * No role–menu mapping yet — allow through; JwtAuthGuard still protects routes.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}
