import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { View, Text, Pressable, ScrollView, Animated as RNAnimated, Dimensions, ActivityIndicator, Modal, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, usePathname } from 'expo-router';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, getDocs, startAfter, limit, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Package, Clock, MapPin, ChevronRight, History, PlayCircle, Calendar, MessageSquare, ArrowLeft, Navigation, CheckCircle2 } from 'lucide-react-native';
import { useAuthStore } from '../../store/authStore';
import { useApp } from '../../context/AppContext';
import { useLocation } from '../../context/LocationContext';
import { calculateDistance } from '../../utils/batchUtils';
import OrderDetailsModal from '../../components/modals/OrderDetailsModal';
import ChatWindow from '../../components/chat/ChatWindow';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../../config/firebase';
import { RTDB_PATHS } from '../../config/constants';

// Realtime UnreadBadge
const UnreadBadge = memo(({ orderId, bg }: { orderId: string, bg: string }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!orderId) return;
    const chatRef = ref(rtdb, RTDB_PATHS.chat(orderId));
    const unsub = onValue(chatRef, (snap) => {
      if (snap.exists()) {
        const msgs = Object.values(snap.val() as any);
        const newCount = msgs.filter((m: any) => m.senderRole === 'customer' && !m.read).length;
        setCount(newCount);
      } else {
        setCount(0);
      }
    });
    return () => unsub();
  }, [orderId]);

  if (count === 0) return null;
  return (
    <View style={{ position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, backgroundColor: '#ff4d6d', borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: bg }}>
      <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>{count}</Text>
    </View>
  );
});
const branchCache: Record<string, string> = {};
const BranchName = memo(({ branchId }: { branchId: string }) => {
  const [name, setName] = useState(branchCache[branchId] || '—');
  useEffect(() => {
    if (!branchId || branchCache[branchId]) return;
    const unsub = onSnapshot(doc(db, 'branches', branchId), (snap) => {
      if (snap.exists()) {
        const n = snap.data().location?.name || snap.data().name || '—';
        branchCache[branchId] = n;
        setName(n);
      }
    });
    return () => unsub();
  }, [branchId]);
  return <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '800', color: '#1e293b' }}>{name}</Text>;
});

const SMAP: Record<string, any> = {
  assigned: { solid: '#3b82f6', dark: '#60a5fa', label: { bn: 'নতুন অর্ডার', en: 'New Order' }, icon: 'pkg', isNew: true },
  accepted: { solid: '#f59e0b', dark: '#fbbf24', label: { bn: 'পিক করতে যান', en: 'Go to Pickup' }, icon: 'pkg' },
  go_to_branch: { solid: '#f59e0b', dark: '#fbbf24', label: { bn: 'ব্রাঞ্চে যাচ্ছি', en: 'Going to Branch' }, icon: 'nav' },
  arrived_at_branch: { solid: '#6366f1', dark: '#818cf8', label: { bn: 'ব্রাঞ্চে আছি', en: 'At Branch' }, icon: 'pkg' },
  picked: { solid: '#8b5cf6', dark: '#a78bfa', label: { bn: 'পার্সেল সাথে', en: 'Picked Up' }, icon: 'pkg' },
  out_for_delivery: { solid: '#f97316', dark: '#fb923c', label: { bn: 'পথে আছি', en: 'On The Way' }, icon: 'nav' },
  arrived_at_customer: { solid: '#22c55e', dark: '#4ade80', label: { bn: 'কাস্টমারের কাছে', en: 'Near Customer' }, icon: 'check' },
  delivered: { solid: '#10b981', dark: '#34d399', label: { bn: 'ডেলিভারড', en: 'Delivered' }, icon: 'check' },
  success: { solid: '#10b981', dark: '#34d399', label: { bn: 'সফল', en: 'Success' }, icon: 'check' },
  cancelled: { solid: '#ef4444', dark: '#f87171', label: { bn: 'বাতিল', en: 'Cancelled' }, icon: 'check' }
};

