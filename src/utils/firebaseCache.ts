import { getDoc, getDocs, DocumentReference, Query, DocumentData, QuerySnapshot, DocumentSnapshot } from 'firebase/firestore';

class FirebaseCache {
  private cache: Map<string, { data: any; timestamp: number }>;
  public ttl: number;
  public stats: { hits: number; misses: number; sets: number };

  constructor(ttl = 5 * 60 * 1000) {
    this.cache = new Map();
    this.ttl = ttl;
    this.stats = { hits: 0, misses: 0, sets: 0 };
  }

  set(key: string, value: any) {
    this.cache.set(key, {
      data: value,
      timestamp: Date.now()
    });
    this.stats.sets++;
    if (__DEV__) console.log(`💾 Cache SET: ${key}`);
  }

  get(key: string): any {
    const item = this.cache.get(key);
    if (!item) {
      this.stats.misses++;
      return null;
    }
    const age = Date.now() - item.timestamp;
    if (age > this.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      if (__DEV__) console.log(`⏰ Cache EXPIRED: ${key} (age: ${(age / 1000).toFixed(1)}s)`);
      return null;
    }
    this.stats.hits++;
    if (__DEV__) console.log(`✅ Cache HIT: ${key}`);
    return item.data;
  }

  delete(key: string) {
    this.cache.delete(key);
    if (__DEV__) console.log(`🗑️  Cache DELETE: ${key}`);
  }

  clear() {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, sets: 0 };
    if (__DEV__) console.log('🧹 Cache CLEARED');
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      size: this.cache.size,
      hitRate: `${hitRate}%`,
      ttl: `${this.ttl / 1000}s`
    };
  }

  deletePattern(pattern: string) {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    if (__DEV__) console.log(`🗑️  Cache DELETE PATTERN: ${pattern} (${count} items)`);
    return count;
  }
}

export const cache = new FirebaseCache();

export async function getCachedDoc(
  docRef: DocumentReference<DocumentData>, 
  fetchFn: typeof getDoc = getDoc
): Promise<any> {
  const cacheKey = docRef.path;
  const cached = cache.get(cacheKey);
  if (cached !== null) return cached;
  
  if (__DEV__) console.log(`🔥 Firebase READ: ${cacheKey}`);
  const docSnap = await fetchFn(docRef);
  
  if (!docSnap.exists()) return null;
  const data = { id: docSnap.id, ...docSnap.data() };
  cache.set(cacheKey, data);
  return data;
}

export async function getCachedCollection(
  queryRef: Query<DocumentData>, 
  fetchFn: typeof getDocs = getDocs
): Promise<any[]> {
  const pathSegments = (queryRef as any)._query?.path?.segments?.join('/') || 'unknown';
  const cacheKey = `collection:${pathSegments}`;
  const cached = cache.get(cacheKey);
  
  if (cached !== null) return cached;
  
  if (__DEV__) console.log(`🔥 Firebase COLLECTION READ: ${cacheKey}`);
  const snapshot = await fetchFn(queryRef);
  const data = snapshot.docs.map((doc: any) => ({
    id: doc.id,
    ...doc.data()
  }));
  
  cache.set(cacheKey, data);
  return data;
}

export function invalidateCache(path: string) {
  cache.delete(path);
  const collectionPath = path.split('/').slice(0, -1).join('/');
  cache.deletePattern(`collection:${collectionPath}`);
}

export default cache;
