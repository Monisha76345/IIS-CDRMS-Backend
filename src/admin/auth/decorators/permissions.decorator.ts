import { SetMetadata } from '@nestjs/common';

/** CAS-style permission codes, e.g. `USER:VIEW`, `APPLICATION:ADD`. */
export const Permissions = (...permissions: string[]) =>
  SetMetadata('permissions', permissions);
