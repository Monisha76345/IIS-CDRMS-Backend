import { Logger } from '@nestjs/common';
import type { CacheModuleOptions } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';

/**
 * Build Nest CacheModule options — Redis when REDIS_HOST is set (Keonics pattern),
 * otherwise in-memory. TTL values are milliseconds.
 */
export function cacheModuleOptionsFromEnv(): CacheModuleOptions {
  const logger = new Logger('CacheConfig');
  const host = process.env.REDIS_HOST?.trim();
  const port = process.env.REDIS_PORT?.trim() || '6379';
  const password = process.env.REDIS_PASSWORD?.trim();
  const defaultTtl = process.env.CACHE_TTL_MS?.trim()
    ? Number(process.env.CACHE_TTL_MS)
    : undefined;

  const base: CacheModuleOptions = {
    ...(Number.isFinite(defaultTtl) && defaultTtl! >= 0
      ? { ttl: defaultTtl }
      : {}),
  };

  if (!host) {
    logger.log('Cache store: in-memory (REDIS_HOST not set)');
    return base;
  }

  const auth = password ? `:${encodeURIComponent(password)}@` : '';
  const url = `redis://${auth}${host}:${port}`;

  try {
    const store = createKeyv(url);
    logger.log(`Cache store: Redis ${host}:${port}`);
    return {
      ...base,
      stores: [store],
    };
  } catch (error) {
    logger.error(
      `Redis cache init failed — falling back to in-memory: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return base;
  }
}
