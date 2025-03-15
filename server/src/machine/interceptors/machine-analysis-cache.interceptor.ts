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
import { CustomCacheKeyGenerator } from '../../shared/utils/custom-cache-key.generator';
import { Request } from 'express';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

/**
 * Interceptor พิเศษสำหรับแคชชิ่งผลลัพธ์ของ machine analysis endpoint
 * ช่วยลดการทำงานของ server สำหรับการคำนวณที่ใช้ทรัพยากรสูง
 */
@Injectable()
export class MachineAnalysisCacheInterceptor implements NestInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly cacheKeyGenerator: CustomCacheKeyGenerator,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    // ทำงานเฉพาะกับ HTTP requests เท่านั้น
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();

    // ตรวจสอบว่าเป็น endpoint analysis หรือไม่
    if (!request.url.includes('/machine-info/analysis')) {
      return next.handle();
    }

    // สร้าง cache key จากพารามิเตอร์ของ request
    const cacheKey =
      this.cacheKeyGenerator.generateCacheKeyForAnalysis(request);

    // พยายามดึงข้อมูลจาก cache
    const cachedData = await this.cacheManager.get(cacheKey);

    if (cachedData) {
      console.log(`[Cache] Hit for: ${cacheKey}`);
      // ถ้ามีข้อมูลใน cache, ส่งกลับทันที
      return of(cachedData);
    }

    console.log(`[Cache] Miss for: ${cacheKey}`);

    // ถ้าไม่มีข้อมูลใน cache, ดำเนินการต่อและบันทึกผลลงใน cache
    return next.handle().pipe(
      tap(async (data) => {
        // เก็บผลลัพธ์ลง cache (TTL 5 นาที หรือ 300 วินาที)
        await this.cacheManager.set(cacheKey, data, 300);
        console.log(`[Cache] Stored result for: ${cacheKey}`);
      }),
    );
  }
}
