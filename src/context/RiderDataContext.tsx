import React, {
  createContext, useContext, useState, useEffect, ReactNode,
} from 'react';
import {
  collection, query, where, orderBy, limit,
  onSnapshot, db, rtdb
} from '../config/firebase';
import { ref, onValue, off } from 'firebase/database';
import { Timestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import { useOrderStore, Order } from '../store/orderStore';
import { RTDB_PATHS } from '../config/constants';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Transaction {
  id: string;
  riderId: string;
  type: 'cash_collection' | 'collection' | 'admin_transfer' | 'transfer';
  amount: number;
  orderSeq?: string;
  orderId?: string;
  createdAt?: Timestamp;
}

export interface RiderStats {
  todayCash: number;
  todayDeliveredCount: number;
  totalCash: number;
  totalTransferred: number;
  cashTxs: Transaction[];
}

interface RiderDataContextValue {
  activeOrders: Order[];
  completedOrders: Order[];
  transactions: Transaction[];
  totalDelivered: number;
  stats: RiderStats;
  loading: boolean;
  totalUnread: number;
  chatUnread: number;
  walletUnread: number;
  activeStatDrawer: string | null;
  setActiveStatDrawer: (type: string | null) => void;
  showReviewsDrawer: boolean;
  setShowReviewsDrawer: (show: boolean) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const RiderDataContext = createContext<RiderDataContextValue>({
  activeOrders: [],
  completedOrders: [],
  transactions: [],
  totalDelivered: 0,
  stats: { todayCash: 0, todayDeliveredCount: 0, totalCash: 0, totalTransferred: 0, cashTxs: [] },
  loading: true,
  totalUnread: 0,
  chatUnread: 0,
  walletUnread: 0,
  activeStatDrawer: null,
  setActiveStatDrawer: () => {},
  showReviewsDrawer: false,
  setShowReviewsDrawer: () => {},
});

const ACTIVE_STATUSES = [
  'assigned', 'accepted', 'go_to_branch', 'arrived_at_branch',
  'picked', 'out_for_delivery', 'arrived_at_customer',
  'returning_to_branch',
];

const COMPLETED_STATUSES = ['delivered', 'cancelled', 'returned'];

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function RiderDataProvider({ children }: { children: ReactNode }) {
  const { rider } = useAuthStore();
  const { setActiveOrder, setNewOrderPopup, activeOrder: storedActiveOrder } = useOrderStore();

  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalDelivered, setTotalDelivered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [totalUnread, setTotalUnread] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  const [walletUnread, setWalletUnread] = useState(0);
  const [activeStatDrawer, setActiveStatDrawer] = useState<string | null>(null);
  const [showReviewsDrawer, setShowReviewsDrawer] = useState(false);

  // ─── Unread Logic (Chat + Orders + Wallet) ──────────────────────────────────
  useEffect(() => {
    const unreadOrders = activeOrders.filter(o => o.status === 'assigned').length;
    setTotalUnread(unreadOrders + chatUnread + walletUnread);
  }, [activeOrders, chatUnread, walletUnread]);

  // 1. Track Chat Unreads via RTDB
  useEffect(() => {
    if (!rider?.uid || activeOrders.length === 0) {
      setChatUnread(0);
      return;
    }

    const orderIds = activeOrders.map(o => o.id);
    const counts: Record<string, number> = {};
    const unsubs = orderIds.map(id => {
      const chatRef = ref(rtdb, RTDB_PATHS.chat(id));
      return onValue(chatRef, (snap) => {
        const data = snap.val();
        const count = data ? Object.values(data).filter((m: any) => m.senderRole === 'customer' && !m.read).length : 0;
        counts[id] = count;
        
        // Use a timeout to batch updates if multiple chats update at once
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        setChatUnread(prev => prev === total ? prev : total);
      });
    });

    return () => unsubs.forEach(u => u());
  }, [activeOrders, rider?.uid]);

  // 2. Track Wallet Unreads (new transactions since last visit)
  useEffect(() => {
    if (transactions.length === 0) return;
    AsyncStorage.getItem('last_wallet_view').then(val => {
      const lastView = Number(val || 0);
      const newTxCount = transactions.filter(tx => {
        const t = tx.createdAt?.toMillis?.() || (tx.createdAt as any)?.seconds * 1000 || 0;
        return t > lastView;
      }).length;
      setWalletUnread(newTxCount);
    });
  }, [transactions]);

  useEffect(() => {
    if (!rider?.uid) return;
    const uid = rider.uid;

    // ── Active orders listener ──────────────────────────────────────────────
    // 1. ACTIVE ORDERS (Pending, Assigned, Picked...)
    const activeQ = query(
      collection(db, 'orders'),
      where('riderId', '==', uid),
      where('status', 'in', ['pending', 'assigned', 'accepted', 'go_to_branch', 'arrived_at_branch', 'picked', 'out_for_delivery', 'arrived_at_customer', 'returning_to_branch'])
    );

    const unsubActive = onSnapshot(activeQ, (snap: any) => {
      const orders = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Order));
      
      setActiveOrders(prev => {
        // Simple comparison to prevent re-render if data is identical
        const prevIds = prev.map((o: Order) => o.id + (o.status || '') + (o.batchId || '')).sort().join(',');
        const nextIds = orders.map((o: Order) => o.id + (o.status || '') + (o.batchId || '')).sort().join(',');
        if (prevIds === nextIds) return prev;
        return orders;
      });

      // Sync first active order to orderStore
      const first = orders[0] ?? null;
      setActiveOrder(first);

      // New order popup: only show if status is 'assigned' and not already seen
      const newOrder = orders.find((o: any) => o.status === 'assigned');
      if (newOrder && storedActiveOrder?.id !== newOrder.id) {
        setNewOrderPopup(newOrder);
      }

      setLoading(false);
    });

    // 2. COMPLETED ORDERS (Recent 100 for History/Stats)
    const completedQ = query(
      collection(db, 'orders'),
      where('riderId', '==', uid),
      where('status', 'in', ['delivered', 'success', 'cancelled', 'returned']),
      orderBy('updatedAt', 'desc'),
      limit(100)
    );

    const unsubCompleted = onSnapshot(completedQ, (snap: any) => {
      const orders = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Order));
      setCompletedOrders(orders);
      setTotalDelivered(orders.filter((o: any) => o.status === 'delivered').length);
    });

    // ── Transactions listener (last 100) ───────────────────────────────────
    const txQ = query(
      collection(db, 'transactions'),
      where('riderId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubTx = onSnapshot(txQ, (snap: any) => {
      setTransactions(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Transaction)));
    });

    return () => { unsubActive(); unsubCompleted(); unsubTx(); };
  }, [rider?.uid]);

  // ── Computed stats ──────────────────────────────────────────────────────────
  const stats: RiderStats = React.useMemo(() => {
    const today = todayStart();
    const cashTxs = transactions.filter(
      tx => tx.type === 'cash_collection' || tx.type === 'collection'
    );
    const transferTxs = transactions.filter(
      tx => tx.type === 'admin_transfer' || tx.type === 'transfer'
    );

    const todayCashTxs = cashTxs.filter(tx => {
      const d = tx.createdAt?.toDate?.();
      return d && d >= today;
    });

    const todayDeliveredCount = completedOrders.filter(o => {
      if (o.status !== 'delivered') return false;
      const d = (o as any).deliveredAt?.toDate?.();
      return d && d >= today;
    }).length;

    return {
      todayCash: todayCashTxs.reduce((s, tx) => s + (tx.amount || 0), 0),
      todayDeliveredCount,
      totalCash: cashTxs.reduce((s, tx) => s + (tx.amount || 0), 0),
      totalTransferred: transferTxs.reduce((s, tx) => s + (tx.amount || 0), 0),
      cashTxs,
    };
  }, [transactions, completedOrders]);

  return (
    <RiderDataContext.Provider value={{
      activeOrders, completedOrders, transactions,
      totalDelivered, stats, loading, totalUnread,
      chatUnread, walletUnread,
      activeStatDrawer, setActiveStatDrawer,
      showReviewsDrawer, setShowReviewsDrawer,
    }}>
      {children}
    </RiderDataContext.Provider>
  );
}

export function useRiderData(): RiderDataContextValue {
  return useContext(RiderDataContext);
}
