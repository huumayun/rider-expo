import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ref, onValue, push, set, off, serverTimestamp, onDisconnect, update,
} from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { rtdb } from '../config/firebase';
import { RTDB_PATHS } from '../config/constants';

export interface ChatMessage {
  id: string;
  text: string;
  imageUrl?: string;
  senderRole: 'rider' | 'customer' | 'admin';
  senderId: string;
  timestamp: number;
  read?: boolean;
}

interface UseChatReturn {
  messages: ChatMessage[];
  customerTyping: boolean;
  sending: boolean;
  sendMessage: (text: string, imageUrl?: string) => Promise<void>;
  updateRiderTyping: (isTyping: boolean) => void;
}

export function useChat(orderId: string | null, riderId: string | null): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [customerTyping, setCustomerTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const CACHE_KEY = orderId ? `chat_cache_${orderId}` : null;

  // Load from cache on mount
  useEffect(() => {
    if (!CACHE_KEY) return;
    AsyncStorage.getItem(CACHE_KEY).then(raw => {
      if (raw) setMessages(JSON.parse(raw));
    }).catch(() => {});
  }, [CACHE_KEY]);

  // RTDB messages listener
  useEffect(() => {
    if (!orderId) return;
    const msgRef = ref(rtdb, RTDB_PATHS.chat(orderId));

    const unsub = onValue(msgRef, (snap) => {
      if (!snap.exists()) { setMessages([]); return; }
      const data = snap.val();
      const msgs: ChatMessage[] = Object.entries(data).map(([id, val]: any) => ({
        id,
        ...val,
      })).sort((a, b) => a.timestamp - b.timestamp);

      setMessages(msgs);
      // Persist cache
      if (CACHE_KEY) {
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(msgs.slice(-100))).catch(() => {});
      }

      // Mark as read logic
      const updates: any = {};
      msgs.forEach((m: any) => {
        if (m.senderRole === 'customer' && m.read === false) {
          updates[`${RTDB_PATHS.chat(orderId)}/${m.id}/read`] = true;
        }
      });
      if (Object.keys(updates).length > 0) {
        update(ref(rtdb), updates).catch(e => console.error('[useChat] update read error:', e));
      }
    });

    return () => off(msgRef, 'value', unsub as any);
  }, [orderId]);

  // Customer typing listener
  useEffect(() => {
    if (!orderId) return;
    const typingRefPath = ref(rtdb, RTDB_PATHS.typing(orderId, 'customer'));
    const unsub = onValue(typingRefPath, (snap) => {
      setCustomerTyping(!!snap.val());
    });
    return () => off(typingRefPath, 'value', unsub as any);
  }, [orderId]);

  const sendMessage = useCallback(async (text: string, imageUrl?: string) => {
    if (!orderId || !riderId || (!text.trim() && !imageUrl)) return;
    setSending(true);
    try {
      const msgRef = ref(rtdb, RTDB_PATHS.chat(orderId));
      await push(msgRef, {
        text: text.trim(),
        imageUrl: imageUrl || null,
        senderRole: 'rider',
        senderId: riderId,
        timestamp: Date.now(),
        read: false,
      });

      // Update Meta for Chat List
      const metaRef = ref(rtdb, RTDB_PATHS.chatMeta(orderId));
      await update(metaRef, {
        lastMessage: text.trim() || '📷 Photo',
        lastTimestamp: serverTimestamp(),
        lastSenderRole: 'rider'
      });

      // Clear rider typing
      updateRiderTyping(false);
    } catch (e) {
      console.error('[useChat] sendMessage error:', e);
    }
    setSending(false);
  }, [orderId, riderId]);

  const updateRiderTyping = useCallback((isTyping: boolean) => {
    if (!orderId || !riderId) return;
    const typingRef = ref(rtdb, RTDB_PATHS.riderTyping(orderId, riderId));
    set(typingRef, isTyping ? true : null).catch(() => {});

    // Auto-clear typing after 4s
    if (isTyping) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        set(typingRef, null).catch(() => {});
      }, 4000);
    }
  }, [orderId, riderId]);

  // Set up onDisconnect to clear typing
  useEffect(() => {
    if (!orderId || !riderId) return;
    const typingRefPath = ref(rtdb, RTDB_PATHS.typing(orderId, 'rider'));
    onDisconnect(typingRefPath).remove().catch(() => {});
    return () => {
      set(typingRefPath, null).catch(() => {});
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [orderId, riderId]);

  return { messages, customerTyping, sending, sendMessage, updateRiderTyping };
}
