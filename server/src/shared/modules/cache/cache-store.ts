// cache-store.ts
export class SimpleCache {
  private static instance: SimpleCache;
  private cache: Map<string, { data: any; timestamp: number }>;
  private readonly ttl: number;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly maxSize: number;

  private constructor(ttl = 300000, maxSize = 1000) {
    // 5 minutes in milliseconds
    this.cache = new Map();
    this.ttl = ttl;
    this.maxSize = maxSize;
    this.setupCleanupInterval();
  }

  public static getInstance(ttl?: number, maxSize?: number): SimpleCache {
    if (!SimpleCache.instance) {
      SimpleCache.instance = new SimpleCache(ttl, maxSize);
    }
    return SimpleCache.instance;
  }

  private setupCleanupInterval(): void {
    // ล้างตัวจับเวลาเดิม (ถ้ามี) เพื่อป้องกันการสร้างหลายตัว
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let expiredCount = 0;

      this.cache.forEach((value, key) => {
        if (now - value.timestamp > this.ttl) {
          this.cache.delete(key);
          expiredCount++;
        }
      });

      // Log ข้อมูลเฉพาะเมื่อมีการลบรายการ เพื่อลดการรบกวน log
      if (expiredCount > 0) {
        console.debug(
          `Cache cleanup: removed ${expiredCount} items. Current size: ${this.cache.size}`,
        );
      }
    }, 60000); // ทำการล้างแคชทุก 1 นาที
  }

  public get(key: string): any {
    const item = this.cache.get(key);
    if (!item) return null;

    const now = Date.now();
    if (now - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  public set(key: string, data: any): void {
    // ถ้าแคชเต็ม ลบรายการที่เก่าที่สุด
    if (this.maxSize > 0 && this.cache.size >= this.maxSize) {
      let oldestKey = null;
      let oldestTime = Infinity;

      this.cache.forEach((value, k) => {
        if (value.timestamp < oldestTime) {
          oldestKey = k;
          oldestTime = value.timestamp;
        }
      });

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, { data, timestamp: Date.now() });
  }

  public clear(): void {
    this.cache.clear();
  }

  // ฟังก์ชันเพิ่มเติม

  // ลบเฉพาะคีย์ที่ระบุ
  public invalidate(key: string): void {
    this.cache.delete(key);
  }

  // ลบทุกคีย์ที่ตรงกับรูปแบบ
  public invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  // ลบคีย์ที่เริ่มต้นด้วยคำที่กำหนด
  public invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  // ขยายอายุของคีย์
  public extendTTL(key: string, additionalTime: number = this.ttl): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    this.cache.set(key, { data: item.data, timestamp: Date.now() });
    return true;
  }

  // ดูขนาดของแคชปัจจุบัน
  public size(): number {
    return this.cache.size;
  }

  // ตรวจสอบว่ามีคีย์อยู่ในแคชหรือไม่ โดยไม่ตรวจสอบ TTL
  public has(key: string): boolean {
    return this.cache.has(key);
  }

  // ดูสถิติของแคช
  public getStats(): {
    size: number;
    keys: string[];
    maxSize: number;
    ttl: number;
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      maxSize: this.maxSize,
      ttl: this.ttl,
    };
  }

  // ล้างทรัพยากร
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    SimpleCache.instance = null;
  }
}
