// cache-store.ts
export class SimpleCache {
  private static instance: SimpleCache;
  private cache: Map<string, { data: any; timestamp: number }>;
  private readonly ttl: number;

  private constructor(ttl = 300000) {
    // 5 minutes in milliseconds
    this.cache = new Map();
    this.ttl = ttl;
  }

  public static getInstance(ttl?: number): SimpleCache {
    if (!SimpleCache.instance) {
      SimpleCache.instance = new SimpleCache(ttl);
    }
    return SimpleCache.instance;
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
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  public clear(): void {
    this.cache.clear();
  }
}
