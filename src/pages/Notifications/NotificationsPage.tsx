import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Modal, StyleSheet, Dimensions, TouchableOpacity, Animated as RNAnimated } from 'react-native';
import ReAnimated, { 
  FadeIn, FadeOut, FadeInDown, FadeInUp, FadeOutDown, 
  Layout, LinearTransition, 
  useAnimatedStyle, withRepeat, withTiming, withSequence, useSharedValue 
} from 'react-native-reanimated';
import { usePathname } from 'expo-router';
import { PanResponder } from 'react-native';
import { useRouter } from 'expo-router';
import { db } from '../../config/firebase';
import { collection, query, where, onSnapshot, orderBy, limit, doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { getCachedDoc } from '../../utils/firebaseCache';
import { getDatabase, ref as rtdbRef, onValue, off } from 'firebase/database';
import { useAuthStore } from '../../store/authStore';
import { useApp } from '../../context/AppContext';
import {
  Bell, MessageSquare, Package, CheckCircle2,
  Trash2, BellOff, Clock, PackageCheck,
  X, ChevronRight, ShoppingBag, Banknote
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

import OrderExecution from '../Order/OrderExecution';
import ChatWindow from '../../components/chat/ChatWindow';

const { width } = Dimensions.get('window');

const TYPES: Record<string, any> = {
  new_order:    { color: '#22d47a', gradient: ['#22d47a', '#16a34a'], Icon: ShoppingBag },
  order_status: { color: '#e85d04', gradient: ['#e85d04', '#c44d00'], Icon: PackageCheck },
  chat:         { color: '#3b82f6', gradient: ['#3b82f6', '#1d4ed8'], Icon: MessageSquare },
  wallet:       { color: '#f59e0b', gradient: ['#f59e0b', '#b45309'], Icon: Banknote },
};

const STATUS_LABEL_KEY: Record<string, string> = {
  assigned:            'nstatus_assigned',
  accepted:            'nstatus_accepted',
  arrived_at_branch:   'nstatus_arrived_at_branch',
  picked:              'nstatus_picked',
  out_for_delivery:    'nstatus_out_for_delivery',
  arrived_at_customer: 'nstatus_arrived_at_customer',
  delivered:           'nstatus_delivered',
  cancelled:           'nstatus_cancelled',
  returning_to_branch: 'nstatus_returning_to_branch',
};

const ACTIVE_STATUSES = ['assigned', 'accepted', 'arrived_at_branch', 'picked', 'out_for_delivery', 'arrived_at_customer'];

const timeAgo = (ts: any, t: any) => {
  if (!ts) return '';
  const ms = typeof ts === 'number' ? ts : ts?.seconds ? ts.seconds * 1000 : ts?.toDate ? ts.toDate().getTime() : new Date(ts).getTime();
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60)    return t('notif_just_now');
  if (s < 3600)  return `${Math.floor(s / 60)}${t('notif_min_ago')}`;
  if (s < 86400) return `${Math.floor(s / 3600)}${t('notif_hr_ago')}`;
  return `${Math.floor(s / 86400)}${t('notif_day_ago')}`;
};

const groupNotifsByDate = (notifs: any[], lang: string, t: any) => {
  const groups: Record<string, any[]> = {};
  
  const todayStr = lang === 'bn' ? 'আজকে' : 'Today';
  const yesterdayStr = lang === 'bn' ? 'গতকাল' : 'Yesterday';
  
  const getDayString = (ts: any) => {
    if (!ts) return lang === 'bn' ? 'অন্যান্য' : 'Others';
    const ms = typeof ts === 'number' ? ts : ts?.seconds ? ts.seconds * 1000 : ts?.toDate ? ts.toDate().getTime() : new Date(ts).getTime();
    
    const date = new Date(ms);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return todayStr;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return yesterdayStr;
    } else {
      if (lang === 'bn') {
        const months = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
        const toBnDigits = (num: number) => String(num).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]);
        return `${toBnDigits(date.getDate())} ${months[date.getMonth()]} ${toBnDigits(date.getFullYear())}`;
      } else {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
      }
    }
  };
  
  notifs.forEach(n => {
    const day = getDayString(n.ts);
    if (!groups[day]) groups[day] = [];
    groups[day].push(n);
  });
  
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === todayStr) return -1;
    if (b === todayStr) return 1;
    if (a === yesterdayStr) return -1;
    if (b === yesterdayStr) return 1;
    
    const tsA = groups[a][0]?.ts;
    const tsB = groups[b][0]?.ts;
    const msA = tsA ? (typeof tsA === 'number' ? tsA : tsA.seconds ? tsA.seconds * 1000 : tsA.toDate ? tsA.toDate().getTime() : new Date(tsA).getTime()) : 0;
    const msB = tsB ? (typeof tsB === 'number' ? tsB : tsB.seconds ? tsB.seconds * 1000 : tsB.toDate ? tsB.toDate().getTime() : new Date(tsB).getTime()) : 0;
    return msB - msA;
  });
  
  return { keys: sortedKeys, groups };
};

