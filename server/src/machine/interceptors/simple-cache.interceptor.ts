// src/interceptors/simple-cache.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class SimpleCacheInterceptor
  implements NestInterceptor, OnModuleInit, OnModuleDestroy
{
  private static cache = new Map<string, { data: any; timestamp: number }>();
  private cleanupInterval: NodeJS.Timeout;

  protected readonly ttl = 300 * 1000; // 5 minutes
  protected readonly maxCacheSize = 1000;
  protected readonly keyPrefix = 'auto';

  onModuleInit() {
    // Background cleanup every 10 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.performCleanup();
      },
      10 * 60 * 1000,
    );
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    try {
      if (context.getType() !== 'http') {
        return next.handle();
      }

      const request = context.switchToHttp().getRequest<Request>();

      // Skip cache if no_cache parameter exists
      if (request.query.no_cache) {
        console.log(`[SimpleCache] Skipping cache due to no_cache parameter`);
        return next.handle();
      }

      const cacheKey = this.generateCacheKey(request, context);

      // Check cache
      const cachedData = this.getFromCache(cacheKey);
      if (cachedData) {
        console.log(`[SimpleCache] Hit for: ${cacheKey}`);
        return of(cachedData);
      }

      console.log(`[SimpleCache] Miss for: ${cacheKey}`);

      return next.handle().pipe(
        tap((data) => {
          try {
            this.storeInCache(cacheKey, data);
            console.log(`[SimpleCache] Stored result for: ${cacheKey}`);
          } catch (error) {
            console.error(
              `[SimpleCache] Failed to store: ${(error as Error).message}`,
            );
          }
        }),
      );
    } catch (error) {
      console.error(`[SimpleCache] Error: ${(error as Error).message}`);
      return next.handle();
    }
  }

  private generateCacheKey(
    request: Request,
    context: ExecutionContext,
  ): string {
    // Auto-generate prefix from controller and method
    const controllerName = context
      .getClass()
      .name.replace('Controller', '')
      .toLowerCase();
    const methodName = context.getHandler().name;

    const prefix =
      this.keyPrefix === 'auto'
        ? `${controllerName}:${methodName}`
        : this.keyPrefix;

    // Get all query parameters and sort them for consistent keys
    const queryParams = request.query;
    const sortedParams = Object.keys(queryParams)
      .sort()
      .reduce(
        (acc, key) => {
          if (queryParams[key] !== undefined && queryParams[key] !== '') {
            acc[key] = queryParams[key];
          }
          return acc;
        },
        {} as Record<string, any>,
      );

    // Include request path for additional uniqueness
    const path = request.route?.path || request.path;
    const keyData = `${path}:${JSON.stringify(sortedParams)}`;
    const hash = crypto.createHash('md5').update(keyData).digest('hex');

    return `${prefix}:${hash}`;
  }

  private getFromCache(key: string): any {
    const cachedItem = SimpleCacheInterceptor.cache.get(key);
    if (!cachedItem) return null;

    const now = Date.now();
    if (now - cachedItem.timestamp > this.ttl) {
      SimpleCacheInterceptor.cache.delete(key);
      return null;
    }

    return cachedItem.data;
  }

  private storeInCache(key: string, data: any): void {
    // Check cache size limit
    if (SimpleCacheInterceptor.cache.size >= this.maxCacheSize) {
      this.cleanupOldEntries();
    }

    SimpleCacheInterceptor.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  private cleanupOldEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    SimpleCacheInterceptor.cache.forEach((value, key) => {
      if (now - value.timestamp > this.ttl) {
        keysToDelete.push(key);
      }
    });

    // If still over limit, remove oldest entries
    if (
      keysToDelete.length === 0 &&
      SimpleCacheInterceptor.cache.size >= this.maxCacheSize
    ) {
      const entries = Array.from(SimpleCacheInterceptor.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      keysToDelete.push(...entries.slice(0, 100).map((entry) => entry[0]));
    }

    keysToDelete.forEach((key) => SimpleCacheInterceptor.cache.delete(key));

    if (keysToDelete.length > 0) {
      console.log(`[SimpleCache] Cleaned up ${keysToDelete.length} entries`);
    }
  }

  private performCleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    SimpleCacheInterceptor.cache.forEach((value, key) => {
      if (now - value.timestamp > this.ttl) {
        SimpleCacheInterceptor.cache.delete(key);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      console.log(
        `[SimpleCache] Background cleanup: ${cleanedCount} expired entries removed`,
      );
    }
  }

  // Static methods for cache management
  static clearCache(pattern?: string): void {
    if (pattern) {
      const keysToDelete = Array.from(
        SimpleCacheInterceptor.cache.keys(),
      ).filter((key) => key.includes(pattern));
      keysToDelete.forEach((key) => SimpleCacheInterceptor.cache.delete(key));
      console.log(
        `[SimpleCache] Cleared ${keysToDelete.length} entries matching pattern: ${pattern}`,
      );
    } else {
      const size = SimpleCacheInterceptor.cache.size;
      SimpleCacheInterceptor.cache.clear();
      console.log(`[SimpleCache] Cleared all ${size} cache entries`);
    }
  }

  static getCacheStats(): { size: number; keys: string[] } {
    return {
      size: SimpleCacheInterceptor.cache.size,
      keys: Array.from(SimpleCacheInterceptor.cache.keys()),
    };
  }
}
export class MicroCacheInterceptor extends SimpleCacheInterceptor {
  protected readonly ttl = 3 * 1000; // 3 sec
}

export class ShortCacheInterceptor extends SimpleCacheInterceptor {
  protected readonly ttl = 60 * 3 * 1000; // 3 minutes
}

export class MediumCacheInterceptor extends SimpleCacheInterceptor {
  protected readonly ttl = 5 * 60 * 1000; // 5 minutes
}

export class LongCacheInterceptor extends SimpleCacheInterceptor {
  protected readonly ttl = 1800 * 1000; // 30 minute
}
