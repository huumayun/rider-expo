import React, { useState, useEffect, useMemo, useRef, memo, useCallback } from 'react';
import {
  View, Text, Pressable, FlatList, ActivityIndicator,
  TextInput, StyleSheet, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, rtdb } from '@/config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { Search, ChevronLeft, MessageSquare, Check, CheckCheck } from 'lucide-react-native';
import { useAuthStore } from '@/store/authStore';
import { useApp } from '@/context/AppContext';
import { RTDB_PATHS } from '@/config/constants';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { ChatListRow, ChatMsgInfo } from '@/components/chat/ChatListRow';

// ─── Divider ──────────────────────────────────────────────────────────────────
const Divider = memo(({ isDark }: { isDark: boolean }) => (
  <View style={[s.divider, {
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
    marginLeft: 20 + 52 + 14,
  }]} />
));

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ChatListPage() {
  const router = useRouter();
  const { T, theme, lang } = useApp();
  const { rider } = useAuthStore();
  const isDark = theme === 'dark';
  const screenBg = isDark ? '#0f172a' : '#f8fafc';

  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgMap, setMsgMap] = useState<Record<string, ChatMsgInfo>>({});

  // Track active RTDB unsubscribers by orderId
  const rtdbRefs = useRef<Record<string, () => void>>({});

  // ── Firestore: active orders ───────────────────────────────────────────────
  useEffect(() => {
    if (!rider?.uid) return;
    const q = query(
      collection(db, 'orders'),
      where('riderId', '==', rider.uid),
      where('status', 'in', [
        'assigned', 'accepted', 'go_to_branch',
        'arrived_at_branch', 'picked', 'out_for_delivery',
        'arrived_at_customer', 'returning_to_branch',
      ])
    );
    return onSnapshot(q, snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [rider?.uid]);

  // ── RTDB: one listener per order, managed via ref ─────────────────────────
  useEffect(() => {
    const activeIds = new Set(orders.map(o => o.id));

    // Tear down listeners for removed orders
    Object.keys(rtdbRefs.current).forEach(id => {
      if (!activeIds.has(id)) {
        rtdbRefs.current[id]();
        delete rtdbRefs.current[id];
      }
    });

    // Set up listeners for new orders only
    orders.forEach(order => {
      if (rtdbRefs.current[order.id]) return;

      const r = ref(rtdb, RTDB_PATHS.chat(order.id));
      const unsub = onValue(r, snap => {
        if (!snap.exists()) return;
        const vals: any[] = Object.values(snap.val() ?? {});
        if (!vals.length) return;
        vals.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
        const latest = vals[0];
        const unread = vals.filter(m => m.senderRole === 'customer' && !m.read).length;
        const text: string =
          latest.text ||
          (latest.imageUrl ? (lang === 'bn' ? '📷 ছবি' : '📷 Photo') : '');

        setMsgMap(prev => {
          const old = prev[order.id];
          // Reference equality bail-out — prevents extra renders
          if (
            old &&
            old.text === text &&
            old.time === (latest.timestamp ?? 0) &&
            old.unread === unread
          ) return prev;
          return {
            ...prev,
            [order.id]: {
              text,
              time: latest.timestamp ?? 0,
              unread,
              lastSenderRole: latest.senderRole ?? 'customer',
            },
          };
        });
      });

      rtdbRefs.current[order.id] = unsub;
    });

    // Full cleanup on unmount
    return () => {
      Object.values(rtdbRefs.current).forEach(u => u());
      rtdbRefs.current = {};
    };
  }, [orders, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived list: only orders WITH messages, sorted by latest ────────────
  const displayList = useMemo(() => {
    let list = orders.filter(o => !!msgMap[o.id]);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(o =>
        (o.customer?.name ?? '').toLowerCase().includes(s) ||
        o.id.toLowerCase().includes(s) ||
        String(o.seq ?? '').includes(s)
      );
    }
    return [...list].sort((a, b) => (msgMap[b.id]?.time ?? 0) - (msgMap[a.id]?.time ?? 0));
  }, [orders, msgMap, search]);

  const handlePress = useCallback((orderId: string, phone?: string, name?: string) => {
    router.push({ pathname: '/(app)/chat/[orderId]', params: { orderId, phone, name } });
  }, [router]);

  const totalUnread = useMemo(
    () => Object.values(msgMap).reduce((n, m) => n + m.unread, 0),
    [msgMap]
  );

  return (
    <SafeAreaView style={[s.screen, { backgroundColor: screenBg }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={[s.header, {
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderBottomColor: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
      }]}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={s.backBtn}>
          <ChevronLeft size={24} color={T.text} strokeWidth={2.5} />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: T.text }]}>
            {lang === 'bn' ? 'কাস্টমার চ্যাট' : 'Customer Chats'}
          </Text>
          <Text style={[s.headerSub, { color: T.sub }]}>
            {lang === 'bn'
              ? `${displayList.length}টি কথোপকথন`
              : `${displayList.length} conversations`}
          </Text>
        </View>

        {totalUnread > 0 && (
          <View style={[s.headerBadge, { backgroundColor: T.accent }]}>
            <Text style={s.headerBadgeText}>{totalUnread}</Text>
          </View>
        )}
      </View>

      {/* ── Search ──────────────────────────────────────────────────────────── */}
      <View style={[s.searchWrap, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
        <View style={[s.searchBox, {
          backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#f1f5f9',
        }]}>
          <Search size={16} color={T.sub} strokeWidth={2} />
          <TextInput
            style={[s.searchInput, { color: T.text }]}
            placeholder={lang === 'bn' ? 'নাম বা অর্ডার ID খুঁজুন...' : 'Search by name or order ID...'}
            placeholderTextColor={T.sub}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* ── List ────────────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={T.accent} />
        </View>
      ) : (
        <FlatList
          data={displayList}
          keyExtractor={o => o.id}
          renderItem={({ item, index }) => (
            <>
              <ChatListRow
                order={item}
                info={msgMap[item.id]}
                onPress={handlePress}
                T={T}
                isDark={isDark}
                lang={lang}
              />
              {index < displayList.length - 1 && <Divider isDark={isDark} />}
            </>
          )}
          style={{ backgroundColor: isDark ? '#0f172a' : '#ffffff' }}
          ListEmptyComponent={
            <View style={s.empty}>
              <LinearGradient
                colors={isDark ? ['#1e293b', '#0f172a'] : ['#f1f5f9', '#e2e8f0']}
                style={s.emptyIconWrap}
              >
                <MessageSquare size={36} color={T.accent} strokeWidth={1.5} />
              </LinearGradient>
              <Text style={[s.emptyTitle, { color: T.text }]}>
                {lang === 'bn' ? 'কোনো মেসেজ নেই' : 'No messages yet'}
              </Text>
              <Text style={[s.emptySub, { color: T.sub }]}>
                {lang === 'bn'
                  ? 'কাস্টমার মেসেজ পাঠালে এখানে দেখাবে'
                  : 'Customer messages will appear here'}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', lineHeight: 22 },
  headerSub: { fontSize: 12, marginTop: 1 },
  headerBadge: {
    minWidth: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 7,
  },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '900' },

  searchWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, paddingHorizontal: 12, height: 42, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },

  divider: { height: StyleSheet.hairlineWidth },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 80, paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 20, opacity: 0.7 },
});