const Pulse = ({ color }: { color: string }) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    scale.value = withRepeat(withTiming(2.2, { duration: 1800 }), -1, false);
    opacity.value = withRepeat(withTiming(0, { duration: 1800 }), -1, false);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <ReAnimated.View style={[{
      position: 'absolute', inset: 0, borderRadius: 16, backgroundColor: color, zIndex: -1
    }, animatedStyle]} />
  );
};

const Skeleton = ({ T, isDark }: any) => {
  const opacity = useSharedValue(0.4);
  useEffect(() => {
    opacity.value = withRepeat(withSequence(withTiming(0.2, { duration: 800 }), withTiming(0.4, { duration: 800 })), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <ReAnimated.View style={[{
      height: 90, backgroundColor: isDark ? T.surface : '#e2e8f0', 
      borderRadius: 22, marginBottom: 12, borderWidth: 1.2, borderColor: T.border
    }, animatedStyle]} />
  );
};

const NotifCard = ({ notif, onDismiss, onClick, T, isDark, t, lang, font }: any) => {
  const cfg = TYPES[notif.type] || TYPES.order_status;
  const Icon = cfg.Icon;
  const isClickable = ['chat', 'new_order', 'order_status', 'wallet'].includes(notif.type);

  return (
    <ReAnimated.View 
      entering={FadeInUp.duration(300)}
      exiting={FadeOutDown.duration(200)}
      layout={LinearTransition.duration(250)}
      style={{ marginBottom: 12 }}
    >
      <Pressable
        onPress={() => isClickable && onClick(notif)}
        style={({ pressed }) => [
          {
            backgroundColor: T.surface,
            borderWidth: 1.2,
            borderColor: notif.unread ? `${cfg.color}40` : T.border,
            borderRadius: 22,
            overflow: 'hidden',
            shadowColor: notif.unread ? cfg.color : '#000',
            shadowOpacity: notif.unread ? (isDark ? 0.2 : 0.1) : (isDark ? 0.15 : 0.04),
            shadowRadius: notif.unread ? 20 : 12,
            shadowOffset: { width: 0, height: notif.unread ? 8 : 4 },
            elevation: notif.unread ? 8 : 2,
            opacity: pressed && isClickable ? 0.85 : 1
          }
        ]}
      >
        {notif.unread && (
          <LinearGradient colors={cfg.gradient} start={{x:0, y:0}} end={{x:1, y:1}} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3.5 }} />
        )}

        <View style={{ flexDirection: 'row', gap: 14, padding: 16, paddingHorizontal: 14 }}>
          <View style={{
            width: 48, height: 48, borderRadius: 16,
            backgroundColor: notif.unread ? 'transparent' : (isDark ? `${cfg.color}15` : `${cfg.color}08`),
            borderWidth: 1.2, borderColor: notif.unread ? 'transparent' : `${cfg.color}25`,
            alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
          }}>
            {notif.unread && (
              <LinearGradient colors={cfg.gradient} style={{...StyleSheet.absoluteFillObject}} start={{x:0,y:0}} end={{x:1,y:1}} />
            )}
            <Icon size={22} color={notif.unread ? '#fff' : cfg.color} strokeWidth={2.4} />
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
              <Text style={{
                flex: 1, fontSize: 14, fontWeight: notif.unread ? '900' : '700',
                color: T.text, lineHeight: 18, fontFamily: font,
              }} numberOfLines={1}>
                {notif.title}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {notif.unread && (
                  <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: cfg.color, shadowColor: cfg.color, shadowOpacity: 0.8, shadowRadius: 8 }} />
                )}
                <Pressable
                  onPress={(e) => { e.stopPropagation(); onDismiss(notif.id); }}
                  style={{ width: 26, height: 26, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={13} strokeWidth={3} color={T.sub} />
                </Pressable>
              </View>
            </View>

            <Text style={{
              fontSize: 12, color: T.sub, marginBottom: 12,
              lineHeight: 18, fontFamily: font, fontWeight: '500', opacity: 0.9
            }} numberOfLines={2}>
              {notif.body}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Clock size={10} color={T.sub} strokeWidth={2.5} />
                <Text style={{ fontSize: 10, color: T.sub, fontWeight: '800', fontFamily: font, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {timeAgo(notif.ts, t)}
                </Text>
                {notif.tag && (
                  <>
                    <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: T.border }} />
                    <Text style={{ fontSize: 9.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8, color: cfg.color, fontFamily: font }}>
                      {notif.tag}
                    </Text>
                  </>
                )}
              </View>
              {isClickable && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 9.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, color: cfg.color, fontFamily: font }}>
                    {t('notif_open')}
                  </Text>
                  <ChevronRight size={14} strokeWidth={3} color={cfg.color} />
                </View>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    </ReAnimated.View>
  );
};

