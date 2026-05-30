import React, { memo, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CheckCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { format, isToday, isYesterday } from 'date-fns';
import { bn, enUS } from 'date-fns/locale';

export interface ChatMsgInfo {
  text: string;
  time: number;
  unread: number;
  lastSenderRole: string;
}

interface ChatListRowProps {
  order: any;
  info: ChatMsgInfo;
  onPress: (id: string, phone?: string, name?: string) => void;
  T: any;
  isDark: boolean;
  lang: string;
}

// ─── Avatar gradient palette ──────────────────────────────────────────────────
const GRADS: [string, string][] = [
  ['#6366f1', '#8b5cf6'],
  ['#f59e0b', '#f97316'],
  ['#22d47a', '#06b6d4'],
  ['#f43f5e', '#ec4899'],
  ['#0ea5e9', '#3b82f6'],
  ['#a855f7', '#8b5cf6'],
  ['#10b981', '#14b8a6'],
];

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % GRADS.length;
}

function fmtTime(ts: number, lang: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  const loc = lang === 'bn' ? bn : enUS;
  
  if (isToday(d)) {
    return format(d, 'hh:mm a', { locale: loc });
  }
  
  if (isYesterday(d)) {
    return (lang === 'bn' ? 'গতকাল, ' : 'Yesterday, ') + format(d, 'hh:mm a', { locale: loc });
  }
  
  return format(d, 'MMM d, hh:mm a', { locale: loc });
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
const Avatar = memo(({ name, orderId, hasUnread, rowBg }: { name: string; orderId: string; hasUnread: boolean; rowBg: string }) => {
  const [c1, c2] = GRADS[hashStr(orderId)];
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <View style={s.avatarWrap}>
      <LinearGradient colors={[c1, c2]} style={s.avatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={s.avatarLetter}>{initial}</Text>
      </LinearGradient>
      {hasUnread && <View style={[s.activeDot, { borderColor: rowBg }]} />}
    </View>
  );
});

// ─── Chat List Row ────────────────────────────────────────────────────────────
export const ChatListRow = memo(({ order, info, onPress, T, isDark, lang }: ChatListRowProps) => {
  const hasUnread = info.unread > 0;
  const isMyMsg = info.lastSenderRole === 'rider';

  const name = useMemo(() => {
    const raw = (order.customer?.name ?? 'Customer').trim();
    return raw.includes(' - ') ? raw.split(' - ')[0].trim() : raw;
  }, [order.customer?.name]);

  let orderTag = '';
  if (order.id) {
    if (order.id.startsWith('GB-')) {
      orderTag = order.id; // Full order ID fits perfectly: GB-2026-036
    } else {
      const parts = order.id.split('-');
      orderTag = `#${parts[parts.length - 1]}`; // Fallback to last segment if it's a long auto ID
    }
  } else {
    orderTag = `#${order.seq ?? 'N/A'}`;
  }

  const rowBg = isDark ? '#0f172a' : '#ffffff';
  const pressedBg = isDark ? '#1e293b' : '#f8fafc';

  return (
    <Pressable onPress={() => onPress(order.id, order.customer?.phone, name)}>
      {({ pressed }) => (
        <View style={[s.container, { backgroundColor: pressed ? pressedBg : rowBg }]}>
          <Avatar name={name} orderId={order.id} hasUnread={hasUnread} rowBg={rowBg} />

          <View style={s.content}>
            {/* Line 1: Order Tag + Time */}
            <View style={s.topLine}>
              <View style={[s.tagBadge, { 
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
                borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#bfdbfe',
              }]}>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[s.tagText, { color: isDark ? '#60a5fa' : '#2563eb' }]}>{orderTag}</Text>
              </View>
              <Text style={[s.timeText, { color: hasUnread ? T.accent : T.sub }]}>
                {fmtTime(info.time, lang)}
              </Text>
            </View>

            {/* Line 2: Name */}
            <Text numberOfLines={1} style={[s.nameText, { color: T.text, fontWeight: hasUnread ? '800' : '600', marginBottom: 2 }]}>
              {name}
            </Text>

            {/* Line 3: Message preview + Unread badge */}
            <View style={s.bottomLine}>
              <View style={s.msgPreviewWrap}>
                {isMyMsg && (
                  <CheckCheck size={14} color={T.sub} strokeWidth={2.5} style={{ marginRight: 4, flexShrink: 0 }} />
                )}
                <Text numberOfLines={1} style={[s.previewText, {
                  color: hasUnread ? (isDark ? '#e2e8f0' : '#1e293b') : T.sub,
                  fontWeight: hasUnread ? '700' : '400',
                }]}>
                  {info.text || (lang === 'bn' ? 'মেসেজ লিখুন...' : 'Send a message...')}
                </Text>
              </View>
              {hasUnread && (
                <View style={s.unreadBadge}>
                  <Text style={s.unreadText}>{info.unread > 99 ? '99+' : info.unread}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );
});

const s = StyleSheet.create({
  container: {
    flexDirection: 'row', // Explicit flex-row
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    width: '100%',
  },
  
  // Avatar
  avatarWrap: {
    marginRight: 14, // spacing between avatar and content
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 21,
    fontWeight: '900',
  },
  activeDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22d47a',
    borderWidth: 2.5,
  },

  // Content
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  
  // Line 1
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4, // space between name and message
  },
  nameText: {
    fontSize: 16,
    flexShrink: 1, // allows text to truncate
  },
  tagBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    flexShrink: 0,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 0,
  },

  // Line 2
  bottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  msgPreviewWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  previewText: {
    fontSize: 14,
    flexShrink: 1,
  },
  unreadBadge: {
    backgroundColor: '#22d47a',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
});
