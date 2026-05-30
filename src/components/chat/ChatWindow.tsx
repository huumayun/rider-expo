import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Animated, Dimensions, PanResponder, Modal, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Linking, Keyboard } from 'react-native';
import { Send, Image as ImageIcon, X, Phone } from 'lucide-react-native';
import { useChat } from '../../hooks/useChat';
import { useAuthStore } from '../../store/authStore';
import { useImageUpload } from '../../hooks/useImageUpload';
import { ROLES } from './chatConfig';
import { useApp } from '../../context/AppContext';
import ChatMessage from './ChatMessage';
import TypingIndicator from './TypingIndicator';
import * as ImagePicker from 'expo-image-picker';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ChatWindow({ order, onClose, visible }: any) {
  const { T, t, theme, font, lang } = useApp();
  const isDark = theme === 'dark';
  const surf = isDark ? '#0e0e1c' : '#ffffff';
  const surfHi = isDark ? '#141428' : '#f4f4f9';

  const [input, setInput] = useState('');
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  const { rider } = useAuthStore();
  const { messages, sendMessage, customerTyping, updateRiderTyping } = useChat(order?.id, rider?.uid || null);
  const { pickAndUpload, uploading } = useImageUpload();

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }).start();
    } else {
      translateY.setValue(SCREEN_HEIGHT);
    }
  }, [visible]);

  const closeAnim = () => {
    Animated.spring(translateY, { toValue: SCREEN_HEIGHT, useNativeDriver: true, tension: 50 }).start(() => {
      onClose();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) translateY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 150 || gestureState.vy > 0.5) closeAnim();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      }
    })
  ).current;

  useEffect(() => {
    if (messages?.length > 0) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, customerTyping]);

  const handleSend = async (forcedText?: string) => {
    const textToSend = forcedText || input.trim();
    if (!textToSend && !uploading) return;
    setInput('');
    updateRiderTyping(false);
    await sendMessage(textToSend);
  };

  const handleInputChange = (text: string) => {
    setInput(text);
    updateRiderTyping(text.length > 0);
  };

  const pickImage = async () => {
    const storagePath = `chats/${order?.id}/${Date.now()}.jpg`;
    const url = await pickAndUpload(storagePath);
    if (url) {
      await sendMessage('', url);
    }
  };

  const handleCall = () => {
    const num = order?.customer?.phone || order?.customer?.mobile || order?.customer?.address?.phone;
    if (num) Linking.openURL(`tel:${num}`);
    else alert('নম্বর পাওয়া যায়নি');
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeAnim}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={{ flex: 1, backgroundColor: T.bg, transform: [{ translateY }] }}>
          
          {/* Header */}
          <View style={{ paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: surf, borderBottomWidth: 1, borderBottomColor: T.border, zIndex: 10 }}>
            <View {...panResponder.panHandlers} style={{ alignItems: 'center', marginBottom: 12, paddingVertical: 10, marginTop: -10 }}>
              <View style={{ width: 44, height: 5, borderRadius: 99, backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: surfHi, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: T.accent, fontFamily: font }}>{order?.customer?.name?.charAt(0) || 'C'}</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: T.text, fontFamily: font }}>{order?.customer?.name || t('chat_title')}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, color: T.accent, opacity: 0.8, fontFamily: font }}>{t('exec_order_label')} #{order?.id}</Text>
                    {customerTyping && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: T.green }} />
                        <Text style={{ fontSize: 9, fontWeight: '900', color: T.green, letterSpacing: 1, textTransform: 'uppercase', fontFamily: font }}>{t('chat_typing')}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={handleCall} style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: `${T.accent}15`, borderWidth: 1, borderColor: `${T.accent}30`, alignItems: 'center', justifyContent: 'center' }}>
                  <Phone size={19} color={T.accent} strokeWidth={2.5} />
                </Pressable>
                <Pressable onPress={closeAnim} style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: surfHi, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
                  <X size={20} color={T.sub} strokeWidth={2.5} />
                </Pressable>
              </View>
            </View>
          </View>

          {/* Messages */}
          <ScrollView 
            ref={scrollViewRef} 
            style={{ flex: 1, backgroundColor: T.bg }} 
            contentContainerStyle={{ paddingVertical: 16 }}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
            onLayout={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.map((msg: any) => (
              <ChatMessage key={msg.id} message={msg} isOwn={msg.senderRole === ROLES.RIDER} />
            ))}
            {customerTyping && <TypingIndicator />}
          </ScrollView>

          {/* Input Area */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 30 : 16, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', backgroundColor: surfHi, borderRadius: 24, padding: 6, paddingLeft: 10, borderWidth: 1.5, borderColor: input.trim() ? `${T.accent}40` : T.border }}>
              
              <Pressable onPress={pickImage} disabled={uploading} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}>
                {uploading ? (
                  <ActivityIndicator color={T.accent} size="small" />
                ) : (
                  <ImageIcon size={21} color={T.sub} strokeWidth={2} />
                )}
              </Pressable>

              <TextInput
                value={input}
                onChangeText={handleInputChange}
                placeholder={t('chat_placeholder')}
                placeholderTextColor={T.sub as string}
                multiline
                style={{ flex: 1, color: T.text, fontSize: 15, paddingVertical: 10, paddingHorizontal: 4, maxHeight: 120, fontFamily: font }}
              />

              <Pressable onPress={() => handleSend()} disabled={(!input.trim() && !uploading) || uploading} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: input.trim() ? T.accent : T.border, alignItems: 'center', justifyContent: 'center', marginBottom: 1, opacity: input.trim() ? 1 : 0.6 }}>
                <Send size={18} color={input.trim() ? '#fff' : T.sub} strokeWidth={2.5} />
              </Pressable>

            </View>
          </View>

        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
