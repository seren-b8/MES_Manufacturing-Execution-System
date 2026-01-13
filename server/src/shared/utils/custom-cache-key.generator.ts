import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class CustomCacheKeyGenerator {
  // สร้าง cache key ตาม query parameters
  generateCacheKeyForAnalysis(request: Request): string {
    const { start_date, end_date, interval_minutes, machine_numbers } =
      request.query;

    // สร้าง cache key จากพารามิเตอร์ทั้งหมด
    const keyParams = `${start_date}:${end_date}:${interval_minutes}:${machine_numbers || 'all'}`;

    // ใช้ hash function เพื่อทำให้ key มีขนาดคงที่
    return `machine-analysis:${crypto.createHash('md5').update(keyParams).digest('hex')}`;
  }
}
