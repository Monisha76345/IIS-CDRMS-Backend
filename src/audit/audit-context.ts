import { AsyncLocalStorage } from 'async_hooks';

export interface AuditContextData {
  userId?: string | null;
  username?: string | null;
  ipAddress?: string | null;
  requestId?: string | null;
  userAgent?: string | null;
}

export const auditContext = new AsyncLocalStorage<AuditContextData>();

export function getAuditContext(): AuditContextData | undefined {
  return auditContext.getStore();
}

export function runWithAuditContext<T>(
  context: AuditContextData,
  fn: () => T,
): T {
  return auditContext.run(context, fn);
}
