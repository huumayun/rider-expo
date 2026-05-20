import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated as RNAnimated, ActivityIndicator, Pressable, Dimensions, FlatList
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Wallet, Send, Clock, CheckCircle2,
  TrendingUp, Banknote, ArrowDownLeft, ArrowUpRight,
  ChevronRight, ShoppingBag, AlertTriangle, History
} from 'lucide-react-native';
import { useAuthStore } from '../../store/authStore';
import { useApp } from '../../context/AppContext';
import { useRiderData } from '../../context/RiderDataContext';
import { formatAppDate, toDate } from '../../utils/dateUtils';
import { collection, query, where, orderBy, onSnapshot, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '../../config/firebase';

const txCache: Record<string, any[]> = {
  all: [],
  cash: [],
  transfer: []
};
const txLastDoc: Record<string, any> = {};
const txHasMore: Record<string, boolean> = {
  all: true,
  cash: true,
  transfer: true
};

const isToday = (ts: any) => {
  const d = toDate(ts);
  if (!d) return false;
  return d.toDateString() === new Date().toDateString();
};

const getTxConfig = (tx: any, T: any, t: any) => {
  const isCash = tx.type === 'cash_collection' || tx.type === 'collection';
  const isTransfer = tx.type === 'admin_transfer' || tx.type === 'transfer';

  if (isCash) return {
    Icon: ArrowDownLeft,
    iconColor: '#22d47a', iconBg: ['#22d47a18', '#16a34a10'], iconBorder: '#22d47a28',
    label: t('wallet_order_prefix') === 'wallet_order_prefix' ? `Order #${tx.orderSeq || 'N/A'}` : `${t('wallet_order_prefix')} #${tx.orderSeq || 'N/A'}`,
    sub: t('wallet_cash_label') === 'wallet_cash_label' ? 'Cash Collection' : t('wallet_cash_label'),
    amountColor: '#22d47a', sign: '+',
    tagBg: '#22d47a18', tagColor: '#22d47a', tagLabel: t('wallet_credit_tag') === 'wallet_credit_tag' ? 'CREDIT' : t('wallet_credit_tag'),
  };
  if (isTransfer) return {
    Icon: ArrowUpRight,
    iconColor: '#f87171', iconBg: ['#f8717118', '#dc262610'], iconBorder: '#f8717128',
    label: t('wallet_admin_label') === 'wallet_admin_label' ? 'Admin Transfer' : t('wallet_admin_label'),
    sub: t('wallet_balance_transfer') === 'wallet_balance_transfer' ? 'Balance Settled' : t('wallet_balance_transfer'),
    amountColor: '#f87171', sign: '−',
    tagBg: '#f8717118', tagColor: '#f87171', tagLabel: t('wallet_transfer_tag') === 'wallet_transfer_tag' ? 'DEBIT' : t('wallet_transfer_tag'),
  };
  return {
    Icon: Banknote,
    iconColor: T.sub as string, iconBg: [T.border + '30', T.border + '30'], iconBorder: T.border as string,
    label: tx.type || (t('wallet_tx_label') === 'wallet_tx_label' ? 'Transaction' : t('wallet_tx_label')), sub: '',
    amountColor: T.text as string, sign: '',
    tagBg: T.border + '20', tagColor: T.sub as string, tagLabel: 'TX',
  };
};

const TxCard = React.memo(({ tx, idx, lang, T, isDark, t, font }: any) => {
  const cfg = getTxConfig(tx, T, t);
  const slideAnim = useRef(new RNAnimated.Value(20)).current;
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8, delay: idx * 40 }),
      RNAnimated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true, delay: idx * 40 })
    ]).start();
  }, []);

  return (
    <RNAnimated.View style={{
      backgroundColor: isDark ? T.surface : '#ffffff',
      borderWidth: 1, borderColor: T.border,
      borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14,
      flexDirection: 'row', alignItems: 'center', gap: 14,
      opacity: fadeAnim, transform: [{ translateY: slideAnim }]
    }}>
      {/* Icon */}
      <View style={{ width: 46, height: 46, borderRadius: 15, borderWidth: 1, borderColor: cfg.iconBorder, overflow: 'hidden' }}>
        <LinearGradient colors={cfg.iconBg as [string, string]} style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}>
          <cfg.Icon size={19} color={cfg.iconColor} strokeWidth={2} />
        </LinearGradient>
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: T.text, marginBottom: 2 }} numberOfLines={1}>{cfg.label}</Text>
        <Text style={{ fontSize: 10, color: T.sub, marginBottom: 5, fontWeight: '600', fontFamily: font }}>{cfg.sub}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Clock size={10} color={T.sub as string} strokeWidth={2} />
          <Text style={{ fontSize: 9, color: T.sub, fontWeight: '600' }}>{formatAppDate(tx.createdAt, lang)}</Text>
        </View>
      </View>

      {/* Amount + status */}
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: 0.3, color: cfg.amountColor, marginBottom: 4 }}>
          {cfg.sign}৳{(tx.amount || 0).toLocaleString()}
        </Text>
        <View style={{
          paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
          backgroundColor: tx.status === 'completed' ? '#22d47a18' : '#f59e0b18',
        }}>
          <Text style={{
            fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8,
            color: tx.status === 'completed' ? '#22d47a' : '#f59e0b',
          }}>
            {tx.status === 'completed' ? t('wallet_done') : t('wallet_pending')}
          </Text>
        </View>
      </View>
    </RNAnimated.View>
  );
});

