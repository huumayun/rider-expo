import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, ScrollView, Image, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withSequence, 
  withTiming,
  FadeInRight,
  FadeOutLeft
} from 'react-native-reanimated';
import { ArrowLeft, Check, Camera, ShieldCheck } from 'lucide-react-native';
import { useApp } from '../../src/context/AppContext';
import { useAuthStore } from '../../src/store/authStore';
import { useImageUpload } from '../../src/hooks/useImageUpload';
import { db } from '../../src/config/firebase';
import {
  doc, updateDoc, serverTimestamp, addDoc, collection, getDoc,
} from 'firebase/firestore';

type Step = 'cash' | 'photo' | 'otp' | 'done';

const SkeletonPhoto = React.memo(({ T }: { T: any }) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 800 }),
        withTiming(0.3, { duration: 800 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value
  }));

  return (
    <Reanimated.View style={[{ flex: 1, backgroundColor: T.border, justifyContent: 'center', alignItems: 'center', gap: 10 }, animatedStyle]}>
      <ActivityIndicator color={T.accent} size="large" />
      <Text style={{ fontSize: 11, fontWeight: '700', color: T.sub, letterSpacing: 0.5 }}>UPLOADING PROOF...</Text>
    </Reanimated.View>
  );
});

export default function DeliveryConfirmation() {
  const { T, t, font } = useApp();
  const { rider } = useAuthStore();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { pickAndUpload, uploading } = useImageUpload();

  const [step, setStep] = useState<Step>('cash');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const otpRefs = useRef<TextInput[]>([]);

  const [order, setOrder] = useState<any>(null);

  // Load order once
  useEffect(() => {
    if (!orderId) return;
    getDoc(doc(db, 'orders', orderId)).then(snap => {
      if (snap.exists()) setOrder({ id: snap.id, ...snap.data() });
    });
  }, [orderId]);

  const handleCashConfirm = () => setStep('photo');

  const handlePhotoCapture = async () => {
    const url = await pickAndUpload(`orders/${orderId}/delivery_proof.jpg`, { fromCamera: true });
    if (url) { setPhotoUrl(url); }
  };

  const handlePhotoNext = () => {
    if (!photoUrl) { Alert.alert('Photo Required', 'Please take a delivery proof photo.'); return; }
    setStep('otp');
  };

  const handleOtpChange = (val: string, idx: number) => {
    const newOtp = [...otp];
    newOtp[idx] = val;
    setOtp(newOtp);
    if (val && idx < 3) otpRefs.current[idx + 1]?.focus();
  };

  const handleComplete = async () => {
    const enteredOtp = otp.join('');
    if (enteredOtp.length < 4) { Alert.alert('OTP Required', 'Enter the 4-digit OTP'); return; }
    if (String(order?.otp) !== enteredOtp) {
      Alert.alert('Wrong OTP', t('dc_err_wrong_otp'));
      setOtp(['', '', '', '']);
      otpRefs.current[0]?.focus();
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'orders', orderId!), {
        status: 'delivered',
        deliveredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deliveryProofUrl: photoUrl,
      });
      // Add cash transaction if COD
      if (order?.paymentMethod === 'COD' && rider?.uid) {
        await addDoc(collection(db, 'transactions'), {
          riderId: rider.uid,
          type: 'cash_collection',
          amount: order.totalAmount || 0,
          orderSeq: order.orderSeq,
          orderId: orderId,
          createdAt: serverTimestamp(),
        });
      }
      setStep('done');
    } catch (e) {
      Alert.alert('Error', t('dc_err_upload'));
    }
    setLoading(false);
  };

  // ─── Render steps ────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: T.bg }]}>
        <Reanimated.View 
          entering={FadeInRight.duration(500)}
          style={styles.doneScreen}
        >
          <View style={[styles.doneEmojiContainer, { backgroundColor: `${T.green}18` }]}>
            <ShieldCheck size={72} color={T.green} strokeWidth={2.5} />
          </View>
          <Text style={[styles.doneTitle, { color: T.text, fontFamily: 'Nunito_800ExtraBold' }]}>{t('dc_delivered')}</Text>
          <Text style={[styles.doneSub, { color: T.sub, fontFamily: font }]}>{t('dc_great_job')}</Text>
          <TouchableOpacity
            onPress={() => router.replace('/(app)')}
            style={styles.doneBtn}
          >
            <LinearGradient colors={['#22d47a', '#16a85a']} style={styles.doneBtnGrad}>
              <Text style={[styles.doneBtnText, { fontFamily: font }]}>{t('flow_delivered')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Reanimated.View>
      </SafeAreaView>
    );
  }

  const currentStepIndex = step === 'cash' ? 0 : step === 'photo' ? 1 : 2;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: T.bg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)')} 
            style={[styles.backBtn, { backgroundColor: T.hi, borderColor: T.border }]}
          >
            <ArrowLeft size={18} color={T.text} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: T.text, fontFamily: 'Nunito_700Bold' }]}>
            {t('dc_confirm_for')} #{order?.orderSeq || orderId?.slice(-6).toUpperCase()}
          </Text>
        </View>

        {/* Step indicator */}
        <View style={styles.stepRow}>
          {(['cash', 'photo', 'otp'] as Step[]).map((s, i) => {
            const isActive = step === s;
            const isCompleted = i < currentStepIndex;
            return (
              <React.Fragment key={s}>
                <View style={[
                  styles.stepCircle, 
                  isActive ? { backgroundColor: T.accent, transform: [{ scale: 1.15 }] } : (isCompleted ? { backgroundColor: '#22d47a' } : { backgroundColor: T.hi }),
                  { borderWidth: 2, borderColor: isActive ? T.accent : (isCompleted ? '#22d47a' : T.border) }
                ]}>
                  {isCompleted ? (
                    <Check size={12} color="#fff" strokeWidth={3} />
                  ) : (
                    <Text style={[styles.stepNum, { color: isActive ? '#fff' : T.sub }]}>{i + 1}</Text>
                  )}
                </View>
                {i < 2 && (
                  <View style={[
                    styles.stepConnector, 
                    { backgroundColor: i < currentStepIndex ? '#22d47a' : T.border }
                  ]} />
                )}
              </React.Fragment>
            );
          })}
        </View>

        {/* ── Step: Cash ── */}
        {step === 'cash' && (
          <Reanimated.View 
            entering={FadeInRight.duration(400)}
            exiting={FadeOutLeft.duration(300)}
            style={styles.stepCard}
          >
            {order?.paymentMethod === 'COD' ? (
              <>
                <View style={[styles.stepIconWrapper, { backgroundColor: 'rgba(34,212,122,0.12)' }]}>
                  <Text style={styles.stepIcon}>💵</Text>
                </View>
                <Text style={[styles.stepTitle, { color: T.text, fontFamily: 'Nunito_700Bold' }]}>{t('dc_collect')}</Text>
                <Text style={[styles.stepSub, { color: T.sub, fontFamily: font }]}>{t('dc_cash_sub')}</Text>
                <View style={[styles.amountBox, { backgroundColor: 'rgba(34,212,122,0.1)', borderColor: 'rgba(34,212,122,0.2)' }]}>
                  <Text style={[styles.amountValue, { color: '#22d47a' }]}>৳{order.totalAmount}</Text>
                </View>
                <TouchableOpacity onPress={handleCashConfirm} style={styles.primaryBtn}>
                  <LinearGradient colors={['#22d47a', '#16a85a']} style={styles.primaryBtnGrad}>
                    <Text style={[styles.primaryBtnText, { fontFamily: font }]}>{t('dc_cash_btn')}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={[styles.stepIconWrapper, { backgroundColor: 'rgba(99,102,241,0.12)' }]}>
                  <Text style={styles.stepIcon}>💳</Text>
                </View>
                <Text style={[styles.stepTitle, { color: T.text, fontFamily: 'Nunito_700Bold' }]}>Pre-paid Order</Text>
                <Text style={[styles.stepSub, { color: T.sub, fontFamily: font }]}>No cash collection needed</Text>
                <TouchableOpacity onPress={handleCashConfirm} style={styles.primaryBtn}>
                  <LinearGradient colors={['#22d47a', '#16a85a']} style={styles.primaryBtnGrad}>
                    <Text style={[styles.primaryBtnText, { fontFamily: font }]}>{t('next')}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </Reanimated.View>
        )}

        {/* ── Step: Photo ── */}
        {step === 'photo' && (
          <Reanimated.View 
            entering={FadeInRight.duration(400)}
            exiting={FadeOutLeft.duration(300)}
            style={styles.stepCard}
          >
            <View style={[styles.stepIconWrapper, { backgroundColor: 'rgba(249,115,22,0.12)' }]}>
              <Camera size={34} color={T.accent} strokeWidth={2} />
            </View>
            <Text style={[styles.stepTitle, { color: T.text, fontFamily: 'Nunito_700Bold' }]}>{t('dc_photo_sub')}</Text>
            <Text style={[styles.stepSub, { color: T.sub, fontFamily: font }]}>{t('dc_photo_tap')}</Text>
            <TouchableOpacity onPress={handlePhotoCapture} style={[styles.photoArea, { borderColor: T.border }]} disabled={uploading}>
              {uploading ? (
                <SkeletonPhoto T={T} />
              ) : photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.photoPreview} />
              ) : (
                <View style={[styles.photoPlaceholder, { backgroundColor: T.hi, borderColor: T.border }]}>
                  <Camera size={38} color={T.sub} strokeWidth={1.5} />
                  <Text style={[styles.photoPlaceholderText, { color: T.sub, fontFamily: font }]}>{t('dc_photo_tap')}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePhotoNext} style={styles.primaryBtn} disabled={uploading}>
              <LinearGradient colors={['#22d47a', '#16a85a']} style={styles.primaryBtnGrad}>
                <Text style={[styles.primaryBtnText, { fontFamily: font }]}>{t('dc_next')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Reanimated.View>
        )}

        {/* ── Step: OTP ── */}
        {step === 'otp' && (
          <Reanimated.View 
            entering={FadeInRight.duration(400)}
            exiting={FadeOutLeft.duration(300)}
            style={styles.stepCard}
          >
            <View style={[styles.stepIconWrapper, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
              <Text style={styles.stepIcon}>🔐</Text>
            </View>
            <Text style={[styles.stepTitle, { color: T.text, fontFamily: 'Nunito_700Bold' }]}>{t('verify_otp')}</Text>
            <Text style={[styles.stepSub, { color: T.sub, fontFamily: font }]}>Ask the customer for the 4-digit OTP</Text>
            <View style={styles.otpRow}>
              {otp.map((digit, idx) => (
                <TextInput
                  key={idx}
                  ref={r => { if (r) otpRefs.current[idx] = r; }}
                  style={[
                    styles.otpInput, 
                    { 
                      color: T.text, 
                      borderColor: focusedIdx === idx ? T.accent : (digit ? '#22d47a' : T.border), 
                      backgroundColor: T.hi,
                      borderWidth: focusedIdx === idx ? 2.5 : 2
                    }
                  ]}
                  value={digit}
                  onFocus={() => setFocusedIdx(idx)}
                  onBlur={() => setFocusedIdx(null)}
                  onChangeText={val => handleOtpChange(val.slice(-1), idx)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                />
              ))}
            </View>
            <TouchableOpacity onPress={handleComplete} disabled={loading} style={styles.primaryBtn}>
              <LinearGradient colors={['#22d47a', '#16a85a']} style={styles.primaryBtnGrad}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.primaryBtnText, { fontFamily: font }]}>{t('dc_verify')}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Reanimated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 28 },
  backBtn: { 
    width: 42, 
    height: 42, 
    borderRadius: 14, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1 
  },
  headerTitle: { fontSize: 18 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 36, paddingHorizontal: 20 },
  stepCircle: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  stepNum: { fontWeight: '800', fontSize: 13 },
  stepConnector: { flex: 1, height: 3, marginHorizontal: 8, borderRadius: 2 },
  stepCard: { alignItems: 'center', gap: 16, width: '100%' },
  stepIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  stepIcon: { fontSize: 36 },
  stepTitle: { fontSize: 22 },
  stepSub: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  amountBox: { borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 40, paddingVertical: 18, marginVertical: 10 },
  amountValue: { fontSize: 38, fontFamily: 'Nunito_800ExtraBold' },
  primaryBtn: { width: '100%', borderRadius: 16, overflow: 'hidden', marginTop: 14, shadowColor: '#16a85a', shadowOpacity: 0.15, shadowRadius: 10, elevation: 4 },
  primaryBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  photoArea: { width: '100%', aspectRatio: 4 / 3, borderRadius: 22, overflow: 'hidden', borderWidth: 1.5, borderStyle: 'dashed' },
  photoPreview: { width: '100%', height: '100%' },
  photoPlaceholder: {
    flex: 1, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  photoPlaceholderText: { fontSize: 13, fontWeight: '700' },
  otpRow: { flexDirection: 'row', gap: 14, marginVertical: 20 },
  otpInput: {
    width: 60, height: 72, borderRadius: 16,
    fontSize: 30, fontFamily: 'Nunito_800ExtraBold',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
  },
  doneScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32, height: Dimensions.get('window').height - 180 },
  doneEmojiContainer: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  doneTitle: { fontSize: 30, textAlign: 'center' },
  doneSub: { fontSize: 16, textAlign: 'center', lineHeight: 22, paddingHorizontal: 16 },
  doneBtn: { width: '100%', borderRadius: 16, overflow: 'hidden', marginTop: 20, shadowColor: '#16a85a', shadowOpacity: 0.2, shadowRadius: 12, elevation: 5 },
  doneBtnGrad: { paddingVertical: 18, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontWeight: '800', fontSize: 18, letterSpacing: 0.5 },
});
