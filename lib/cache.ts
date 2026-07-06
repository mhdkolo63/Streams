/**
 * Lightweight in-memory TTL cache for client-side data.
 * Automatically expires stale entries and supports manual invalidation.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const DEFAULT_TTL = 60_000; // 1 minute

class TTLCache {
  private store = new Map<string, CacheEntry<any>>();
  private listeners = new Map<string, Set<() => void>>();

  set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttl });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  invalidate(key: string): void {
    this.store.delete(key);
    this.notify(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        this.notify(key);
      }
    }
  }

  clear(): void {
    const keys = Array.from(this.store.keys());
    this.store.clear();
    keys.forEach(k => this.notify(k));
  }

  subscribe(key: string, callback: () => void): () => void {
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key)!.add(callback);
    return () => { this.listeners.get(key)?.delete(callback); };
  }

  private notify(key: string): void {
    this.listeners.get(key)?.forEach(cb => cb());
  }
}

export const cache = new TTLCache();

export const CACHE_KEYS = {
  profile: (userId: string) => `profile:${userId}`,
  categories: 'categories:all',
  homepageFeatured: 'homepage:featured',
  homepageRecent: 'homepage:recent',
  homepageTrending: 'homepage:trending',
  homepageMostWatched: 'homepage:most-watched',
  homepageContinueWatching: (userId: string) => `homepage:continue:${userId}`,
  searchResults: (query: string) => `search:${query}`,
  searchFilters: 'search:filters',
  watchHistory: (userId: string) => `history:${userId}`,
  favorites: (userId: string) => `favorites:${userId}`,
  notifications: (userId: string) => `notifications:${userId}`,
  videoDetail: (videoId: string) => `video:${videoId}`,
  categoryVideos: (slug: string) => `category:${slug}`,
  adminStats: 'admin:stats',
  adminVideos: 'admin:videos',
} as const;

export const CACHE_TTL = {
  short: 30_000,
  medium: 60_000,
  long: 300_000,
  veryLong: 600_000,
} as const;
