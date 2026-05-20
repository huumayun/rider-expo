import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, ActivityIndicator, Pressable, RefreshControl,
  Modal, FlatList, BackHandler,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, FadeIn, FadeInDown, Easing as ReanimatedEasing } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, updateDoc, serverTimestamp, onSnapshot, collection, query, where, arrayUnion } from 'firebase/firestore';
import { getDatabase, ref, onValue } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShoppingBag, TrendingUp, Star, Power, Languages, Map as MapIcon, Moon, Sun, X, ChevronRight, PackageCheck, MessageSquare, Navigation, ArrowDownLeft, ArrowUpRight, Banknote, Clock, Calendar, Receipt, ShoppingCart, Info, MapPin, Package } from 'lucide-react-native';
import { db } from '../../config/firebase';
import { useApp } from '../../context/AppContext';
import { useAuthStore } from '../../store/authStore';
import { useRiderData } from '../../context/RiderDataContext';
import { useUIStore } from '../../store/uiStore';
import { useLocation } from '../../context/LocationContext';
import RouteOverviewMap from '../../components/map/RouteOverviewMap';
import OrderPopup from '../../components/modals/OrderPopup';
import { checkAndCreateBatch } from '../../utils/batchUtils';
import OrderExecution from '../Order/OrderExecution';
import { formatAppDate, toDate } from '../../utils/dateUtils';

const { width } = Dimensions.get('window');

const SMAP: any = {
  assigned: { solid: '#3b82f6', dark: '#60a5fa', label: { bn: 'নতুন অর্ডার', en: 'New Order' }, icon: 'pkg', isNew: true },
  accepted: { solid: '#f59e0b', dark: '#fbbf24', label: { bn: 'পিক করতে যান', en: 'Go to Pickup' }, icon: 'pkg' },
  go_to_branch: { solid: '#f59e0b', dark: '#fbbf24', label: { bn: 'ব্রাঞ্চে যাচ্ছি', en: 'Going to Branch' }, icon: 'nav' },
  arrived_at_branch: { solid: '#6366f1', dark: '#818cf8', label: { bn: 'ব্রাঞ্চে আছি', en: 'At Branch' }, icon: 'pkg' },
  picked: { solid: '#8b5cf6', dark: '#a78bfa', label: { bn: 'পার্সেল সাথে', en: 'Picked Up' }, icon: 'pkg' },
  out_for_delivery: { solid: '#f97316', dark: '#fb923c', label: { bn: 'পথে আছি', en: 'On The Way' }, icon: 'nav' },
  arrived_at_customer: { solid: '#22c55e', dark: '#4ade80', label: { bn: 'কাস্টমারের কাছে', en: 'Near Customer' }, icon: 'return_done' },
  returning_to_branch: { solid: '#f97316', dark: '#fb923c', label: { bn: 'ফেরত যাচ্ছি', en: 'Returning' }, icon: 'nav' }
};

const getS = (s: string, lang: string, isDark: boolean) => {
  const m = SMAP[s] ?? { solid: '#3b82f6', dark: '#60a5fa', label: { bn: 'সক্রিয়', en: 'Active' }, icon: 'pkg' };
  const color = isDark ? m.dark : m.solid;
  return { ...m, color, labelText: m.label[lang] };
};

const PulseDot = ({ color }: { color: string }) => {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.35, { duration: 900 }), -1, true);
    scale.value = withRepeat(withTiming(0.65, { duration: 900 }), -1, true);
  }, []);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  return <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }, animatedStyle]} />;
};



const ShimmerEffect = () => {
  const translateX = useSharedValue(-width);
  useEffect(() => { translateX.value = withRepeat(withTiming(width, { duration: 2500, easing: ReanimatedEasing.bezier(0.4, 0, 0.6, 1) }), -1, false); }, []);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  return <View style={StyleSheet.absoluteFillObject}><Animated.View style={[{ width: '40%', height: '100%', backgroundColor: 'rgba(255,255,255,0.15)' }, animatedStyle]} /></View>;
};

