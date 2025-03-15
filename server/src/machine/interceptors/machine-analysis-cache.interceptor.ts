// ปรับ MachineAnalysisCacheInterceptor
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Cache } from 'cache-manager';
import { CustomCacheKeyGenerator } from 'src/shared/utils/custom-cache-key.generator';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class MachineAnalysisCacheInterceptor implements NestInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly cacheKeyGenerator: CustomCacheKeyGenerator,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const cacheKey = this.generateCacheKey(request);

    try {
      const cachedData = await this.cacheManager.get(cacheKey);

      if (cachedData) {
        console.log(`[Cache] Hit for: ${cacheKey}`);
        return of(cachedData);
      }

      console.log(`[Cache] Miss for: ${cacheKey}`);

      return next.handle().pipe(
        tap(async (data) => {
          try {
            await this.cacheManager.set(cacheKey, data, 300);
            console.log(`[Cache] Stored result for: ${cacheKey}`);
          } catch (error) {
            console.error(`[Cache] Error storing: ${(error as Error).message}`);
          }
        }),
      );
    } catch (error) {
      console.error(`[Cache] Error: ${(error as Error).message}`);
      return next.handle();
    }
  }

  private generateCacheKey(request: any): string {
    const { start_date, end_date, interval_minutes, machine_numbers } =
      request.query;
    const keyString = `${start_date}|${end_date}|${interval_minutes}|${machine_numbers || ''}`;
    const hash = require('crypto')
      .createHash('md5')
      .update(keyString)
      .digest('hex');
    return `machine-analysis:${hash}`;
  }
}
