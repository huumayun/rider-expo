import { useEffect, useState, useCallback, useRef } from 'react';
import {
  collection, query, where, orderBy, limit,
  getDocs, startAfter, QueryDocumentSnapshot, DocumentData,
} from 'firebase/firestore';
import { db } from '../config/firebase';

interface UsePaginationOptions {
  collectionName: string;
  filters?: { field: string; op: any; value: any }[];
  orderByField?: string;
  orderByDir?: 'asc' | 'desc';
  pageSize?: number;
  enabled?: boolean;
}

interface UsePaginationReturn<T> {
  data: T[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePagination<T = any>({
  collectionName,
  filters = [],
  orderByField = 'createdAt',
  orderByDir = 'desc',
  pageSize = 20,
  enabled = true,
}: UsePaginationOptions): UsePaginationReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  const buildQuery = useCallback((afterDoc?: QueryDocumentSnapshot<DocumentData> | null) => {
    let q = query(
      collection(db, collectionName),
      ...filters.map(f => where(f.field, f.op, f.value)),
      orderBy(orderByField, orderByDir),
      limit(pageSize)
    );
    if (afterDoc) {
      q = query(
        collection(db, collectionName),
        ...filters.map(f => where(f.field, f.op, f.value)),
        orderBy(orderByField, orderByDir),
        startAfter(afterDoc),
        limit(pageSize)
      );
    }
    return q;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, orderByField, orderByDir, pageSize]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setData([]);
    lastDocRef.current = null;
    try {
      const snap = await getDocs(buildQuery());
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() } as T)));
      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
      setHasMore(snap.docs.length === pageSize);
    } catch (e) {
      console.error('[usePagination] refresh error:', e);
    }
    setLoading(false);
  }, [buildQuery, enabled, pageSize]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading || !lastDocRef.current) return;
    setLoadingMore(true);
    try {
      const snap = await getDocs(buildQuery(lastDocRef.current));
      setData(prev => [...prev, ...snap.docs.map(d => ({ id: d.id, ...d.data() } as T))]);
      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
      setHasMore(snap.docs.length === pageSize);
    } catch (e) {
      console.error('[usePagination] loadMore error:', e);
    }
    setLoadingMore(false);
  }, [buildQuery, hasMore, loading, loadingMore, pageSize]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, loadingMore, hasMore, loadMore, refresh };
}
