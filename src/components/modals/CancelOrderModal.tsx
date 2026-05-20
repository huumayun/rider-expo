import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, TextInput, Animated, Dimensions, PanResponder, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { db } from '../../config/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { X, AlertTriangle, FileText, ChevronRight } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function CancelOrderModal({ order, onClose, onComplete, visible }: any) {
  const { T, lang, theme, font } = useApp();
  const [reason, setReason] = useState('cancelled'); // 'cancelled', 'rescheduled', 'skipped'
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const isDark = theme === 'dark';
  const surf = isDark ? '#1e293b' : '#ffffff';
  const surfHi = isDark ? '#334155' : '#f1f5f9';

  const reasons = [
    { id: 'cancelled', label: lang === 'bn' ? 'অর্ডার বাতিল' : 'Cancel Order' },
    { id: 'rescheduled', label: lang === 'bn' ? 'সময় পরিবর্তন (Reschedule)' : 'Reschedule' },
    { id: 'skipped', label: lang === 'bn' ? 'এখন নিবে না (Skip)' : "Skip / Won't take" }
  ];

  useEffect(() => {
    if (visible) {
      setReason('cancelled');
      setNote('');
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
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: reason,
        cancellationReason: reason,
        cancellationNote: note,
        updatedAt: serverTimestamp()
      });
      setIsSubmitting(false);
      Animated.spring(translateY, { toValue: SCREEN_HEIGHT, useNativeDriver: true }).start(() => {
        onComplete();
      });
    } catch (e) {
      console.error("Cancel Failed:", e);
      setIsSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeAnim}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <Animated.View style={{ width: '100%', backgroundColor: surf, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, transform: [{ translateY }] }}>
            
            <View {...panResponder.panHandlers} style={{ alignItems: 'center', paddingBottom: 16 }}>
              <View style={{ width: 44, height: 5, borderRadius: 99, backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,77,109,.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={20} color="#ff4d6d" strokeWidth={2} />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '800', color: T.text, fontFamily: font }}>
                  {lang === 'bn' ? 'অর্ডার সম্পন্ন হয়নি?' : 'Order Failed?'}
                </Text>
              </View>
              <Pressable onPress={closeAnim} style={{ width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: T.border, backgroundColor: surfHi, alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color={T.text} />
              </Pressable>
            </View>

            <Text style={{ fontSize: 13, color: T.sub, marginBottom: 16, lineHeight: 18 }}>
              {lang === 'bn' ? 'কেন কাস্টমার অর্ডারটি নিচ্ছেন না তা সিলেক্ট করে নোট লিখুন।' : 'Select the reason and write a note why the customer is not taking the order.'}
            </Text>

            <View style={{ gap: 10, marginBottom: 20 }}>
              {reasons.map(r => (
                <Pressable key={r.id} onPress={() => setReason(r.id)}
                  style={{ width: '100%', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, borderWidth: 2, borderColor: reason === r.id ? T.accent : T.border, backgroundColor: reason === r.id ? `${T.accent}10` : 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: reason === r.id ? T.accent : T.text }}>{r.label}</Text>
                  {reason === r.id && <ChevronRight size={18} color={T.accent} strokeWidth={3} />}
                </Pressable>
              ))}
            </View>

            <View style={{ backgroundColor: surfHi, borderWidth: 1, borderColor: T.border, borderRadius: 16, padding: 14, marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <FileText size={14} color={T.sub} />
                <Text style={{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, color: T.sub }}>
                  {lang === 'bn' ? 'কারণ লিখুন (বাধ্যতামূলক)' : 'Reason Note (Required)'}
                </Text>
              </View>
              <TextInput
                value={note} onChangeText={setNote}
                placeholder={lang === 'bn' ? "কাস্টমার কেন অর্ডারটি নিলেন না বিস্তারিত লিখুন..." : "Explain why the customer refused..."}
                placeholderTextColor={T.sub}
                multiline
                style={{ width: '100%', height: 80, color: T.text, fontSize: 14, textAlignVertical: 'top', fontFamily: font }}
              />
            </View>

            <Pressable onPress={handleSubmit} disabled={isSubmitting || !note.trim()} style={{ width: '100%', paddingVertical: 18, borderRadius: 18, backgroundColor: note.trim() ? '#ff4d6d' : T.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: isSubmitting ? 0.7 : 1 }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                {isSubmitting ? (lang === 'bn' ? 'আপডেট হচ্ছে...' : 'Updating...') : (lang === 'bn' ? 'সাবমিট করুন' : 'Submit & Continue')}
              </Text>
            </Pressable>

          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
