import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, TextInput, Animated, Dimensions, PanResponder, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { db } from '../../config/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { X, CornerUpLeft, FileText } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ReturnOrderModal({ order, onClose, onComplete, visible }: any) {
  const { T, lang, theme, t, font } = useApp();
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('not_home');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const isDark = theme === 'dark';
  const surf = isDark ? '#1e293b' : '#ffffff';
  const surfHi = isDark ? '#334155' : '#f1f5f9';

  const reasons = [
    { id: 'not_home', label: lang === 'bn' ? 'কাস্টমার বাড়িতে নেই' : 'Customer not home', icon: '🏠' },
    { id: 'not_answering', label: lang === 'bn' ? 'ফোন ধরছেন না' : 'Not answering phone', icon: '📵' },
    { id: 'address_wrong', label: lang === 'bn' ? 'ঠিকানা খুঁজে পাচ্ছি না' : 'Address not found', icon: '📍' },
    { id: 'customer_refused', label: lang === 'bn' ? 'কাস্টমার অর্ডার নিতে অস্বীকার করেছেন' : 'Customer refused order', icon: '❌' },
  ];

  useEffect(() => {
    if (visible) {
      setNote('');
      setReason('not_home');
      setIsSubmitting(false);
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 50, friction: 7 }).start();
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
        if (gestureState.dy > 100 || gestureState.vy > 0.5) closeAnim();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      }
    })
  ).current;

  const handleSubmit = async () => {
    if (!note.trim()) return;
    setIsSubmitting(true);
    
    const selectedReasonObj = reasons.find(r => r.id === reason);
    const reasonText = selectedReasonObj ? selectedReasonObj.label : reason;

    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'returning_to_branch',
        returnReason: reasonText,
        returnReasonId: reason,
        returnNote: note.trim(),
        returnInitiatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setIsSubmitting(false);
      Animated.spring(translateY, { toValue: SCREEN_HEIGHT, useNativeDriver: true }).start(() => {
        onComplete();
      });
    } catch (e) {
      console.error('Return failed:', e);
      setIsSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeAnim}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <Animated.View style={{ width: '100%', backgroundColor: surf, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Math.max(24, insets.bottom + 12), transform: [{ translateY }] }}>
            
            <View {...panResponder.panHandlers} style={{ alignItems: 'center', paddingBottom: 16 }}>
              <View style={{ width: 44, height: 5, borderRadius: 99, backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(249,115,22,.12)', borderWidth: 1, borderColor: 'rgba(249,115,22,.25)', alignItems: 'center', justifyContent: 'center' }}>
                  <CornerUpLeft size={20} color="#f97316" strokeWidth={2.5} />
                </View>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: T.text, fontFamily: font }}>{t('return_modal_title') || 'Return Order'}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#f97316', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                    {lang === 'bn' ? `অর্ডার #${order?.id}` : `Order #${order?.id}`}
                  </Text>
                </View>
              </View>
              <Pressable onPress={closeAnim} style={{ width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: T.border, backgroundColor: surfHi, alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color={T.sub} />
              </Pressable>
            </View>

            <Text style={{ fontSize: 12, color: T.sub, marginBottom: 18, lineHeight: 18 }}>
              {t('return_modal_sub') || 'Please select a reason for returning this order and provide any additional details below.'}
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {reasons.map(r => {
                const isSelected = reason === r.id;
                return (
                  <Pressable key={r.id} onPress={() => setReason(r.id)} style={{ width: '48%', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 2, borderColor: isSelected ? '#f97316' : T.border, backgroundColor: isSelected ? 'rgba(249,115,22,.08)' : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 16 }}>{r.icon}</Text>
                    <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: isSelected ? '#f97316' : T.sub, lineHeight: 14 }}>{r.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ backgroundColor: surfHi, borderWidth: 1.5, borderColor: note.trim() ? '#f97316' : T.border, borderRadius: 16, padding: 14, marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <FileText size={13} color={T.sub} strokeWidth={2} />
                <Text style={{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, color: T.sub }}>
                  {t('return_note_label') || 'Additional Note'}
                </Text>
              </View>
              <TextInput
                value={note} onChangeText={setNote}
                placeholder={t('return_note_placeholder') || 'E.g., house is locked, nobody answering phone...'}
                placeholderTextColor={T.border}
                multiline
                style={{ width: '100%', height: 72, color: T.text, fontSize: 13, fontFamily: font, textAlignVertical: 'top' }}
              />
            </View>

            <Pressable onPress={handleSubmit} disabled={isSubmitting || !note.trim()} style={{ width: '100%', paddingVertical: 16, borderRadius: 18, backgroundColor: note.trim() ? '#f97316' : (isDark ? '#1e293b' : '#e2e8f0'), alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: isSubmitting ? 0.7 : 1 }}>
              <CornerUpLeft size={16} color={note.trim() ? '#fff' : T.sub} strokeWidth={2.5} />
              <Text style={{ color: note.trim() ? '#fff' : T.sub, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                {isSubmitting ? (lang === 'bn' ? 'আপডেট হচ্ছে...' : 'Updating...') : (t('return_submit_btn') || 'Return Order')}
              </Text>
            </Pressable>

          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
