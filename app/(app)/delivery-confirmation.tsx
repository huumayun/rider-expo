import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, ScrollView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../src/context/AppContext';
import { useAuthStore } from '../../src/store/authStore';
import { useImageUpload } from '../../src/hooks/useImageUpload';
import { db } from '../../src/config/firebase';
import {
  doc, updateDoc, serverTimestamp, addDoc, collection, getDoc,
} from 'firebase/firestore';

type Step = 'cash' | 'photo' | 'otp' | 'done';

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
  const otpRefs = useRef<TextInput[]>([]);

  const [order, setOrder] = useState<any>(null);

  // Load order once
  React.useEffect(() => {
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
        <View style={styles.doneScreen}>
          <Text style={styles.doneEmoji}>🎉</Text>
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
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: T.bg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)')} style={[styles.backBtn, { backgroundColor: T.surface }]}>
            <Text style={{ color: T.text }}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: T.text, fontFamily: 'Nunito_700Bold' }]}>
            {t('dc_confirm_for')} #{order?.orderSeq || orderId?.slice(-6)}
          </Text>
        </View>

        {/* Step indicator */}
        <View style={styles.stepRow}>
          {(['cash', 'photo', 'otp'] as Step[]).map((s, i) => (
            <React.Fragment key={s}>
              <View style={[styles.stepCircle, step === s || (['photo', 'otp'].includes(step) && i === 0) || (step === 'otp' && i === 1)
                ? styles.stepCircleActive : { backgroundColor: T.hi as any }]}>
                <Text style={styles.stepNum}>{i + 1}</Text>
              </View>
              {i < 2 && <View style={[styles.stepConnector, { backgroundColor: T.border as any }]} />}
            </React.Fragment>
          ))}
        </View>

        {/* ── Step: Cash ── */}
        {step === 'cash' && (
          <View style={styles.stepCard}>
            {order?.paymentMethod === 'COD' ? (
              <>
                <Text style={styles.stepIcon}>💵</Text>
                <Text style={[styles.stepTitle, { color: T.text, fontFamily: 'Nunito_700Bold' }]}>{t('dc_collect')}</Text>
                <Text style={[styles.stepSub, { color: T.sub, fontFamily: font }]}>{t('dc_cash_sub')}</Text>
                <View style={[styles.amountBox, { backgroundColor: '#22d47a22', borderColor: '#22d47a44' }]}>
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
                <Text style={styles.stepIcon}>✅</Text>
                <Text style={[styles.stepTitle, { color: T.text, fontFamily: 'Nunito_700Bold' }]}>Pre-paid Order</Text>
                <Text style={[styles.stepSub, { color: T.sub, fontFamily: font }]}>No cash collection needed</Text>
                <TouchableOpacity onPress={handleCashConfirm} style={styles.primaryBtn}>
                  <LinearGradient colors={['#22d47a', '#16a85a']} style={styles.primaryBtnGrad}>
                    <Text style={[styles.primaryBtnText, { fontFamily: font }]}>{t('next')}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ── Step: Photo ── */}
        {step === 'photo' && (
          <View style={styles.stepCard}>
            <Text style={styles.stepIcon}>📷</Text>
            <Text style={[styles.stepTitle, { color: T.text, fontFamily: 'Nunito_700Bold' }]}>{t('dc_photo_sub')}</Text>
            <Text style={[styles.stepSub, { color: T.sub, fontFamily: font }]}>{t('dc_photo_tap')}</Text>
            <TouchableOpacity onPress={handlePhotoCapture} style={styles.photoArea}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.photoPreview} />
              ) : (
                <View style={[styles.photoPlaceholder, { backgroundColor: T.hi as any, borderColor: T.border as any }]}>
                  <Text style={styles.photoPlaceholderIcon}>📷</Text>
                  <Text style={[styles.photoPlaceholderText, { color: T.sub, fontFamily: font }]}>{t('dc_photo_tap')}</Text>
                </View>
              )}
            </TouchableOpacity>
            {uploading && <ActivityIndicator color="#22d47a" />}
            <TouchableOpacity onPress={handlePhotoNext} style={styles.primaryBtn} disabled={uploading}>
              <LinearGradient colors={['#22d47a', '#16a85a']} style={styles.primaryBtnGrad}>
                <Text style={[styles.primaryBtnText, { fontFamily: font }]}>{t('dc_next')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step: OTP ── */}
        {step === 'otp' && (
          <View style={styles.stepCard}>
            <Text style={styles.stepIcon}>🔐</Text>
            <Text style={[styles.stepTitle, { color: T.text, fontFamily: 'Nunito_700Bold' }]}>{t('verify_otp')}</Text>
            <Text style={[styles.stepSub, { color: T.sub, fontFamily: font }]}>Ask the customer for the 4-digit OTP</Text>
            <View style={styles.otpRow}>
              {otp.map((digit, idx) => (
                <TextInput
                  key={idx}
                  ref={r => { if (r) otpRefs.current[idx] = r; }}
                  style={[styles.otpInput, { color: T.text, borderColor: digit ? '#22d47a' : T.border as any, backgroundColor: T.hi as any }]}
                  value={digit}
                  onChangeText={val => handleOtpChange(val.slice(-1), idx)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                />
              ))}
            </View>
            <TouchableOpacity onPress={handleComplete} disabled={loading} style={styles.primaryBtn}>
              <LinearGradient colors={['#22d47a', '#16a85a']} style={styles.primaryBtnGrad}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={[styles.primaryBtnText, { fontFamily: font }]}>{t('dc_verify')}</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  backBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  stepCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#22d47a', alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: '#22d47a' },
  stepNum: { color: '#fff', fontWeight: '800', fontSize: 14 },
  stepConnector: { flex: 1, height: 2, maxWidth: 60 },
  stepCard: { alignItems: 'center', gap: 12 },
  stepIcon: { fontSize: 52 },
  stepTitle: { fontSize: 20 },
  stepSub: { fontSize: 13, textAlign: 'center' },
  amountBox: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 32, paddingVertical: 16 },
  amountValue: { fontSize: 36, fontFamily: 'Nunito_800ExtraBold' },
  primaryBtn: { width: '100%', borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  primaryBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  photoArea: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16, overflow: 'hidden' },
  photoPreview: { width: '100%', height: '100%' },
  photoPlaceholder: {
    flex: 1, borderWidth: 2, borderStyle: 'dashed', borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  photoPlaceholderIcon: { fontSize: 40 },
  photoPlaceholderText: { fontSize: 14 },
  otpRow: { flexDirection: 'row', gap: 12 },
  otpInput: {
    width: 60, height: 70, borderRadius: 14, borderWidth: 2,
    fontSize: 28, fontFamily: 'Nunito_800ExtraBold',
  },
  doneScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  doneEmoji: { fontSize: 80 },
  doneTitle: { fontSize: 28 },
  doneSub: { fontSize: 15, textAlign: 'center' },
  doneBtn: { width: '100%', borderRadius: 14, overflow: 'hidden', marginTop: 16 },
  doneBtnGrad: { paddingVertical: 18, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
});