const getS = (s: string, lang: string, isDark: boolean) => {
  const m = SMAP[s] ?? { solid: '#3b82f6', dark: '#60a5fa', label: { bn: 'সক্রিয়', en: 'Active' }, icon: 'pkg' };
  return { ...m, color: isDark ? m.dark : m.solid, labelText: m.label[lang] || m.label.en };
};

const Pill = memo(({ active, label, onClick, color, T, isDark, scrollX, index, width, Icon }: any) => {
  const bg = scrollX.interpolate({
    inputRange: [(index - 1) * width, index * width, (index + 1) * width],
    outputRange: ['transparent', T.accent, 'transparent'],
    extrapolate: 'clamp'
  });

  const tx = scrollX.interpolate({
    inputRange: [(index - 1) * width, index * width, (index + 1) * width],
    outputRange: [T.sub, '#fff', T.sub],
    extrapolate: 'clamp'
  });

  return (
    <Pressable onPress={onClick} style={{ flex: 1 }}>
      <RNAnimated.View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
        paddingVertical: 13, borderRadius: 16, backgroundColor: bg
      }}>
        <Icon size={14} color={active ? '#fff' : T.sub} strokeWidth={2} />
        <RNAnimated.Text style={{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, color: tx }}>
          {label}
        </RNAnimated.Text>
      </RNAnimated.View>
    </Pressable>
  );
});

