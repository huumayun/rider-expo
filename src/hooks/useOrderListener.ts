import { useEffect, useState } from 'react';
import {
  collection, query, where, onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Order } from '../store/orderStore';

const ACTIVE_STATUSES = [
  'assigned', 'accepted', 'arrived_at_branch',
  'picked', 'out_for_delivery', 'arrived_at_customer',
  'returning_to_branch',
];

interface UseOrderListenerReturn {
  activeOrder: Order | null;
  loading: boolean;
}

export function useOrderListener(riderId: string | undefined): UseOrderListenerReturn {
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!riderId) {
      setActiveOrder(null);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'orders'),
      where('riderId', '==', riderId),
      where('status', 'in', ACTIVE_STATUSES)
    );

    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) {
        setActiveOrder(null);
      } else {
        // Prefer the first non-'assigned' order (in-progress over new)
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
        const inProgress = docs.find(o => o.status !== 'assigned');
        setActiveOrder(inProgress ?? docs[0]);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [riderId]);

  return { activeOrder, loading };
}