const Pill = ({ active, label, badge, color, onClick, T, isDark, font, scrollX, index, width }: any) => {
  const bg = scrollX ? scrollX.interpolate({
    inputRange: [(index - 1) * width, index * width, (index + 1) * width],
    outputRange: [isDark ? '#13132a' : '#f0f0f8', color, isDark ? '#13132a' : '#f0f0f8'],
    extrapolate: 'clamp'
  }) : (active ? color : (isDark ? '#13132a' : '#f0f0f8'));

  const tx = scrollX ? scrollX.interpolate({
    inputRange: [(index - 1) * width, index * width, (index + 1) * width],
    outputRange: [T.sub, '#fff', T.sub],
    extrapolate: 'clamp'
  }) : (active ? '#fff' : T.sub);

  return (
    <TouchableOpacity onPress={onClick} activeOpacity={0.8}>
      <RNAnimated.View
        style={{
          height: 32, paddingHorizontal: 14, borderRadius: 16,
          backgroundColor: bg,
          flexDirection: 'row', alignItems: 'center', gap: 6,
          shadowColor: color, shadowOpacity: active ? 0.3 : 0, shadowRadius: 8, elevation: active ? 3 : 0
        }}
      >
        <RNAnimated.Text style={{
          color: tx,
          fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1,
          fontFamily: font,
        }}>
          {label}
        </RNAnimated.Text>
        {badge > 0 && (
          <View style={{
            backgroundColor: active ? 'rgba(255,255,255,0.2)' : (isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)'),
            minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
          }}>
            <Text style={{ color: active ? '#fff' : T.sub, fontSize: 8, fontWeight: '900', fontFamily: font }}>{badge}</Text>
          </View>
        )}
      </RNAnimated.View>
    </TouchableOpacity>
  );
};