const TxCard = ({ tx, idx, lang, T, isDark, t, font }: any) => {
  const isCash = tx.type === 'cash_collection' || tx.type === 'collection';
  const isTransfer = tx.type === 'admin_transfer' || tx.type === 'transfer';
  const cfg = isCash ? { Icon: ArrowDownLeft, iconColor: '#22d47a', iconBg: 'rgba(34,212,122,0.1)', iconBorder: '#22d47a28', label: `${t('wallet_order_prefix')} #${tx.orderSeq || 'N/A'}`, amountColor: '#22d47a', sign: '+' } : isTransfer ? { Icon: ArrowUpRight, iconColor: '#f87171', iconBg: 'rgba(248,113,113,0.1)', iconBorder: '#f8717128', label: t('wallet_admin_label'), amountColor: '#f87171', sign: '−' } : { Icon: Banknote, iconColor: T.sub, iconBg: T.border + '30', iconBorder: T.border, label: tx.type || 'Transaction', amountColor: T.text, sign: '' };
  return (
    <Animated.View entering={FadeIn.delay(idx * 50)} style={{ backgroundColor: isDark ? T.surface : '#ffffff', borderWidth: 1, borderColor: T.border, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 }}>
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: cfg.iconBg, borderWidth: 1, borderColor: cfg.iconBorder, alignItems: 'center', justifyContent: 'center' }}><cfg.Icon size={18} color={cfg.iconColor as string} strokeWidth={2.5} /></View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: T.text, fontFamily: font }}>{cfg.label}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: cfg.amountColor }}>{cfg.sign}৳{(tx.amount || 0).toLocaleString()}</Text>
        <View style={{ marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: tx.status === 'completed' ? 'rgba(34,212,122,0.1)' : 'rgba(245,158,11,0.1)' }}>
          <Text style={{ fontSize: 8, fontWeight: '900', textTransform: 'uppercase', color: tx.status === 'completed' ? '#22d47a' : '#f59e0b' }}>{tx.status === 'completed' ? t('wallet_done') : t('wallet_pending')}</Text>
        </View>
      </View>
    </Animated.View>
  );
};

const BranchName = ({ branchId, font, color }: any) => {
  const [name, setName] = useState('—');
  useEffect(() => {
    if (!branchId) return;
    const unsub = onSnapshot(doc(db, 'branches', branchId), (snap) => {
      if (snap.exists()) setName(snap.data().location?.name || snap.data().name || '—');
    });
    return () => unsub();
  }, [branchId]);
  return <Text style={{ fontSize: 11, fontWeight: '600', color, fontFamily: font }} numberOfLines={1}>{name}</Text>;
};

const UnreadBadge = ({ orderId, bg }: any) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!orderId) return;
    const rtdb = getDatabase();
    const unsub = onValue(ref(rtdb, `chats/${orderId}/messages`), (snap) => { setCount(snap.exists() ? Object.values(snap.val() as any).filter((m: any) => m.senderRole === 'customer' && !m.read).length : 0); });
    return () => unsub();
  }, [orderId]);
  if (count === 0) return null;
  return <View style={{ position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, backgroundColor: '#ff4d6d', borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderColor: bg, borderWidth: 2 }}><Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>{count}</Text></View>;
};