export default function OrdersPage() {
  const { T, t, lang, theme, font, showToast } = useApp();
  const { width } = Dimensions.get('window');
  const router = useRouter();
  const isDark = theme === 'dark';
  const surf = isDark ? T.surface : '#ffffff';
  const surfHi = isDark ? T.hi : '#f5f5f5';

  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const scrollX = useRef(new RNAnimated.Value(0)).current;
  const listRef = useRef<any>(null);

  const { rider } = useAuthStore();
  const riderId = rider?.uid;

  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [activeChatOrder, setActiveChatOrder] = useState<any | null>(null);
  const [totalUnread, setTotalUnread] = useState(0);

  const { currentLocation: livePos } = useLocation();

  const handleUnbatch = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { 
        batchId: null, 
        updatedAt: serverTimestamp() 
      });
    } catch (e) {
      console.error("Error unbatching order:", e);
    }
  };

  // Global Unread Badge Listener
  useEffect(() => {
    if (!activeOrders || activeOrders.length === 0) {
      setTotalUnread(0);
      return;
    }
    
    const counts: Record<string, number> = {};
    const unsubs: (() => void)[] = [];

    activeOrders.forEach(o => {
      const chatRef = ref(rtdb, RTDB_PATHS.chat(o.id));
      const unsub = onValue(chatRef, (snap) => {
        if (snap.exists()) {
          const msgs = Object.values(snap.val() as any);
          counts[o.id] = msgs.filter((m: any) => m.senderRole === 'customer' && !m.read).length;
        } else {
          counts[o.id] = 0;
        }
        setTotalUnread(Object.values(counts).reduce((a, b) => a + b, 0));
      });
      unsubs.push(() => unsub());
    });

    return () => unsubs.forEach(u => u());
  }, [activeOrders]);

  const [historyOrders, setHistoryOrders] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const lastDocRef = useRef<any>(null);

  // History Listener (First Page)
  useEffect(() => {
    if (!riderId) return;
    const q = query(
      collection(db, 'orders'),
      where('riderId', '==', riderId),
      where('status', 'in', ['delivered', 'cancelled', 'success', 'returned']),
      orderBy('updatedAt', 'desc'),
      limit(20)
    );

    const unsub = onSnapshot(q, (snap) => {
      setHistoryOrders(prev => {
        const snapData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const otherData = prev.filter(p => !snapData.find(s => s.id === p.id));
        const combined = [...snapData, ...otherData].sort((a: any, b: any) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
        if (!lastDocRef.current) lastDocRef.current = snap.docs[snap.docs.length - 1];
        return combined;
      });
    });
    return () => unsub();
  }, [riderId]);

  const loadMore = async () => {
    if (historyLoading || !hasMore || !lastDocRef.current) return;
    setHistoryLoading(true);
    try {
      const q = query(
        collection(db, 'orders'),
        where('riderId', '==', riderId),
        where('status', 'in', ['delivered', 'cancelled', 'success', 'returned']),
        orderBy('updatedAt', 'desc'),
        startAfter(lastDocRef.current),
        limit(20)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setHasMore(false);
      } else {
        const newData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setHistoryOrders(prev => [...prev, ...newData]);
        lastDocRef.current = snap.docs[snap.docs.length - 1];
      }
    } catch (e) {
      console.error(e);
    }
    setHistoryLoading(false);
  };

  useEffect(() => {
    if (!riderId) return;
    setLoading(true);
    const q = query(
      collection(db, 'orders'),
      where('riderId', '==', riderId),
      where('status', 'in', ['assigned', 'accepted', 'go_to_branch', 'arrived_at_branch', 'picked', 'out_for_delivery', 'arrived_at_customer', 'returning_to_branch']),
      orderBy('updatedAt', 'desc')
    );

    let isInitialLoad = true;
    const unsub = onSnapshot(q, (snap) => {
      if (!isInitialLoad && showToast) {
        snap.docChanges().forEach(change => {
          const o = change.doc.data();
          if (change.type === 'added' && o.status === 'assigned') {
            showToast?.(t('popup_new') || 'New Order assigned', `#${o.id} - ${o.customer?.address || ''}`, 'new_order');
          }
        });
      }
      isInitialLoad = false;

      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setActiveOrders(data);
      setLoading(false);
    });
    return () => unsub();
  }, [riderId]);

  const onTabPress = (index: number) => {
    setActiveTab(index === 0 ? 'active' : 'history');
    listRef.current?.scrollToOffset({ offset: index * width, animated: true });
  };

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const td = historyOrders.filter((o: any) => {
      const d = o.updatedAt?.toDate ? o.updatedAt.toDate().toDateString() : null;
      return d === today && (o.status === 'delivered' || o.status === 'success');
    });
    return { count: td.length, amount: td.reduce((a: any, c: any) => a + (Number(c.totalAmount) || 0), 0) };
  }, [historyOrders]);

  const groupedActive = useMemo(() => {
    const label = lang === 'bn' ? 'সক্রিয়' : 'Active';
    const batches: Record<string, any[]> = {};
    activeOrders.forEach((o: any) => {
      const isUnpicked = ['assigned', 'accepted', 'go_to_branch', 'arrived_at_branch'].includes(o.status);
      const bid = isUnpicked ? `pickup_${o.branchId}` : (o.batchId || o.id);
      if (!batches[bid]) batches[bid] = [];
      batches[bid].push(o);
    });
    return { [label]: Object.values(batches).sort((a: any, b: any) => (b[0].updatedAt?.seconds || 0) - (a[0].updatedAt?.seconds || 0)) };
  }, [activeOrders, lang]);

  const { soloGroups, batchGroups } = useMemo(() => {
    const activeBatches = Object.values(groupedActive)[0] || [];
    const solo = activeBatches.filter(g => g.length === 1);
    const batches = activeBatches.filter(g => g.length > 1);
    return { soloGroups: solo, batchGroups: batches };
  }, [groupedActive]);

  const smartRecommendation = useMemo(() => {
    if (!livePos || activeOrders.length === 0) return null;

    const unpicked = activeOrders.filter(o => 
      ['assigned', 'accepted', 'go_to_branch', 'arrived_at_branch'].includes(o.status)
    );
    const picked = activeOrders.filter(o => 
      ['picked', 'out_for_delivery', 'arrived_at_customer'].includes(o.status)
    );

    let nearestUnpickedBatch: any = null;
    let minBranchDist = Infinity;
    
    if (unpicked.length > 0) {
      unpicked.forEach(o => {
        const b = o as any;
        let bLat = b.branchLocation?.lat ?? b.branchLocation?.latitude ?? b.branchDetail?.location?.lat ?? b.branchDetail?.location?.latitude ?? b.branch?.location?.lat;
        let bLng = b.branchLocation?.lng ?? b.branchLocation?.longitude ?? b.branchDetail?.location?.lng ?? b.branchDetail?.location?.longitude ?? b.branch?.location?.lng;
        if (bLat && bLng) {
          const dist = calculateDistance(livePos.lat, livePos.lng, Number(bLat), Number(bLng));
          if (dist < minBranchDist) {
            minBranchDist = dist;
            nearestUnpickedBatch = o;
          }
        }
      });
    }

    let nearestPickedOrder: any = null;
    let minCustomerDist = Infinity;

    if (picked.length > 0) {
      picked.forEach(o => {
        const c = o as any;
        const lat = c.customerLocation?.lat ?? c.customerLocation?.latitude ?? c.customer?.location?.lat ?? c.customer?.location?.latitude ?? c.customer?.address?.lat;
        const lng = c.customerLocation?.lng ?? c.customerLocation?.longitude ?? c.customer?.location?.lng ?? c.customer?.location?.longitude ?? c.customer?.address?.lng;
        if (lat && lng) {
          const dist = calculateDistance(livePos.lat, livePos.lng, Number(lat), Number(lng));
          if (dist < minCustomerDist) {
            minCustomerDist = dist;
            nearestPickedOrder = o;
          }
        }
      });
    }

    const showPickup = unpicked.length > 0 && (picked.length === 0 || minBranchDist < minCustomerDist);

    if (showPickup && nearestUnpickedBatch) {
      const bid = nearestUnpickedBatch.batchId || nearestUnpickedBatch.id;
      const batchCount = activeOrders.filter(o => (o.batchId || o.id) === bid).length;
      return {
        type: 'pickup',
        targetId: bid,
        distance: minBranchDist,
        title: lang === 'bn' ? '💡 সাজেস্টেড পিকআপ ট্রিপ' : '💡 Suggested Pickup Trip',
        sub: lang === 'bn' ? `শাখাটি আপনার থেকে ${minBranchDist >= 1000 ? `${(minBranchDist/1000).toFixed(1)} km` : `${Math.round(minBranchDist)} m`} দূরে। (${batchCount}টি অর্ডার)` : `Branch is ${minBranchDist >= 1000 ? `${(minBranchDist/1000).toFixed(1)} km` : `${Math.round(minBranchDist)} m`} away. (${batchCount} orders)`,
      };
    } else if (nearestPickedOrder) {
      const bid = nearestPickedOrder.batchId || nearestPickedOrder.id;
      return {
        type: 'delivery',
        targetId: bid,
        orderId: nearestPickedOrder.id,
        distance: minCustomerDist,
        title: lang === 'bn' ? '🛵 সাজেস্টেড ডেলিভারি' : '🛵 Suggested Delivery',
        sub: lang === 'bn' ? `কাস্টমার #${nearestPickedOrder.id} আপনার থেকে ${minCustomerDist >= 1000 ? `${(minCustomerDist/1000).toFixed(1)} km` : `${Math.round(minCustomerDist)} m`} দূরে।` : `Customer #${nearestPickedOrder.id} is ${minCustomerDist >= 1000 ? `${(minCustomerDist/1000).toFixed(1)} km` : `${Math.round(minCustomerDist)} m`} away.`,
      };
    }

    return null;
  }, [activeOrders, livePos, lang]);

  const groupedHistory = useMemo(() => {
    const g: Record<string, any[][]> = {};
    historyOrders.forEach((o: any) => {
      const date = o.updatedAt?.toDate ? o.updatedAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : (lang === 'bn' ? 'আর্কাইভ' : 'Archive');
      if (!g[date]) g[date] = [];
      g[date].push([o]);
    });
    return g;
  }, [historyOrders, lang]);

  const handleOrderPress = (batch: any[], tab: string) => {
    if (tab === 'active') {
      const bid = batch[0].batchId || batch[0].id;
      router.push({ pathname: '/order-execution', params: { batchId: bid } });
    } else {
      setSelectedOrder(batch[0]);
    }
  };

  const TABS = [
    { id: 'active', label: t('orders_live'), Icon: PlayCircle },
    { id: 'history', label: t('orders_history'), Icon: History },
  ];

  const OrderItem = memo(({ batch, tab, lang, isDark, T, onOrderPress, onChatPress }: any) => {
    const primaryOrder = batch[0];
    const ss = useMemo(() => getS(primaryOrder.status, lang, isDark), [primaryOrder.status, lang, isDark]);
    const isDel = primaryOrder.status === 'delivered' || primaryOrder.status === 'success';
    const isPaid = primaryOrder.paymentStatus === 'paid' || primaryOrder.paymentMethod === 'online' || primaryOrder.paymentMethod === 'wallet';
    const paymentLabel = isPaid ? (lang === 'bn' ? 'পেইড' : 'PAID') : (lang === 'bn' ? 'ক্যাশ' : 'COD');
    const paymentColor = isPaid ? '#10b981' : '#f59e0b';

    // Detailed item list if only 1-2 items
    const itemSummary = useMemo(() => {
      const items = batch.flatMap((o: any) => o.items || []);
      if (items.length === 0) return null;
      if (items.length <= 2) {
        return items.map((it: any) => `${it.qty}x ${lang === 'bn' ? (it.name_bn || it.name_en) : (it.name_en || it.name_bn)}`).join(', ');
      }
      return `${items.reduce((sum: number, o: any) => sum + (o.qty || 1), 0)} ${lang === 'bn' ? 'মোট আইটেম' : 'Total Items'}`;
    }, [batch, lang]);

    return (
      <Pressable
        onPress={() => onOrderPress(batch, tab)}
        style={({ pressed }) => ({
          backgroundColor: isDark ? T.surface : '#fff',
          borderWidth: 1.2,
          borderColor: pressed ? ss.color : T.border,
          borderRadius: 16,
          overflow: 'hidden',
          marginBottom: 12,
          shadowColor: ss.color,
          shadowOpacity: isDark ? 0.2 : 0.05,
          shadowRadius: 10,
          elevation: 2,
          transform: [{ scale: pressed ? 0.985 : 1 }]
        })}
      >
        <LinearGradient 
          colors={[isDark ? 'transparent' : `${ss.color}05`, 'transparent']} 
          start={{x:0, y:0}} end={{x:1, y:1}} 
          style={StyleSheet.absoluteFillObject} 
        />
        <View style={{ paddingVertical: 10, paddingHorizontal: 12, gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ss.color }} />
              <Text style={{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: ss.color }}>
                {batch.length > 1 ? (lang === 'bn' ? `${batch.length} অর্ডারের ব্যাচ` : `BATCH (${batch.length})`) : ss.labelText}
              </Text>
              <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: T.border, opacity: 0.5 }} />
              <View style={{ backgroundColor: `${paymentColor}15`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ fontSize: 8, fontWeight: '900', color: paymentColor }}>{paymentLabel}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '900', color: T.text }}>
              ৳{batch.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0)}
            </Text>
          </View>

          {batch.length > 1 ? (
            <View style={{ gap: 8, marginTop: 8, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', paddingBottom: 8 }}>
              {batch.map((o: any) => (
                <View key={o.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: T.border }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: T.text }}>#{o.id}</Text>
                    <Text style={{ fontSize: 10, color: T.sub }} numberOfLines={1}>{o.customerName || 'Customer'}</Text>
                  </View>
                  <Pressable 
                    onPress={(e) => {
                      e.stopPropagation();
                      handleUnbatch(o.id);
                    }}
                    style={({ pressed }) => [{ backgroundColor: `${T.accent}12`, borderWidth: 1, borderColor: `${T.accent}30`, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 }, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={{ fontSize: 9, fontWeight: '900', color: T.accent, textTransform: 'uppercase' }}>
                      {lang === 'bn' ? 'আলাদা করুন' : 'Deliver Solo'}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: T.text }}>
                #{batch.map((o: any) => o.id).join(', #')}
              </Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: isDark ? 'transparent' : '#e2e8f0' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                <MapPin size={10} color="#6366f1" strokeWidth={3} />
                <Text style={{ fontSize: 8, fontWeight: '800', color: '#6366f1', textTransform: 'uppercase' }}>{lang === 'bn' ? 'পিকআপ' : 'PICKUP'}</Text>
              </View>
              <BranchName branchId={primaryOrder.branchId} />
            </View>
            
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: isDark ? 'transparent' : '#e2e8f0' }}>
              <ChevronRight size={14} color={ss.color} strokeWidth={3} />
            </View>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                <MapPin size={10} color="#f43f5e" strokeWidth={3} />
                <Text style={{ fontSize: 8, fontWeight: '800', color: '#f43f5e', textTransform: 'uppercase' }}>{lang === 'bn' ? 'গন্তব্য' : 'DROP'}</Text>
              </View>
              <Text style={{ fontSize: 11, fontWeight: '800', color: T.text }} numberOfLines={1}>
                {batch.length > 1 ? (lang === 'bn' ? `একাধিক (${batch.length})` : `Multiple (${batch.length})`) : primaryOrder.customer?.address || '—'}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 2 }}>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Package size={10} color={T.sub} strokeWidth={2.5} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: T.sub }} numberOfLines={1}>
                  {itemSummary}
                </Text>
              </View>
              {isDel && primaryOrder.deliveredAt && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 2 }}>
                  <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: T.border }} />
                  <Clock size={10} color={T.sub} strokeWidth={2.5} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: T.sub }}>
                    {primaryOrder.deliveredAt.toDate ? primaryOrder.deliveredAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(primaryOrder.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {tab === 'active' && batch.length === 1 && (
                <Pressable
                  onPress={() => onChatPress(primaryOrder)}
                  style={({ pressed }) => [{ width: 28, height: 28, borderRadius: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center', position: 'relative' }, pressed && { opacity: 0.7 }]}
                >
                  <MessageSquare size={13} color={T.sub} strokeWidth={2} />
                  <UnreadBadge orderId={primaryOrder.id} bg={isDark ? '#1e293b' : '#f8fafc'} />
                </Pressable>
              )}
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: `${ss.color}15`, alignItems: 'center', justifyContent: 'center' }}>
                {ss.icon === 'nav' ? (
                  <Navigation size={13} color={ss.color} strokeWidth={2} />
                ) : ss.icon === 'check' ? (
                  <CheckCircle2 size={15} color={ss.color} strokeWidth={2.5} />
                ) : <ChevronRight size={15} color={ss.color} strokeWidth={2.5} />}
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    );
  });

  const ListContent = useCallback(({ tabId }: { tabId: string }) => {
    if (tabId === 'active') {
      if (loading) {
        return (
          <View style={{ width, alignItems: 'center', paddingVertical: 80 }}>
            <ActivityIndicator size="large" color={T.accent} />
          </View>
        );
      }
      if (activeOrders.length === 0) {
        return (
          <View style={{ width, alignItems: 'center', paddingVertical: 80, opacity: 0.5, paddingHorizontal: 20 }}>
            <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: `${T.accent}08`, borderWidth: 1.5, borderColor: T.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Package size={32} color={T.accent} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: T.text, marginBottom: 6 }}>{t('orders_empty')}</Text>
          </View>
        );
      }
      return (
        <ScrollView style={{ width }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 10, gap: 20 }}>
            {/* SMART RECOMMENDATION BANNER */}
            {smartRecommendation && (
              <TouchableOpacity
                onPress={() => {
                  router.push({ pathname: '/order-execution', params: { batchId: smartRecommendation.targetId } });
                }}
                style={{
                  backgroundColor: T.green,
                  borderRadius: 24,
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 10
                }}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />
                    <Text style={{ fontFamily: font, fontSize: 13, fontWeight: '900', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {smartRecommendation.title}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.95)' }}>
                    {smartRecommendation.sub}
                  </Text>
                </View>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                  <ChevronRight size={20} color="#fff" strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
            )}

            {/* BATCH TRIPS SECTION */}
            {batchGroups.length > 0 && (
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <View style={{ width: 4, height: 16, backgroundColor: T.accent, borderRadius: 2 }} />
                  <Text style={{ fontFamily: font, fontSize: 14, fontWeight: '800', color: T.sub, textTransform: 'uppercase', letterSpacing: 1 }}>
                    {lang === 'bn' ? 'ব্যাচ ট্রিপস' : 'Batch Trips'}
                  </Text>
                  <View style={{ backgroundColor: `${T.accent}15`, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: T.accent }}>{batchGroups.length}</Text>
                  </View>
                </View>
                {batchGroups.map((batch: any, index: number) => (
                  <OrderItem
                    key={index}
                    batch={batch}
                    tab="active"
                    lang={lang}
                    isDark={isDark}
                    T={T}
                    onOrderPress={handleOrderPress}
                    onChatPress={setActiveChatOrder}
                  />
                ))}
              </View>
            )}

            {/* SOLO ORDERS SECTION */}
            {soloGroups.length > 0 && (
              <View style={{ gap: 10, marginTop: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <View style={{ width: 4, height: 16, backgroundColor: T.green, borderRadius: 2 }} />
                  <Text style={{ fontFamily: font, fontSize: 14, fontWeight: '800', color: T.sub, textTransform: 'uppercase', letterSpacing: 1 }}>
                    {lang === 'bn' ? 'একক অর্ডারসমূহ' : 'Solo Orders'}
                  </Text>
                  <View style={{ backgroundColor: `${T.green}15`, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: T.green }}>{soloGroups.length}</Text>
                  </View>
                </View>
                {soloGroups.map((batch: any, index: number) => (
                  <OrderItem
                    key={index}
                    batch={batch}
                    tab="active"
                    lang={lang}
                    isDark={isDark}
                    T={T}
                    onOrderPress={handleOrderPress}
                    onChatPress={setActiveChatOrder}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      );
    }

    const grouped = tabId === 'active' ? groupedActive : groupedHistory;
    const flatData = useMemo(() => {
      const items: any[] = [];
      Object.entries(grouped).forEach(([date, batches]) => {
        items.push({ type: 'header', date });
        batches.forEach((batch) => {
          items.push({ type: 'order', batch, tab: tabId });
        });
      });
      return items;
    }, [grouped, tabId]);

    const isEmpty = flatData.length === 0;

    if (isEmpty) {
      return (
        <View style={{ width, alignItems: 'center', paddingVertical: 80, opacity: 0.5, paddingHorizontal: 20 }}>
          <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: `${T.accent}08`, borderWidth: 1.5, borderColor: T.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Package size={32} color={T.accent} />
          </View>
          <Text style={{ fontSize: 16, fontWeight: '800', color: T.text, marginBottom: 6 }}>{t('orders_empty')}</Text>
        </View>
      );
    }

    return (
      <View style={{ width }}>
        <FlatList
          data={flatData}
          keyExtractor={(item, index) => item.type === 'header' ? item.date : item.batch.map((o: any) => o.id).join('-')}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 24, marginVertical: 14 }}>
                  <Calendar size={12} color={T.accent} strokeWidth={2.5} />
                  <Text style={{ fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, color: T.sub, opacity: 0.8 }}>{item.date}</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: T.border, opacity: 0.6 }} />
                </View>
              );
            }
            const ss = getS(item.batch[0].status, lang, isDark);
            return (
              <View style={{ paddingHorizontal: 20 }}>
                <OrderItem
                  batch={item.batch}
                  tab={item.tab}
                  ss={ss}
                  lang={lang}
                  isDark={isDark}
                  T={T}
                  onOrderPress={handleOrderPress}
                  onChatPress={setActiveChatOrder}
                />
              </View>
            );
          }}
          ListFooterComponent={() => (
            tabId === 'history' && historyOrders.length > 0 ? (
              <View style={{ padding: 20, paddingBottom: 140 }}>
                {!hasMore ? (
                  <Text style={{ textAlign: 'center', fontSize: 12, color: T.sub, fontWeight: '600' }}>{lang === 'bn' ? 'আর কোন অর্ডার নেই' : 'End of history'}</Text>
                ) : (
                  <Pressable onPress={loadMore} disabled={historyLoading} style={({ pressed }) => ({ padding: 16, borderRadius: 16, backgroundColor: `${T.accent}15`, alignItems: 'center', opacity: pressed ? 0.7 : 1 })}>
                    <Text style={{ color: T.accent, fontSize: 13, fontWeight: '900' }}>{historyLoading ? (lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...') : (lang === 'bn' ? 'আরও দেখুন' : 'Load More')}</Text>
                  </Pressable>
                )}
              </View>
            ) : <View style={{ height: 140 }} />
          )}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      </View>
    );
  }, [groupedActive, groupedHistory, loading, historyOrders.length, hasMore, historyLoading, lang, isDark, T, t, width]);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* FIXED HEADER & TABS */}
      <View>
        <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 24, position: 'relative', overflow: 'hidden' }}>
          <View style={{ position: 'absolute', top: -80, left: -40, width: 280, height: 280, borderRadius: 140, backgroundColor: `${T.accent}12` }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', zIndex: 1 }}>
            <View>
              <Text style={{ fontSize: 9, fontWeight: '900', letterSpacing: 3, textTransform: 'uppercase', color: T.accent, marginBottom: 4 }}>{t('orders_header_sub')}</Text>
              <Text style={{ fontFamily: font, fontSize: lang === 'bn' ? 30 : 36, fontWeight: '800', color: T.text, lineHeight: 40 }}>{t('orders_title')}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable onPress={() => router.push('/chat')} style={({ pressed }) => [{ width: 44, height: 44, borderRadius: 15, borderWidth: 1, borderColor: T.border, backgroundColor: surf, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}>
                <MessageSquare size={19} color={T.text} strokeWidth={2.2} />
                {totalUnread > 0 ? (
                  <View style={{ position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#ff4d6d', borderWidth: 2, borderColor: T.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>{totalUnread}</Text>
                  </View>
                ) : (
                  <View style={{ position: 'absolute', top: 10, right: 10, width: 7, height: 7, borderRadius: 3.5, backgroundColor: T.accent, borderWidth: 1.5, borderColor: T.bg }} />
                )}
              </Pressable>
              {activeTab === 'history' && (
                <View style={{ backgroundColor: surf, borderWidth: 1, borderColor: T.border, borderRadius: 15, paddingVertical: 7, paddingHorizontal: 14, alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 8, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase', color: T.sub, marginBottom: 2 }}>{t('orders_today')}</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: T.green, lineHeight: 18 }}>৳{stats.amount}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', padding: 5, backgroundColor: surf, borderWidth: 1, borderColor: T.border, borderRadius: 20 }}>
            {TABS.map((tab, idx) => (
              <Pill key={tab.id} active={activeTab === tab.id} label={tab.label} Icon={tab.Icon} onClick={() => onTabPress(idx)} T={T} isDark={isDark} scrollX={scrollX} index={idx} width={width} />
            ))}
          </View>
        </View>
      </View>

      {/* HORIZONTAL PAGING */}
      <RNAnimated.FlatList
        ref={listRef}
        data={TABS}
        horizontal
        pagingEnabled
        snapToInterval={width}
        decelerationRate="fast"
        snapToAlignment="start"
        showsHorizontalScrollIndicator={false}
        onScroll={RNAnimated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          if (TABS[index]) setActiveTab(TABS[index].id as any);
        }}
        renderItem={({ item }) => <ListContent tabId={item.id} />}
      />

      <OrderDetailsModal visible={!!selectedOrder} order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </View>
  );
}
