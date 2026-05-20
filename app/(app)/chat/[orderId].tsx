import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '@/context/AppContext';
import { useAuthStore } from '@/store/authStore';
import { useChat } from '@/hooks/useChat';
import { useImageUpload } from '@/hooks/useImageUpload';

export default function ChatPage() {
  const { T, t, font } = useApp();
  const { rider } = useAuthStore();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const router = useRouter();

  const { messages, customerTyping, sendMessage, updateRiderTyping } = useChat(orderId || null, rider?.uid || null);
  const { pickAndUpload, uploading } = useImageUpload();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim()) return;
    await sendMessage(text);
    setText('');
  };

  const handleImageSend = async () => {
    if (!orderId) return;
    const url = await pickAndUpload(`chat/${orderId}/${Date.now()}.jpg`, { fromCamera: false });
    if (url) await sendMessage('', url);
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.senderRole === 'rider';
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
        <View style={[
          styles.msgBubble,
          isMe
            ? [styles.msgBubbleMe, { backgroundColor: '#22d47a' }]
            : [styles.msgBubbleThem, { backgroundColor: T.hi as any, borderColor: T.border as any }],
        ]}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.chatImage} />
          ) : (
            <Text style={[styles.msgText, { color: isMe ? '#fff' : T.text as any, fontFamily: font }]}>
              {item.text}
            </Text>
          )}
          <Text style={[styles.msgTime, { color: isMe ? 'rgba(255,255,255,0.7)' : T.sub as any }]}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: T.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: T.surface, borderBottomColor: T.border }]}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)')} style={styles.backBtn}>
          <Text style={{ color: T.text, fontSize: 18 }}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={[styles.headerTitle, { color: T.text, fontFamily: 'Nunito_700Bold' }]}>{t('chat_title')}</Text>
          {orderId && <Text style={[styles.headerSub, { color: T.sub, fontFamily: font }]}>Order #{orderId.slice(-6)}</Text>}
        </View>
        {customerTyping && (
          <View style={[styles.typingBadge, { backgroundColor: '#22d47a22' }]}>
            <Text style={[styles.typingText, { color: T.green as any, fontFamily: font }]}>⌛ {t('chat_typing')}</Text>
          </View>
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd()}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={[styles.emptyText, { color: T.sub, fontFamily: font }]}>No messages yet</Text>
            </View>
          }
        />

        {/* Input */}
        <View style={[styles.inputBar, { backgroundColor: T.surface, borderTopColor: T.border }]}>
          <TouchableOpacity onPress={handleImageSend} disabled={uploading} style={styles.attachBtn}>
            <Text style={styles.attachEmoji}>{uploading ? '⌛' : '📷'}</Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { color: T.text as any, backgroundColor: T.hi as any, fontFamily: font }]}
            value={text}
            onChangeText={(v) => { setText(v); updateRiderTyping(v.length > 0); }}
            placeholder={t('chat_placeholder')}
            placeholderTextColor={T.sub as any}
            multiline
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!text.trim()}
            style={[styles.sendBtn, { opacity: text.trim() ? 1 : 0.4 }]}
          >
            <Text style={styles.sendEmoji}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16 },
  headerSub: { fontSize: 12, marginTop: 1 },
  typingBadge: { marginLeft: 'auto', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  typingText: { fontSize: 11 },
  messageList: { padding: 12, paddingBottom: 8, flexGrow: 1 },
  msgRow: { marginBottom: 8, maxWidth: '80%' },
  msgRowMe: { alignSelf: 'flex-end' },
  msgRowThem: { alignSelf: 'flex-start' },
  msgBubble: { borderRadius: 16, padding: 10 },
  msgBubbleMe: { borderBottomRightRadius: 4 },
  msgBubbleThem: { borderWidth: 1, borderBottomLeftRadius: 4 },
  msgText: { fontSize: 14, lineHeight: 20 },
  msgTime: { fontSize: 10, marginTop: 4, textAlign: 'right' },
  chatImage: { width: 180, height: 180, borderRadius: 10 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: 14 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, gap: 8, borderTopWidth: 1 },
  attachBtn: { padding: 8 },
  attachEmoji: { fontSize: 22 },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 100, fontSize: 14 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#22d47a', alignItems: 'center', justifyContent: 'center' },
  sendEmoji: { color: '#fff', fontSize: 16 },
});