export default function NotificationsPage() {
  const router = useRouter();
  const { rider } = useAuthStore();
  const { T, t, lang, theme, font } = useApp();
  const { width } = Dimensions.get('window');
  const isDark = theme === 'dark';
  const surf = isDark ? T.surface : '#fff';
  const surfHi = isDark ? T.hi : '#f8f9fa';

  const [notifs, setNotifs] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const filterRef = useRef(filter);
  useEffect(() => { filterRef.current = filter; }, [filter]);

  const [subFilter, setSubFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [activeExecOrder, setActiveExecOrder] = useState<any>(null);
  const [chatOrder, setChatOrder] = useState<any>(null);

  const firstLoadIds = useRef<Set<string> | null>(null);
  const walletFirstLoad = useRef(true);
  const chatListeners = useRef<Record<string, boolean>>({});
  const dismissedIds = useRef(new Set<string>());

  useEffect(() => {
    if (!rider?.uid) return;
    const loadCache = async () => {
      try {
        const saved = await AsyncStorage.getItem(`notif_dismissed_${rider.uid}`);
        if (saved) JSON.parse(saved).forEach((id: string) => dismissedIds.current.add(id));
      } catch {}
      getCachedDoc(doc(db, 'rider_notif_prefs', rider.uid), getDoc).then(data => {
        if (data) {
          const ids = data.dismissedIds || [];
          ids.forEach((id: string) => dismissedIds.current.add(id));
          try { AsyncStorage.setItem(`notif_dismissed_${rider.uid}`, JSON.stringify([...dismissedIds.current])); } catch {}
        }
      }).catch(() => {});
    };
    loadCache();
  }, [rider?.uid]);

  const saveDismissed = useCallback(async (newId?: string) => {
    if (!rider?.uid) return;
    try { await AsyncStorage.setItem(`notif_dismissed_${rider.uid}`, JSON.stringify([...dismissedIds.current])); } catch {}
    if (newId) setDoc(doc(db, 'rider_notif_prefs', rider.uid), { dismissedIds: arrayUnion(newId) }, { merge: true }).catch(console.error);
  }, [rider?.uid]);

  const upsert = useCallback((n: any) => {
    if (dismissedIds.current.has(n.id)) return;
    setNotifs(prev => {
      const i = prev.findIndex(x => x.id === n.id);
      if (i !== -1) { const copy = [...prev]; copy[i] = { ...copy[i], ...n }; return copy; }
      return [n, ...prev];
    });
  }, []);

  // 1. ORDER notifications
  useEffect(() => {
    if (!rider?.uid) return;
    const q = query(collection(db, 'orders'), where('riderId', '==', rider.uid), where('status', 'in', ['assigned', 'accepted', 'arrived_at_branch', 'picked', 'out_for_delivery', 'arrived_at_customer', 'delivered', 'cancelled', 'returning_to_branch']));
    const unsub = onSnapshot(q, (snap) => {
      if (firstLoadIds.current === null) {
        const baseline = new Set<string>();
        snap.docs.forEach(d => baseline.add(`${d.id}_${d.data().status}`));
        firstLoadIds.current = baseline;
        const base = snap.docs.filter(d => STATUS_LABEL_KEY[d.data().status]).map(d => {
          const o = { id: d.id, ...d.data() } as any;
          return {
            id: `order_${o.id}_${o.status}`, type: o.status === 'assigned' ? 'new_order' : 'order_status',
            title: t(STATUS_LABEL_KEY[o.status]),
            body: lang === 'bn' ? `${t('notif_order_body_bn')} #${o.id} · ${o.customer?.name || ''} · ৳${o.totalAmount || 0}` : `Order #${o.id} · ${o.customer?.name || ''} · ৳${o.totalAmount || 0}`,
            tag: `#${o.id}`, ts: o.updatedAt || o.createdAt || null, unread: false, orderId: o.id, orderStatus: o.status,
          };
        }).filter(n => !dismissedIds.current.has(n.id));
        setNotifs(prev => [...base, ...prev.filter(n => n.type === 'chat' || n.type === 'wallet')]);
        setLoading(false);
        return;
      }
      snap.docChanges().forEach(change => {
        if (change.type === 'removed') return;
        const o = { id: change.doc.id, ...change.doc.data() } as any;
        const key = `${o.id}_${o.status}`;
        if (!STATUS_LABEL_KEY[o.status]) return;
        const isNew = !firstLoadIds.current?.has(key);
        firstLoadIds.current?.add(key);
        upsert({
          id: `order_${o.id}_${o.status}`, type: o.status === 'assigned' ? 'new_order' : 'order_status',
          title: t(STATUS_LABEL_KEY[o.status]),
          body: lang === 'bn' ? `${t('notif_order_body_bn')} #${o.id} · ${o.customer?.name || ''} · ৳${o.totalAmount || 0}` : `Order #${o.id} · ${o.customer?.name || ''} · ৳${o.totalAmount || 0}`,
          tag: `#${o.id}`, ts: o.updatedAt || o.createdAt || null, unread: isNew, orderId: o.id, orderStatus: o.status,
        });
      });
    }, err => { console.error('Order notif:', err); setLoading(false); });
    return () => unsub();
  }, [rider, lang, upsert, t]);

  // 2. CHAT notifications
  useEffect(() => {
    if (!rider?.uid) return;
    const rtdb = getDatabase();
    const q = query(collection(db, 'orders'), where('riderId', '==', rider.uid), where('status', 'in', ACTIVE_STATUSES));
    const unsubOrders = onSnapshot(q, (snap) => {
      const activeIds = new Set(snap.docs.map(d => d.id));
      Object.keys(chatListeners.current).forEach(oid => { if (!activeIds.has(oid)) { off(rtdbRef(rtdb, `chats/${oid}/messages`)); delete chatListeners.current[oid]; } });
      snap.docs.forEach(docSnap => {
        const oid = docSnap.id; const o = docSnap.data(); if (chatListeners.current[oid]) return;
        onValue(rtdbRef(rtdb, `chats/${oid}/messages`), (chatSnap) => {
          if (!chatSnap.exists()) { setNotifs(prev => prev.filter(n => n.id !== `chat_${oid}`)); return; }
          const entries = Object.entries(chatSnap.val());
          const unread = entries.filter(([, m]: any) => m.senderRole === 'customer' && !m.read);
          if (unread.length === 0) { setNotifs(prev => prev.filter(n => n.id !== `chat_${oid}`)); return; }
          const latest: any = unread.sort(([, a]: any, [, b]: any) => (b.timestamp || 0) - (a.timestamp || 0))[0][1];
          upsert({
            id: `chat_${oid}`, type: 'chat',
            title: lang === 'bn' ? `${o.customer?.name || 'Customer'} ${t('notif_msg_from')}` : `${t('notif_msg_from')} ${o.customer?.name || 'Customer'}`,
            body: latest.text ? latest.text.slice(0, 72) : t('notif_sent_image'),
            tag: `#${oid}`, ts: latest.timestamp || Date.now(), unread: true, badge: unread.length, orderId: oid, orderData: o,
          });
        });
        chatListeners.current[oid] = true;
      });
    });
    return () => { unsubOrders(); Object.keys(chatListeners.current).forEach(oid => off(rtdbRef(rtdb, `chats/${oid}/messages`))); chatListeners.current = {}; };
  }, [rider, lang, upsert, t]);

  // 3. WALLET notifications
  useEffect(() => {
    if (!rider?.uid) return;
    const q = query(collection(db, 'transactions'), where('riderId', '==', rider.uid), orderBy('createdAt', 'desc'), limit(15));
    const unsub = onSnapshot(q, (snap) => {
      const isFirst = walletFirstLoad.current; if (isFirst) walletFirstLoad.current = false;
      snap.docChanges().forEach(change => {
        if (change.type === 'removed') return;
        const tx = { id: change.doc.id, ...change.doc.data() } as any;
        const isCash = tx.type === 'cash_collection' || tx.type === 'collection';
        upsert({
          id: `wallet_${tx.id}`, type: 'wallet',
          title: isCash ? `৳${tx.amount} ${t('notif_wallet_added')}` : `৳${tx.amount} ${t('notif_wallet_sent')}`,
          body: isCash ? `${t('notif_cash_from')} #${tx.orderId || 'N/A'}` : t('notif_transfer_done'),
          tag: isCash ? t('notif_tag_credit') : t('notif_tag_transfer'),
          subType: isCash ? 'cash' : 'transfer',
          ts: tx.createdAt, unread: !isFirst && change.type === 'added',
        });
      });
    }, err => console.error('Wallet notif:', err));
    return () => unsub();
  }, [rider, lang, upsert, t]);

  const handleNotifClick = useCallback(async (notif: any) => {
    setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, unread: false } : n));
    if (notif.type === 'chat') {
      if (notif.orderData) setChatOrder({ id: notif.orderId, ...notif.orderData });
      else { try { const snap = await getDoc(doc(db, 'orders', notif.orderId)); if (snap.exists()) setChatOrder({ id: snap.id, ...snap.data() }); } catch (e) { console.error(e); } }
    } else if (notif.type === 'new_order' || notif.type === 'order_status') {
      try { const snap = await getDoc(doc(db, 'orders', notif.orderId)); if (snap.exists()) setActiveExecOrder({ id: snap.id, ...snap.data() }); } catch (e) { console.error(e); }
    } else if (notif.type === 'wallet') {
      router.push('/wallet');
    }
  }, [router]);

  const dismiss = useCallback((id: string) => { dismissedIds.current.add(id); saveDismissed(id); setNotifs(p => p.filter(n => n.id !== id)); }, [saveDismissed]);

  const clearAll = useCallback(() => {
    notifs.forEach(n => dismissedIds.current.add(n.id));
    if (rider?.uid && notifs.length > 0) setDoc(doc(db, 'rider_notif_prefs', rider.uid), { dismissedIds: arrayUnion(...notifs.map(n => n.id)) }, { merge: true }).catch(console.error);
    saveDismissed(); setNotifs([]);
  }, [notifs, saveDismissed, rider?.uid]);

  const markAllRead = useCallback(() => setNotifs(p => p.map(n => ({ ...n, unread: false }))), []);

  const toMs = (ts: any) => { if (!ts) return 0; if (typeof ts === 'number') return ts; if (ts?.seconds) return ts.seconds * 1000; if (ts?.toDate) return ts.toDate().getTime(); return new Date(ts).getTime(); };

  const sorted   = [...notifs].sort((a, b) => { if (a.unread !== b.unread) return a.unread ? -1 : 1; return toMs(b.ts) - toMs(a.ts); });
  const filtered = sorted.filter(n => {
    const passMain = filter === 'all' ? true : filter === 'orders' ? (n.type === 'new_order' || n.type === 'order_status') : n.type === filter;
    if (!passMain) return false;
    if (filter === 'wallet' && subFilter !== 'all') return n.subType === subFilter;
    return true;
  });

  const unreadAll   = notifs.filter(n => n.unread).length;
  const unreadChat  = notifs.filter(n => n.type === 'chat' && n.unread).length;
  const unreadOrder = notifs.filter(n => (n.type === 'new_order' || n.type === 'order_status') && n.unread).length;
  const walletCount = notifs.filter(n => n.type === 'wallet' && n.unread).length;

  const scrollX = useRef(new RNAnimated.Value(0)).current;
  const contentFlatListRef = useRef<any>(null);

  const FILTERS = [
    { id: 'all',    label: t('notif_tab_all'),    badge: unreadAll,   color: '#e85d04' },
    { id: 'chat',   label: t('notif_tab_chat'),   badge: unreadChat,  color: '#3b82f6' },
    { id: 'orders', label: t('notif_tab_orders'), badge: unreadOrder, color: '#22d47a' },
    { id: 'wallet', label: t('notif_tab_wallet'), badge: walletCount, color: '#f59e0b' },
  ];

  const onTabPress = (index: number) => {
    setFilter(FILTERS[index].id);
    contentFlatListRef.current?.scrollToOffset({ offset: index * width, animated: true });
  };

  const WALLET_SUB_FILTERS = [
    { id: 'all',      label: t('notif_tab_all'),    badge: walletCount, color: '#f59e0b' },
    { id: 'cash',     label: t('notif_tab_cash'),   badge: notifs.filter(n => n.type === 'wallet' && n.subType === 'cash' && n.unread).length, color: '#f59e0b' },
    { id: 'transfer', label: t('notif_tab_transfer'), badge: notifs.filter(n => n.type === 'wallet' && n.subType === 'transfer' && n.unread).length, color: '#f59e0b' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
        {/* HEADER */}
        <View style={{ padding: 14, paddingTop: 54, paddingBottom: 10 }}>
          <LinearGradient colors={[surfHi, 'transparent']} style={StyleSheet.absoluteFillObject} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{
                width: 34, height: 34, borderRadius: 12,
                backgroundColor: unreadAll > 0 ? 'transparent' : surf,
                borderWidth: 1.2, borderColor: unreadAll > 0 ? 'transparent' : T.border,
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
              }}>
                {unreadAll > 0 && <LinearGradient colors={['#e85d04', '#c44d00']} style={StyleSheet.absoluteFillObject} start={{x:0, y:0}} end={{x:1, y:1}} />}
                <Bell size={16} color={unreadAll > 0 ? '#fff' : T.sub} strokeWidth={2.5} />
              </View>
              <View>
                <Text style={{ fontFamily: font, fontSize: 20, fontWeight: '900', color: T.text, lineHeight: 22 }}>{t('notif_title')}</Text>
                {unreadAll > 0 && (
                  <Text style={{ fontSize: 8, color: '#e85d04', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    {unreadAll} {t('notif_unread').split(' ')[1] || 'New'}
                  </Text>
                )}
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {unreadAll > 0 && (
                <Pressable onPress={markAllRead} style={({ pressed }) => [{ width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: T.border, backgroundColor: surf, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 }]}>
                  <CheckCircle2 size={16} strokeWidth={2.4} color={T.sub} />
                </Pressable>
              )}
              {notifs.length > 0 && (
                <Pressable onPress={clearAll} style={({ pressed }) => [{ width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,77,109,.2)', backgroundColor: 'rgba(255,77,109,.05)', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 }]}>
                  <Trash2 size={16} strokeWidth={2.4} color="#ff4d6d" />
                </Pressable>
              )}
            </View>
          </View>


        </View>

        {/* Filter Container */}
        <View style={{ backgroundColor: T.bg, borderBottomWidth: 1.2, borderColor: T.border, paddingBottom: 10 }}>
          {/* Main Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: filter === 'wallet' ? 12 : 0 }}>
            {FILTERS.map((f, idx) => (
              <Pill key={f.id} active={filter === f.id} label={f.label} badge={f.badge} color={f.color} onClick={() => onTabPress(idx)} T={T} isDark={isDark} font={font} scrollX={scrollX} index={idx} width={width} />
            ))}
          </ScrollView>

          {/* Sub-Filters (Dynamic) */}
          {filter === 'wallet' && (
            <ReAnimated.View entering={FadeIn.duration(300)} style={{ paddingHorizontal: 16, flexDirection: 'row', marginTop: 4 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {WALLET_SUB_FILTERS.map(sf => (
                  <Pill key={sf.id} active={subFilter === sf.id} label={sf.label} badge={sf.badge} color={sf.color} onClick={() => setSubFilter(sf.id)} T={T} isDark={isDark} font={font} />
                ))}
              </ScrollView>
            </ReAnimated.View>
          )}
        </View>

        {/* NOTIFICATION LIST (Horizontal Paging) */}
        <RNAnimated.FlatList
          ref={contentFlatListRef}
          data={FILTERS}
          horizontal
          pagingEnabled
          snapToInterval={width}
          decelerationRate="fast"
          snapToAlignment="start"
          showsHorizontalScrollIndicator={false}
          onScroll={RNAnimated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / width);
            setFilter(FILTERS[index].id);
          }}
          renderItem={({ item: mainFilter }) => {
            const pageFiltered = sorted.filter(n => {
              const passMain = mainFilter.id === 'all' ? true : mainFilter.id === 'orders' ? (n.type === 'new_order' || n.type === 'order_status') : n.type === mainFilter.id;
              if (!passMain) return false;
              if (mainFilter.id === 'wallet' && subFilter !== 'all') return n.subType === subFilter;
              return true;
            });

            return (
              <View style={{ width, paddingHorizontal: 16, paddingTop: 16, minHeight: 600 }}>
                {loading ? (
                  [1, 2, 3].map(i => <Skeleton key={i} T={T} isDark={isDark} />)
                ) : pageFiltered.length === 0 ? (
                  <View style={{ alignItems: 'center', gap: 20, paddingTop: 80, opacity: 0.6 }}>
                    <View style={{ width: 100, height: 100, borderRadius: 40, backgroundColor: surfHi, borderWidth: 2, borderColor: T.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}>
                      <BellOff size={40} color={T.sub} strokeWidth={1.5} />
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2.5, color: T.text, fontFamily: font }}>{t('notif_empty')}</Text>
                  </View>
                ) : (
                  (() => {
                    const { keys, groups } = groupNotifsByDate(pageFiltered, lang, t);
                    return keys.map(key => (
                      <View key={key} style={{ marginBottom: 18 }}>
                        <Text style={{ fontFamily: font, fontSize: 11, fontWeight: '900', color: T.accent, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, opacity: 0.85 }}>
                          {key}
                        </Text>
                        {groups[key].map((n: any) => (
                          <NotifCard key={n.id} notif={n} onDismiss={dismiss} onClick={handleNotifClick} T={T} isDark={isDark} t={t} lang={lang} font={font} />
                        ))}
                      </View>
                    ));
                  })()
                )}
              </View>
            );
          }}
        />
      </ScrollView>

      {/* OVERLAYS */}
      <Modal visible={!!activeExecOrder} animationType="slide" transparent>
        <OrderExecution batchOrders={[activeExecOrder]} onMinimize={() => setActiveExecOrder(null)} />
      </Modal>
      
      <Modal visible={!!chatOrder} animationType="slide" transparent>
        <ChatWindow order={chatOrder} onClose={() => setChatOrder(null)} />
      </Modal>
    </View>
  );
}
