import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';

/**
 * Keonics-style cache helper over Nest `CACHE_MANAGER`.
 * TTL is always milliseconds (cache-manager v7 / Keyv).
 */
@Injectable()
export class CachingUtil {
  private readonly logger = new Logger(CachingUtil.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  async getCache<T>(key: string): Promise<T | undefined> {
    return this.cacheManager.get<T>(key);
  }

  async setCache(key: string, value: unknown, ttlMs: number): Promise<void> {
    await this.cacheManager.set(key, value, ttlMs);
  }

  async deleteCache(key: string): Promise<void> {
    this.logger.debug(`deleteCache: ${key}`);
    await this.cacheManager.del(key);
  }

  async clearFullCache(): Promise<void> {
    this.logger.warn('clearFullCache');
    // cache-manager v7 uses clear(); older stacks used reset().
    const anyCache = this.cacheManager as Cache & {
      clear?: () => Promise<void>;
      reset?: () => Promise<void>;
    };
    if (typeof anyCache.clear === 'function') {
      await anyCache.clear();
      return;
    }
    if (typeof anyCache.reset === 'function') {
      await anyCache.reset();
    }
  }
}
