import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, TextInput, StyleSheet, Dimensions, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, rtdb } from '@/config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { Search, ChevronLeft, User, MessageSquare } from 'lucide-react-native';
import { useAuthStore } from '@/store/authStore';
import { useApp } from '@/context/AppContext';
import { RTDB_PATHS } from '@/config/constants';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

/* ── ChatRow ── */
const ChatRow = ({ order, onClick, onLatestMessageUpdate, onMessagePresence, T, isDark, lang, font }: any) => {
  const [lastMessage, setLastMessage] = useState({ text: '', time: 0, unread: 0 });
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (!order.id) return;
    const chatRef = ref(rtdb, RTDB_PATHS.chat(order.id));

    const unsub = onValue(chatRef, (snap) => {
      if (snap.exists()) {
        const msgs: any[] = Object.values(snap.val());
        if (msgs.length > 0) {
          const sorted = msgs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          const latest = sorted[0];
          const unread = msgs.filter(m => m.senderRole === 'customer' && !m.read).length;

          setLastMessage({
            text: latest.text || (latest.image ? (lang === 'bn' ? '📷 ছবি' : '📷 Image') : ''),
            time: latest.timestamp || 0,
            unread
          });

          onMessagePresence(order.id, true);
          onLatestMessageUpdate(order.id, latest.timestamp || 0);
        } else {
          onMessagePresence(order.id, false);
        }
      } else {
        onMessagePresence(order.id, false);
      }
    });
    return () => unsub();
  }, [order.id, lang]);

  const fmt = (ts: number) => {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const displayName = useMemo(() => {
    const raw = order.customer?.name || 'Customer';
    if (raw.includes(' - ')) return raw.split(' - ')[0];
    return raw;
  }, [order.customer?.name]);

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <Pressable
        onPress={() => onClick(order)}
        style={({ pressed }) => [
          styles.chatRow,
          {
            backgroundColor: pressed ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)') : 'transparent',
          }
        ]}
      >
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
            <User size={28} color={isDark ? '#94a3b8' : '#64748b'} strokeWidth={1.5} />
          </View>
          {lastMessage.unread > 0 && (
            <View style={styles.onlineIndicator} />
          )}
        </View>

        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={[styles.name, { color: T.text, fontFamily: font }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[styles.time, { color: T.sub, fontFamily: font }]}>
              {fmt(lastMessage.time)}
            </Text>
          </View>

          <View style={styles.chatFooter}>
            <Text style={[
              styles.lastMsg,
              {
                color: lastMessage.unread > 0 ? (isDark ? '#fff' : '#000') : T.sub,
                fontWeight: lastMessage.unread > 0 ? '700' : '400',
                fontFamily: font
              }
            ]} numberOfLines={1}>
              {lastMessage.text || (lang === 'bn' ? 'কোনো মেসেজ নেই' : 'No messages yet')}
            </Text>

            {lastMessage.unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{lastMessage.unread}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

export default function ChatListPage() {
  const router = useRouter();
  const { T, t, theme, lang, font } = useApp();
  const { rider } = useAuthStore();
  const isDark = theme === 'dark';

  const [searchTerm, setSearchTerm] = useState('');
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastMessageTimes, setLastMessageTimes] = useState<Record<string, number>>({});
  const [hasMessages, setHasMessages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!rider?.uid) return;
    const q = query(collection(db, 'orders'), where('riderId', '==', rider.uid), where('status', 'in', ['assigned', 'accepted', 'arrived_at_branch', 'picked', 'out_for_delivery', 'arrived_at_customer', 'returning_to_branch']));

    const unsub = onSnapshot(q, snap => {
      setActiveOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [rider?.uid]);

  const handleMessagePresence = (orderId: string, exists: boolean) => {
    setHasMessages(prev => {
      if (prev[orderId] === exists) return prev;
      return { ...prev, [orderId]: exists };
    });
  };

  const sortedAndFiltered = useMemo(() => {
    return activeOrders
      .filter(o => {
        const nameMatch = (o.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          o.id.toLowerCase().includes(searchTerm.toLowerCase());
        const messageExists = hasMessages[o.id] === true;
        return nameMatch && messageExists;
      })
      .sort((a, b) => (lastMessageTimes[b.id] || 0) - (lastMessageTimes[a.id] || 0));
  }, [activeOrders, searchTerm, lastMessageTimes, hasMessages]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#020617' : '#f8f9fa' }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={28} color={T.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: T.text, fontFamily: 'Nunito_800ExtraBold' }]}>
          {lang === 'bn' ? 'মেসেজ' : 'messages'}
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBox, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0' }]}>
          <Search size={20} color="#94a3b8" style={{ marginRight: 10 }} />
          <TextInput
            style={[styles.searchInput, { color: T.text, fontFamily: font }]}
            placeholder={lang === 'bn' ? 'সার্চ চ্যাট...' : 'search_chats'}
            placeholderTextColor="#94a3b8"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>
      </View>

      {/* Chat List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#22d47a" />
          </View>
        ) : sortedAndFiltered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
              <MessageSquare size={40} color={isDark ? '#94a3b8' : '#64748b'} strokeWidth={1.5} />
            </View>
            <Text style={[styles.emptyText, { color: T.sub, fontFamily: font }]}>
              {lang === 'bn' ? 'কোনো মেসেজ পাওয়া যায়নি' : 'No messages found'}
            </Text>
          </View>
        ) : (
          sortedAndFiltered.map((order) => (
            <ChatRow
              key={order.id}
              order={order}
              onClick={(o: any) => router.push({ pathname: '/(app)/chat/[orderId]', params: { orderId: o.id } })}
              onLatestMessageUpdate={(id: string, ts: number) => setLastMessageTimes(p => ({ ...p, [id]: ts }))}
              onMessagePresence={handleMessagePresence}
              T={T}
              isDark={isDark}
              lang={lang}
              font={font}
            />
          ))
        )}

        {/* Hidden background listeners */}
        {activeOrders.map(o => !hasMessages[o.id] && (
          <View key={`hidden-${o.id}`} style={{ height: 0, opacity: 0 }}>
            <ChatRow
              order={o}
              onClick={() => { }}
              onLatestMessageUpdate={() => { }}
              onMessagePresence={handleMessagePresence}
              T={T}
            />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backBtn: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 24,
    textTransform: 'lowercase',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 15,
    paddingHorizontal: 15,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  listContent: {
    paddingBottom: 40,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 3,
    borderColor: '#020617', // Match dark bg
  },
  chatInfo: {
    flex: 1,
    marginLeft: 15,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
  },
  time: {
    fontSize: 12,
    opacity: 0.6,
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMsg: {
    fontSize: 14,
    flex: 1,
    marginRight: 10,
  },
  unreadBadge: {
    backgroundColor: '#22c55e',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  center: {
    paddingVertical: 100,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.5,
  },
});
