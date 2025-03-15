// src/machine/interceptors/simple-cache.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class SimpleCacheInterceptor implements NestInterceptor {
  private static cache = new Map<string, { data: any; timestamp: number }>();
  private readonly ttl = 300 * 1000; // 5 minutes in milliseconds

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const cacheKey = this.generateCacheKey(request);

    // ตรวจสอบว่ามีข้อมูลในแคชหรือไม่
    const cachedData = this.getFromCache(cacheKey);
    if (cachedData) {
      console.log(`[SimpleCache] Hit for: ${cacheKey}`);
      return of(cachedData);
    }

    console.log(`[SimpleCache] Miss for: ${cacheKey}`);

    // ถ้าไม่มีข้อมูลในแคช ให้ดำเนินการต่อและบันทึกผลลงในแคช
    return next.handle().pipe(
      tap((data) => {
        this.storeInCache(cacheKey, data);
        console.log(`[SimpleCache] Stored result for: ${cacheKey}`);
      }),
    );
  }

  private generateCacheKey(request: Request): string {
    const { start_date, end_date, interval_minutes, machine_numbers } =
      request.query;
    const keyData = `${start_date}-${end_date}-${interval_minutes}-${machine_numbers || ''}`;
    const hash = crypto.createHash('md5').update(keyData).digest('hex');
    return `machine-analysis:${hash}`;
  }

  private getFromCache(key: string): any {
    const cachedItem = SimpleCacheInterceptor.cache.get(key);
    if (!cachedItem) return null;

    const now = Date.now();
    if (now - cachedItem.timestamp > this.ttl) {
      // ข้อมูลหมดอายุแล้ว
      SimpleCacheInterceptor.cache.delete(key);
      return null;
    }

    return cachedItem.data;
  }

  private storeInCache(key: string, data: any): void {
    SimpleCacheInterceptor.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }
}