const DutyOffView = ({ t, lang, onToggle, T, isDark, font, stats, balance, deliveredCount, insets }: any) => {
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Background Decor */}
      <View style={[StyleSheet.absoluteFillObject, { opacity: 0.6 }]}>
        <View style={{ position: 'absolute', top: '15%', right: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: isDark ? '#ef444408' : '#ef444405' }} />
        <View style={{ position: 'absolute', bottom: '25%', left: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: isDark ? '#22d47a08' : '#22d47a05' }} />
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(1000)} style={{ alignItems: 'center' }}>
          {/* Main Status Icon with Depth */}
          <View style={{ marginBottom: 48, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{
              width: 160, height: 160, borderRadius: 80,
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
              borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              alignItems: 'center', justifyContent: 'center'
            }}>
              <View style={{
                width: 110, height: 110, borderRadius: 55,
                backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)',
                alignItems: 'center', justifyContent: 'center',
                shadowColor: '#ef4444', shadowOpacity: isDark ? 0.3 : 0.1, shadowRadius: 20, elevation: 5
              }}>
                <Power size={54} color="#ef4444" strokeWidth={2.5} />
              </View>
              <PulseDot color="#ef4444" />
            </View>
          </View>

          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <Text style={{ fontSize: 32, fontWeight: '900', color: T.text, textAlign: 'center', marginBottom: 12, fontFamily: font, letterSpacing: -0.5 }}>
              {t('home_on_break')}
            </Text>
            <View style={{ width: 40, height: 4, backgroundColor: '#ef4444', borderRadius: 2, marginBottom: 16, opacity: 0.6 }} />
            <Text style={{ fontSize: 15, color: T.sub, textAlign: 'center', lineHeight: 24, fontWeight: '600', maxWidth: 300 }}>
              {t('home_duty_off_msg')}
            </Text>
          </View>

          <TouchableOpacity
            onPress={onToggle}
            activeOpacity={0.8}
            style={{
              width: '100%', height: 70, borderRadius: 24, backgroundColor: '#22d47a',
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14,
              shadowColor: '#22d47a', shadowOpacity: 0.4, shadowRadius: 25, elevation: 12,
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)'
            }}
          >
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Power size={18} color="#fff" strokeWidth={3} />
            </View>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2 }}>
              {t('home_start_shift')}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

    </View>
  );
};