const Pill = ({ active, label, onClick, color, T, isDark, scrollX, index, width }: any) => {
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
      <RNAnimated.View style={{
        height: 32, paddingHorizontal: 14, borderRadius: 16,
        backgroundColor: bg,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: color, shadowOpacity: active ? 0.3 : 0, shadowRadius: 8, elevation: active ? 3 : 0
      }}>
        <RNAnimated.Text style={{ 
          color: tx, 
          fontSize: 10, fontWeight: '800', 
          textTransform: 'uppercase', letterSpacing: 1 
        }}>
          {label}
        </RNAnimated.Text>
      </RNAnimated.View>
    </TouchableOpacity>
  );
};

export default function WalletPage() {
  const { rider } = useAuthStore();
  const { T, t, lang, font, theme } = useApp();
  const { width, height } = Dimensions.get('window');
  const isDark = theme === 'dark';
  const surf = isDark ? T.surface : '#ffffff';

  const [activeFilter, setActiveFilter] = useState('all');
  const [transactions, setTransactions] = useState<Record<string, any[]>>(txCache);
  const [loading, setLoading] = useState<Record<string, boolean>>({ all: false, cash: false, transfer: false });
  const [hasMore, setHasMore] = useState<Record<string, boolean>>(txHasMore);
  
  const scrollX = useRef(new RNAnimated.Value(0)).current;
  const listRef = useRef<any>(null);
  const riderId = rider?.uid;

  // Real-time listener for the latest transactions
  useEffect(() => {
    if (!riderId) return;
    
    const q = query(
      collection(db, 'transactions'),
      where('riderId', '==', riderId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsub = onSnapshot(q, (snap) => {
      const snapData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTransactions(prev => {
        const nextAll = [...snapData, ...prev.all.filter(p => !snapData.find(s => s.id === p.id))].sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        txCache.all = nextAll;
        if (!txLastDoc.all && snap.docs.length > 0) txLastDoc.all = snap.docs[snap.docs.length - 1];
        return { ...prev, all: nextAll };
      });
    });

    return () => unsub();
  }, [riderId]);

  // Ensure initial data for categorized tabs
  useEffect(() => {
    if (riderId && txCache.all.length === 0 && txHasMore.all) {
      loadMore();
    }
  }, [riderId]);

  const loadMore = async () => {
    if (loading.all || !hasMore.all || !riderId) return;
    
    setLoading(prev => ({ ...prev, all: true }));
    try {
      const q = query(
        collection(db, 'transactions'),
        where('riderId', '==', riderId),
        orderBy('createdAt', 'desc'),
        startAfter(txLastDoc.all || null),
        limit(40)
      );

      const snap = await getDocs(q);
      if (snap.empty) {
        setHasMore(prev => ({ ...prev, all: false }));
        txHasMore.all = false;
      } else {
        const newData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setTransactions(prev => {
          const updated = [...prev.all, ...newData];
          txCache.all = updated;
          return { ...prev, all: updated };
        });
        txLastDoc.all = snap.docs[snap.docs.length - 1];
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(prev => ({ ...prev, all: false }));
  };

  const holdingBalance = rider?.holdingBalance || 0;

  const stats = useMemo(() => {
    const cashTxs = transactions.all.filter((tx: any) => tx.type === 'cash_collection' || tx.type === 'collection');
    const transferTxs = transactions.all.filter((tx: any) => tx.type === 'admin_transfer' || tx.type === 'transfer');
    const todayCash = cashTxs.filter((tx: any) => isToday(tx.createdAt)).reduce((s: any, tx: any) => s + (tx.amount || 0), 0);
    const totalCash = cashTxs.reduce((s: any, tx: any) => s + (tx.amount || 0), 0);
    const totalSent = transferTxs.reduce((s: any, tx: any) => s + (tx.amount || 0), 0);
    return { todayCash, totalCash, totalSent, cashCount: cashTxs.length };
  }, [transactions.all]);

  const FILTERS = [
    { id: 'all',      label: t('wallet_tab_all') === 'wallet_tab_all' ? 'All' : t('wallet_tab_all'),    color: '#e85d04' },
    { id: 'cash',     label: t('wallet_tab_cash') === 'wallet_tab_cash' ? 'Cash' : t('wallet_tab_cash'),   color: '#22d47a' },
    { id: 'transfer', label: t('wallet_tab_transfer') === 'wallet_tab_transfer' ? 'Transfer' : t('wallet_tab_transfer'), color: '#f87171' },
  ];

  const onTabPress = (index: number) => {
    setActiveFilter(FILTERS[index].id);
    listRef.current?.scrollToOffset({ offset: index * width, animated: true });
  };

  const TransactionList = useCallback(({ fid }: { fid: string }) => {
    const data = useMemo(() => {
      if (fid === 'cash') return transactions.all.filter((tx: any) => tx.type === 'cash_collection' || tx.type === 'collection');
      if (fid === 'transfer') return transactions.all.filter((tx: any) => tx.type === 'admin_transfer' || tx.type === 'transfer');
      return transactions.all;
    }, [transactions.all, fid]);

    const isL = loading.all;
    const hasM = hasMore.all;

    return (
      <View style={{ width }}>
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
              <TxCard tx={item} idx={index} lang={lang} T={T} isDark={isDark} t={t} font={font} />
            </View>
          )}
          ListEmptyComponent={() => (
            !isL ? (
              <View style={{ alignItems: 'center', paddingVertical: 40, opacity: 0.5 }}>
                <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: isDark ? T.hi : '#fff3ea', borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Banknote size={26} color={T.sub as string} strokeWidth={1.5} />
                </View>
                <Text style={{ fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, color: T.sub, marginBottom: 4 }}>{t('wallet_empty') === 'wallet_empty' ? 'No Transactions' : t('wallet_empty')}</Text>
                <Text style={{ fontSize: 10, color: T.sub, opacity: 0.6, fontFamily: font }}>{t('wallet_empty_sub') === 'wallet_empty_sub' ? 'Records will appear here' : t('wallet_empty_sub')}</Text>
              </View>
            ) : <ActivityIndicator size="small" color={T.accent} style={{ marginTop: 20 }} />
          )}
          ListFooterComponent={() => (
            data.length > 0 ? (
              <View style={{ padding: 20, paddingBottom: 40 }}>
                {hasM ? (
                  <Pressable onPress={loadMore} style={({ pressed }) => ({
                    padding: 14, borderRadius: 16, backgroundColor: `${T.accent}10`, alignItems: 'center', opacity: pressed ? 0.7 : 1
                  })}>
                    <Text style={{ color: T.accent, fontSize: 12, fontWeight: '800' }}>
                      {isL ? (t('wallet_loading') === 'wallet_loading' ? 'Loading...' : t('wallet_loading')) : (t('wallet_load_more') === 'wallet_load_more' ? 'Load More' : t('wallet_load_more'))}
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={{ textAlign: 'center', fontSize: 11, color: T.sub, fontWeight: '600' }}>{t('wallet_no_more') === 'wallet_no_more' ? 'No more transactions' : t('wallet_no_more')}</Text>
                )}
              </View>
            ) : null
          )}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
        />
      </View>
    );
  }, [transactions.all, loading.all, hasMore.all, T, t, lang, font, isDark, width]);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* FIXED HEADER SECTION */}
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, overflow: 'hidden', shadowColor: '#e85d04', shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 }}>
              <LinearGradient colors={['#e85d04', '#c44d00']} style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}>
                <Wallet size={16} color="#fff" strokeWidth={2} />
              </LinearGradient>
            </View>
            <View>
              <Text style={{ fontFamily: font, fontSize: lang === 'bn' ? 18 : 22, fontWeight: '800', color: T.text, lineHeight: 22 }}>
                {t('wallet_title') === 'wallet_title' ? 'My Wallet' : t('wallet_title')}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {/* BALANCE CARD */}
          <View style={{ borderRadius: 24, padding: 20, overflow: 'hidden', shadowColor: '#e85d04', shadowOpacity: 0.35, shadowRadius: 20, elevation: 8, marginBottom: 12 }}>
            <LinearGradient colors={['#e85d04', '#c44d00', '#a33b00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
            <View style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.06)' }} />
            
            <View style={{ zIndex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2, opacity: 0.75 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />
                    <Text style={{ fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, color: '#fff' }}>
                      {t('wallet_in_hand') === 'wallet_in_hand' ? 'Cash In Hand' : t('wallet_in_hand')}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 36, fontWeight: '900', color: '#fff', lineHeight: 40 }}>
                    ৳{holdingBalance.toLocaleString()}
                  </Text>
                </View>

                <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Send size={12} color="#fff" strokeWidth={2.5} />
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', fontFamily: font }}>
                    {t('wallet_transfer_btn') === 'wallet_transfer_btn' ? 'Send' : t('wallet_transfer_btn')}
                  </Text>
                </TouchableOpacity>
              </View>

              {stats.todayCash > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: 0.9 }}>
                  <TrendingUp size={10} color="#fff" strokeWidth={2} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>
                    {(t('wallet_today') === 'wallet_today' ? 'Today' : t('wallet_today'))}: ৳{stats.todayCash}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* STATS ROW */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 8 }}>
            {[
              { label: t('wallet_total_cash'), value: `৳${stats.totalCash.toLocaleString()}`, Icon: ArrowDownLeft, color: '#22d47a' },
              { label: t('wallet_collections'), value: stats.cashCount, Icon: ShoppingBag, color: '#3b82f6' },
              { label: t('wallet_transferred'), value: `৳${stats.totalSent.toLocaleString()}`, Icon: ArrowUpRight, color: '#f87171' },
            ].map((s, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: surf, borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <View style={{ width: 18, height: 18, borderRadius: 5, backgroundColor: `${s.color}18`, alignItems: 'center', justifyContent: 'center' }}>
                    <s.Icon size={10} color={s.color} strokeWidth={2} />
                  </View>
                  <Text style={{ fontSize: 6.5, fontWeight: '800', textTransform: 'uppercase', color: T.sub }} numberOfLines={1}>{s.label}</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '800', color: s.color }} numberOfLines={1}>{s.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* TABS & LIST */}
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, opacity: 0.8 }}>
              <History size={12} color={T.sub as string} strokeWidth={2.5} />
              <Text style={{ fontFamily: font, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, color: T.sub }}>
                {t('wallet_history') === 'wallet_history' ? 'Transaction History' : t('wallet_history')}
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {FILTERS.map((f, idx) => (
                <Pill key={f.id} active={activeFilter === f.id} label={f.label} color={f.color} onClick={() => onTabPress(idx)} T={T} isDark={isDark} scrollX={scrollX} index={idx} width={width} />
              ))}
            </View>
          </View>

          <Animated.FlatList
            ref={listRef}
            data={FILTERS}
            horizontal
            pagingEnabled
            snapToInterval={width}
            decelerationRate="fast"
            snapToAlignment="start"
            showsHorizontalScrollIndicator={false}
            onScroll={RNAnimated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / width);
              setActiveFilter(FILTERS[index].id);
            }}
            renderItem={({ item }) => <TransactionList fid={item.id} />}
          />
        </View>
    </SafeAreaView>
    </View>
  );
}