export default function HomePage() {
  const router = useRouter();
  const { rider } = useAuthStore();
  const { T, t, lang, theme, font } = useApp();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();

  const { activeOrders, completedOrders, stats, totalDelivered: ctxTotalDelivered } = useRiderData();
  const { currentLocation: livePos, heading } = useLocation();
  const [branches, setBranches] = useState<any>({});
  const viewMode = useUIStore(s => s.viewMode);
  const setViewMode = useUIStore(s => s.setViewMode);
  const setIsExecuting = useUIStore(s => s.setIsExecuting);
  const isExecuting = useUIStore(s => s.isExecuting);
  const [dutyStatus, setDutyStatus] = useState(rider?.dutyStatus || 'offline');
  const [refreshing, setRefreshing] = useState(false);
  const [newOrderPopup, setNewOrderPopup] = useState<any>(null);
  const [activeOrderWarning, setActiveOrderWarning] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [holdingBalance, setHoldingBalance] = useState(0);
  const [showReviewsDrawer, setShowReviewsDrawer] = useState(false);
  const [activeStatDrawer, setActiveStatDrawer] = useState<string | null>(null);

  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [batchToExecute, setBatchToExecute] = useState<any[] | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [branchData, setBranchData] = useState<any>(null);
  const pendingOrders = useMemo(() => activeOrders.filter(o => o.status === 'pending'), [activeOrders]);
  const assignedOrders = useMemo(() => activeOrders.filter(o => !['pending', 'delivered', 'success', 'cancelled'].includes(o.status)), [activeOrders]);
  const deliveredOrders = (stats as any)?.todayDelivered || [];
  const cashTxs = (stats as any)?.cashTxs || [];
  const isOnline = dutyStatus === 'online';

  useEffect(() => {
    if (!rider?.uid) return;
    const unsub = onSnapshot(doc(db, 'employees', rider.uid), (d) => { if (d.exists()) { const data = d.data(); setDutyStatus(data.dutyStatus || 'offline'); setHoldingBalance(data.holdingBalance || 0); } });
    return () => unsub();
  }, [rider?.uid]);

  // Fetch branches for map markers
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'branches'), (snap) => {
      const bMap: any = {};
      snap.docs.forEach(d => {
        bMap[d.id] = { id: d.id, ...d.data() };
      });
      setBranches(bMap);
    });
    return () => unsub();
  }, []);

  // Handle hardware back button for OrderExecution overlay and modals
  useEffect(() => {
    const backAction = () => {
      // Prioritize closing modals/drawers
      if (showReviewsDrawer) {
        setShowReviewsDrawer(false);
        return true;
      }
      if (activeStatDrawer) {
        setActiveStatDrawer(null);
        return true;
      }
      if (newOrderPopup) {
        setNewOrderPopup(null);
        return true;
      }
      if (activeBatchId && !isMinimized) {
        setIsMinimized(true);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [activeBatchId, isMinimized, showReviewsDrawer, activeStatDrawer, newOrderPopup]);

  // Removed branchOverlay listener, using OrderExecution instead.

  useEffect(() => {
    if (!rider?.uid) return;
    const q = query(collection(db, 'reviews'), where('rider.riderId', '==', rider.uid));
    const unsub = onSnapshot(q, (snap) => {
      const revList = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setReviews(revList);
      if (revList.length > 0) setRating(revList.reduce((s: number, r: any) => s + (r.rating || 0), 0) / revList.length);
    });
    return () => unsub();
  }, [rider?.uid]);

  const toggleDuty = async () => {
    if (isOnline && assignedOrders.length > 0) { setActiveOrderWarning(true); return; }
    await updateDoc(doc(db, 'employees', rider!.uid), { dutyStatus: isOnline ? 'offline' : 'online', lastStatusUpdate: serverTimestamp() });
  };

  const handleAcceptOrder = async (orderId: string) => {
    const newOrder = activeOrders.find(o => o.id === orderId);
    const batchIdToJoin = checkAndCreateBatch(newOrder, assignedOrders);
    await updateDoc(doc(db, 'orders', orderId), {
      status: 'accepted',
      batchId: batchIdToJoin,
      acceptedAt: serverTimestamp(),
      updatedBy: rider!.uid
    });
    setNewOrderPopup(null);
  };

  const handleRejectOrder = async (orderId: string) => {
    await updateDoc(doc(db, 'orders', orderId), {
      status: 'pending',
      riderId: null,
      batchId: null,
      rejectedBy: arrayUnion(rider!.uid),
      updatedAt: serverTimestamp()
    });
    setNewOrderPopup(null);
  };

  const groupedAssignedOrders = useMemo(() => {
    const groups: Record<string, any[]> = {};
    assignedOrders.forEach((o: any) => {
      const bid = o.batchId || o.id;
      if (!groups[bid]) groups[bid] = [];
      groups[bid].push(o);
    });
    const sorted = Object.values(groups).sort((a: any, b: any) => (a[0].status === 'assigned' ? -1 : 1));
    return sorted;
  }, [assignedOrders]);

  const lastBatchRef = useRef<any>(null);
  const stableBatch = useMemo(() => {
    if (!activeBatchId) return null;
    const found = groupedAssignedOrders.find(g => (g[0].batchId || g[0].id) === activeBatchId);
    if (!found) return null;

    const foundIds = found.map((o: any) => o.id).join(',');
    const lastIds = lastBatchRef.current?.map((o: any) => o.id).join(',');

    if (foundIds === lastIds) return lastBatchRef.current;
    lastBatchRef.current = found;
    return found;
  }, [activeBatchId, groupedAssignedOrders]);

  useEffect(() => {
    setBatchToExecute(stableBatch);
    const target = !!activeBatchId && !isMinimized;
    if (isExecuting !== target) {
      setIsExecuting(target);
    }
  }, [stableBatch, activeBatchId, isMinimized, isExecuting]);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={{ flex: 1 }}>
        {/* Premium Background Blobs */}
        <View style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }]}>
          <View style={{ position: 'absolute', top: -100, right: -50, width: 300, height: 300, borderRadius: 150, backgroundColor: isDark ? 'rgba(34,212,122,0.05)' : 'rgba(34,212,122,0.03)', transform: [{ scale: 1.5 }] }} />
          <View style={{ position: 'absolute', bottom: 100, left: -100, width: 400, height: 400, borderRadius: 200, backgroundColor: isDark ? 'rgba(99,102,241,0.04)' : 'rgba(99,102,241,0.02)', transform: [{ scale: 1.2 }] }} />
        </View>

        {!isOnline ? (
          <DutyOffView
            t={t}
            lang={lang}
            onToggle={toggleDuty}
            T={T}
            isDark={isDark}
            font={font}
            stats={stats}
            balance={holdingBalance}
            deliveredCount={deliveredOrders.length}
            insets={insets}
          />
        ) : viewMode === 'map' ? (
          <RouteOverviewMap
            assignedOrders={assignedOrders}
            branches={branches}
            livePos={livePos}
            heading={heading}
            incomingOrder={newOrderPopup}
            onClose={() => setViewMode('list')}
            onOpenOrder={(batch: any) => { setActiveBatchId(batch[0]?.batchId || batch[0]?.id); }}
            rider={rider}
            dutyStatus={dutyStatus}
            onToggleDuty={toggleDuty}
            stats={stats}
            onOpenStats={setActiveStatDrawer}
            onOpenReviews={() => setShowReviewsDrawer(true)}
            onAcceptOrder={handleAcceptOrder}
            onRejectOrder={handleRejectOrder}
          />
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { }} />}>
            <View style={{ padding: 20, paddingTop: insets.top + 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <View>
                  <Text style={{ fontFamily: font, fontSize: 13, fontWeight: '800', color: T.sub, textTransform: 'uppercase', letterSpacing: 1.5 }}>{t('login_sub')}</Text>
                  <Text style={{ fontFamily: font, fontSize: 32, fontWeight: '900', color: T.text, marginTop: 4 }}>{rider?.name || 'Rider'}</Text>
                </View>
                <TouchableOpacity onPress={toggleDuty} style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: isOnline ? T.green : T.danger, alignItems: 'center', justifyContent: 'center', shadowColor: isOnline ? T.green : T.danger, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 8 }}>
                  <Power size={24} color="#fff" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              {/* Stat Grid */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
                {[
                  { label: t('stat_delivered'), value: deliveredOrders.length, unit: t('unit_orders'), icon: ShoppingBag, color: '#38bdf8', bg: T.cardB, onClick: () => setActiveStatDrawer('today') },
                  { label: t('home_cash_in_hand'), value: `৳${holdingBalance.toLocaleString()}`, unit: null, icon: Banknote, color: T.accent, bg: T.cardA, onClick: () => setActiveStatDrawer('cash') },
                  { label: t('home_total_delivery'), value: ctxTotalDelivered, unit: t('unit_orders'), icon: TrendingUp, color: '#22d47a', bg: T.cardC, onClick: () => setActiveStatDrawer('total') },
                  { label: t('home_rating'), value: rating ? rating.toFixed(1) : '—', unit: rating ? '/ 5' : null, icon: Star, color: '#f59e0b', bg: T.cardD, onClick: () => setShowReviewsDrawer(true) },
                ].map((card, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={card.onClick}
                    style={{ width: (width - 52) / 2, backgroundColor: card.bg, borderRadius: 24, padding: 16, borderWidth: 1, borderColor: `${card.color}15`, minHeight: 110, justifyContent: 'space-between' }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: `${card.color}15`, alignItems: 'center', justifyContent: 'center' }}>
                      <card.icon size={18} color={card.color} strokeWidth={2.5} />
                    </View>
                    <View>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: T.sub, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{card.label}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                        <Text style={{ fontSize: 20, fontWeight: '900', color: T.text }}>{card.value}</Text>
                        {card.unit && <Text style={{ fontSize: 10, fontWeight: '700', color: T.sub }}>{card.unit}</Text>}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontFamily: font, fontSize: 18, fontWeight: '800', color: T.text }}>{t('orders_live')}</Text>
                <TouchableOpacity onPress={() => setViewMode(viewMode === 'list' ? 'map' : 'list')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.hi, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: T.border }}>
                  <MapIcon size={14} color={T.accent} />
                  <Text style={{ fontSize: 11, fontWeight: '800', color: T.text, textTransform: 'uppercase' }}>{viewMode === 'list' ? t('home_map') : t('home_list')}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ paddingHorizontal: 20 }}>
              {groupedAssignedOrders.length > 0 ? groupedAssignedOrders.map((batch: any) => {
                const primaryOrder = batch[0];
                const s = getS(primaryOrder.status, lang, isDark);
                return (
                  <TouchableOpacity
                    key={primaryOrder.id}
                    onPress={() => {
                      const bid = primaryOrder.batchId || primaryOrder.id;
                      setActiveBatchId(bid);
                      setIsMinimized(false);
                    }}
                    style={{ backgroundColor: T.surface, borderWidth: 1, borderColor: `${s.color}20`, borderRadius: 16, padding: 14, marginBottom: 12 }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <PulseDot color={s.color} />
                        <Text style={{ fontSize: 11, fontWeight: '800', color: s.color, textTransform: 'uppercase', fontFamily: font }}>
                          {batch.length > 1 ? (lang === 'bn' ? `${batch.length} ${t('home_batch_label')}` : `BATCH OF ${batch.length}`) : s.labelText}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: T.text, fontFamily: font }}>৳{batch.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0)}</Text>
                    </View>

                    <Text style={{ fontSize: 13, fontWeight: '800', color: T.text, marginTop: 8, fontFamily: font }}>
                      #{batch.map((o: any) => o.orderSeq || o.id.slice(-5)).join(', #')}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, marginTop: 10 }}>
                      <View style={{ flex: 1 }}>
                        <BranchName branchId={primaryOrder.branchId} font={font} color={T.text} />
                      </View>
                      <Text style={{ color: s.color, fontSize: 12, opacity: 0.7 }}>→</Text>
                      <View style={{ flex: 1.2 }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: T.text, fontFamily: font }} numberOfLines={1}>
                          {batch.length > 1 ? t('home_multiple_dest') : primaryOrder.customer?.address || '—'}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <ShoppingBag size={12} color={T.sub as string} />
                        <Text style={{ fontSize: 10, fontWeight: '600', color: T.sub, fontFamily: font }}>
                          {batch.reduce((count: number, o: any) => count + (o.items?.length || 0), 0)} {t('home_total_items')}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ position: 'relative' }}>
                          <MessageSquare size={16} color={T.sub as string} />
                          <UnreadBadge orderId={primaryOrder.id} bg={T.surface} />
                        </View>
                        <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: `${s.color}15`, alignItems: 'center', justifyContent: 'center' }}>
                          <ChevronRight size={15} color={s.color} />
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }) : (
                <View style={{ paddingVertical: 50, alignItems: 'center', gap: 14, backgroundColor: T.surface, borderRadius: 24, borderWidth: 1.5, borderColor: T.border, borderStyle: 'dashed' }}>
                  <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: `${T.accent as string}08`, borderWidth: 1, borderColor: `${T.accent as string}18`, alignItems: 'center', justifyContent: 'center' }}>
                    <Clock size={22} color={T.accent as string} strokeWidth={1.8} />
                  </View>
                  <Text style={{ fontSize: 12, color: T.sub, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: font }}>{t('waiting_orders')}</Text>
                </View>
              )}
            </View>
          </ScrollView>
        )}

        {/* Floating Minimized Active Batch */}
        {viewMode === 'list' && assignedOrders.length > 0 && isMinimized && (
          <View style={{ position: 'absolute', bottom: insets.bottom + 95, left: 20, right: 20, zIndex: 100 }}>
            <TouchableOpacity
              onPress={() => setIsMinimized(false)}
              style={{ height: 72, borderRadius: 24, backgroundColor: T.accent as string, overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 }}
            >
              <LinearGradient colors={isDark ? ['#22d47a', '#16a85a'] : ['#22d47a', '#10b981']} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />

              <ShimmerEffect />

              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                    <PackageCheck size={22} color="#fff" strokeWidth={2.5} />
                    <UnreadBadge orderId={assignedOrders[0]?.id} bg={T.accent} />
                  </View>
                  <View>
                    <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.7)', fontFamily: font }}>{t('resume_delivery')}</Text>
                    <Text style={{ fontSize: 17, fontWeight: '900', color: '#fff', fontFamily: font, marginTop: -2 }}>
                      Trip #{assignedOrders[0]?.batchId?.slice(-4) || assignedOrders[0]?.id.slice(-4)} ({assignedOrders.length} Drop)
                    </Text>
                  </View>
                </View>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                  <ChevronRight size={18} color="#fff" strokeWidth={3} />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* New Order Popup */}
        {isOnline && newOrderPopup && (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 999, justifyContent: 'flex-end', paddingBottom: 40, paddingHorizontal: 16 }]}>
            <OrderPopup order={newOrderPopup} onAccept={() => handleAcceptOrder(newOrderPopup.id)} onSkip={() => setNewOrderPopup(null)} />
          </View>
        )}

        {/* Warning Modal */}
        {activeOrderWarning && (
          <Modal visible transparent animationType="fade">
            <View style={{ flex: 1, backgroundColor: 'rgba(2,6,23,0.85)', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
              <View style={{ backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 28, width: '100%', maxWidth: 320, padding: 32, alignItems: 'center' }}>
                <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: 'rgba(255,77,109,0.12)', borderWidth: 1, borderColor: 'rgba(255,77,109,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <Info size={32} color="#ff4d6d" strokeWidth={2.5} />
                </View>
                <Text style={{ fontSize: 24, fontWeight: '800', color: T.text, marginBottom: 12 }}>{t('home_order_warning')}</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: T.sub, marginBottom: 28, textAlign: 'center', lineHeight: 20 }}>
                  {t('home_active_warning')}
                </Text>
                <TouchableOpacity onPress={() => setActiveOrderWarning(false)} style={{ width: '100%', paddingVertical: 14, borderRadius: 16, backgroundColor: T.accent as string, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 2 }}>{t('home_ok')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}

        <Modal visible={!!activeStatDrawer} transparent animationType="slide" onRequestClose={() => setActiveStatDrawer(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
            <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFillObject} onPress={() => setActiveStatDrawer(null)} />
            <View style={{ backgroundColor: T.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '85%', padding: 24 }}>
              <View style={{ width: 48, height: 5, borderRadius: 99, backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)', alignSelf: 'center', marginBottom: 20 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottomWidth: 1, borderBottomColor: T.border, paddingBottom: 16 }}>
                <View>
                  <Text style={{ fontFamily: font, fontSize: 24, fontWeight: '800', color: T.text }}>
                    {activeStatDrawer === 'today' ? t('home_today_deliv') :
                      activeStatDrawer === 'cash' ? t('home_cash_in_hand') :
                        t('home_deliv_history')}
                  </Text>
                  <Text style={{ fontSize: 11, color: T.sub, marginTop: 2, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
                    {activeStatDrawer === 'today' ? `${deliveredOrders.length} ${t('unit_orders')}` :
                      activeStatDrawer === 'cash' ? `৳${holdingBalance.toLocaleString()}` :
                        `${ctxTotalDelivered} ${t('unit_orders')}`}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setActiveStatDrawer(null)} style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={20} color={T.text} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={activeStatDrawer === 'today' ? deliveredOrders : (activeStatDrawer === 'cash' ? cashTxs : completedOrders)}
                keyExtractor={(item, i) => item.id || i.toString()}
                renderItem={({ item, index }) => {
                  if (activeStatDrawer === 'cash') {
                    return <TxCard key={item.id} tx={item} idx={index} lang={lang} T={T} isDark={isDark} t={t} font={font} />;
                  }
                  return (
                    <View style={{ padding: 16, backgroundColor: T.surface, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: T.border }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <View>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: T.accent, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 }}>
                            #{item.seq || item.id?.slice(-8) || 'N/A'}
                          </Text>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: T.text }}>{item.customer?.name || 'Customer'}</Text>
                        </View>
                        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: (item.paymentMethod || '').toLowerCase() === 'cod' ? 'rgba(34,212,122,0.1)' : 'rgba(56,189,248,0.1)', borderWidth: 1, borderColor: (item.paymentMethod || '').toLowerCase() === 'cod' ? 'rgba(34,212,122,0.2)' : 'rgba(56,189,248,0.2)' }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: (item.paymentMethod || '').toLowerCase() === 'cod' ? '#10b981' : '#0ea5e9', textTransform: 'uppercase' }}>
                            {item.paymentMethod || 'PREPAID'}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, borderTopWidth: 1, borderTopColor: T.border, borderStyle: 'dashed', paddingTop: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Calendar size={12} color={T.sub as string} />
                          <Text style={{ fontSize: 12, fontWeight: '600', color: T.sub }}>{formatAppDate(item.deliveredAt || item.updatedAt, lang)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Receipt size={12} color={T.sub as string} />
                          <Text style={{ fontSize: 12, fontWeight: '800', color: T.text }}>৳{(Number(item.totalAmount || item.orderTotal) || 0).toLocaleString()}</Text>
                        </View>
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={{ padding: 60, alignItems: 'center' }}>
                    <PackageCheck size={28} color={T.accent as string} style={{ opacity: 0.4, marginBottom: 16 }} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: T.sub }}>{t('home_no_data')}</Text>
                  </View>
                }
                showsVerticalScrollIndicator={false}
              />
            </View>
          </View>
        </Modal>

        <Modal visible={showReviewsDrawer} transparent animationType="slide" onRequestClose={() => setShowReviewsDrawer(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
            <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFillObject} onPress={() => setShowReviewsDrawer(false)} />
            <View style={{ backgroundColor: T.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '85%', padding: 24 }}>
              <View style={{ width: 48, height: 5, borderRadius: 99, backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)', alignSelf: 'center', marginBottom: 20 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottomWidth: 1, borderBottomColor: T.border, paddingBottom: 16 }}>
                <View>
                  <Text style={{ fontSize: 24, fontWeight: '800', color: T.text, fontFamily: font }}>{t('home_rider_reviews')}</Text>
                  <Text style={{ fontSize: 11, color: T.sub, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
                    {reviews.length} {t('home_total_reviews')}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowReviewsDrawer(false)} style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={20} color={T.text} />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                <View style={{ backgroundColor: isDark ? '#1a1a2e' : '#fffbea', borderRadius: 24, padding: 24, flexDirection: 'row', alignItems: 'center', gap: 24, marginBottom: 24, borderWidth: 1, borderColor: '#f59e0b20' }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 44, fontWeight: '900', color: '#f59e0b', fontFamily: font }}>{rating ? rating.toFixed(1) : '—'}</Text>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#f59e0b', textTransform: 'uppercase', opacity: 0.8 }}>{t('home_avg_rating')}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', gap: 2, marginBottom: 4 }}>
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} size={18} fill={s <= Math.round(rating || 0) ? '#f59e0b' : 'transparent'} color="#f59e0b" strokeWidth={2.5} />
                      ))}
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: T.sub }}>{t('home_feedback_sub')}</Text>
                  </View>
                </View>
                <View style={{ gap: 16 }}>
                  {reviews.length > 0 ? reviews.map((rev: any, i: number) => (
                    <View key={rev.id || i} style={{ padding: 16, borderRadius: 20, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <View>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: T.text }}>{rev.customerName || 'Anonymous'}</Text>
                          <Text style={{ fontSize: 10, color: T.sub, fontWeight: '500', marginTop: 2 }}>
                            {formatAppDate(rev.createdAt, lang)}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f59e0b15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                          <Star size={12} fill="#f59e0b" color="#f59e0b" />
                          <Text style={{ fontSize: 12, fontWeight: '900', color: '#f59e0b' }}>{rev.rating || 0}</Text>
                        </View>
                      </View>
                      {rev.comment && (
                        <Text style={{ fontSize: 13, color: T.text, lineHeight: 19, marginBottom: 12, fontWeight: '500' }}>"{rev.comment}"</Text>
                      )}
                    </View>
                  )) : (
                    <View style={{ padding: 40, alignItems: 'center' }}>
                      <Star size={32} color={T.border} style={{ marginBottom: 12, opacity: 0.5 }} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: T.sub }}>{t('home_no_reviews')}</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

      </View>

      {/* Order Execution Overlay */}
      {activeBatchId && !isMinimized && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 1000 }]}>
          <OrderExecution
            batchOrders={groupedAssignedOrders.find(g => (g[0].batchId || g[0].id) === activeBatchId) || []}
            onMinimize={() => setIsMinimized(true)}
            onFinish={() => setActiveBatchId(null)}
          />
        </View>
      )}
    </View>
  );
}
