import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, TextInput, Animated as RNAnimated, Dimensions, Image, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { db, storage } from '../../config/firebase';
import { doc, updateDoc, getDoc, serverTimestamp, increment, collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { CheckCircle2, ShieldCheck, Banknote, Camera, RefreshCw, User, Package, MapPin, Phone, ArrowRight, AlertCircle, CheckCheck, X } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const StepPills = ({ step, T, lang }: any) => {
  const steps = [
    { num: 1, label: lang === 'bn' ? 'ক্যাশ' : 'Cash' },
    { num: 2, label: lang === 'bn' ? 'OTP' : 'OTP' },
    { num: 3, label: lang === 'bn' ? 'ছবি' : 'Photo' },
  ];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
      {steps.map((s, i) => (
        <View key={s.num} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <View style={{
              width: 32, height: 32, borderRadius: 10,
              backgroundColor: step > s.num ? T.green : step === s.num ? T.accent : 'transparent',
              borderWidth: 2, borderColor: step > s.num ? T.green : step === s.num ? T.accent : T.border,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: step === s.num ? T.accent : 'transparent', shadowOpacity: 0.5, shadowRadius: 10, elevation: step === s.num ? 4 : 0
            }}>
              {step > s.num
                ? <CheckCheck size={14} color="#fff" strokeWidth={3} />
                : <Text style={{ fontSize: 11, fontWeight: '900', color: step === s.num ? '#fff' : T.sub }}>{s.num}</Text>
              }
            </View>
            <Text style={{ fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, color: step >= s.num ? T.accent : T.sub }}>
              {s.label}
            </Text>
          </View>
          {i < steps.length - 1 && (
            <View style={{ width: 32, height: 2, backgroundColor: step > s.num ? T.green : T.border, marginHorizontal: 4, marginBottom: 18, borderRadius: 99 }} />
          )}
        </View>
      ))}
    </View>
  );
};

const InfoRow = ({ icon, label, value, accent, T }: any) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: `${accent}18`, borderWidth: 1, borderColor: `${accent}28`, alignItems: 'center', justifyContent: 'center' }}>
      {icon}
    </View>
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, color: accent, opacity: 0.7 }}>{label}</Text>
      <Text style={{ fontSize: 11, fontWeight: '700', color: T.text }} numberOfLines={1}>{value}</Text>
    </View>
  </View>
);

const InstructionCard = ({ number, text, T }: any) => (
  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
    <View style={{ width: 20, height: 20, borderRadius: 7, backgroundColor: `${T.accent}22`, borderWidth: 1, borderColor: `${T.accent}33`, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
      <Text style={{ fontSize: 10, fontWeight: '900', color: T.accent }}>{number}</Text>
    </View>
    <Text style={{ flex: 1, fontSize: 11, fontWeight: '600', color: T.sub, lineHeight: 16 }}>{text}</Text>
  </View>
);

export default function DeliveryConfirmation({ order, onComplete, onCancel, hasNextOrder = false, nextOrder = null, visible }: any) {
  const { T, t, theme, lang, font } = useApp();
  const insets = useSafeAreaInsets();
  const isDark = theme === 'dark';
  const surf = T.bg;
  const surfHi = T.hi;

  const [step, setStep] = useState(1);
  const [otpInput, setOtpInput] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const pulseAnim = useRef(new RNAnimated.Value(1)).current;

  const generateOTP = () => Math.floor(1000 + Math.random() * 9000).toString();

  useEffect(() => {
    if (visible) {
      setShowSuccess(false);
      setStep(order.paymentStatus === 'paid' ? 2 : 1);
      setOtpInput('');
      setPreviewUrl(null);
      setError('');
    }
  }, [visible, order]);

  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        RNAnimated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      ])
    ).start();
  }, []);

  useEffect(() => {
    const initOTP = async () => {
      if (order && !order.deliveryOTP) {
        try {
          await updateDoc(doc(db, 'orders', order.id), {
            deliveryOTP: generateOTP(),
            updatedAt: serverTimestamp()
          });
        } catch (err) { console.error('OTP Generation Error:', err); }
      }
    };
    if (visible && order) initOTP();
  }, [order?.id, visible]);

  useEffect(() => {
    const validateOTP = async () => {
      if (otpInput.length === 4 && step === 2) {
        try {
          const snap = await getDoc(doc(db, 'orders', order.id));
          const serverOTP = snap.data()?.deliveryOTP;
          
          if (otpInput === serverOTP) {
            setStep(3);
            setError('');
          } else {
            setError(lang === 'bn' ? 'ভুল ওটিপি, আবার চেষ্টা করুন' : 'Invalid OTP. Try again.');
            setOtpInput('');
          }
        } catch (err) {
          setError(lang === 'bn' ? 'সার্ভার ত্রুটি' : 'Server error');
        }
      }
    };
    validateOTP();
  }, [otpInput, step, order.id]);

  const handleResendOTP = async () => {
    setIsResending(true);
    try {
      const newOTP = generateOTP();
      await updateDoc(doc(db, 'orders', order.id), { deliveryOTP: newOTP, updatedAt: serverTimestamp() });
      setOtpInput('');
      setError('');
    } catch (err) {
      setError(lang === 'bn' ? 'ওটিপি পাঠাতে সমস্যা হয়েছে' : 'Failed to resend OTP');
    } finally { setIsResending(false); }
  };

  const handleCapture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Camera permission is required');
      return;
    }
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.5,
    });
    if (!result.canceled) {
      setPreviewUrl(result.assets[0].uri);
      setError('');
    }
  };

  const handleFinalSubmit = async () => {
    if (otpInput.length < 4 || !previewUrl) return;
    setIsSubmitting(true);
    setError('');
    try {
      const orderRef = doc(db, 'orders', order.id);
      const riderUID = order.riderId || "sPeMgPJLfeauHz6MJomZa4sKqjH3";
      const riderRef = doc(db, 'employees', riderUID);

      const snap = await getDoc(orderRef);
      const serverData = snap.data();

      if (otpInput !== serverData?.deliveryOTP) {
        setError(lang === 'bn' ? 'ভুল ওটিপি, আবার চেষ্টা করুন' : 'Invalid OTP. Try again.');
        setIsSubmitting(false);
        return;
      }

      let finalImageUrl = '';
      try {
        const response = await fetch(previewUrl);
        const blob = await response.blob();
        const storageRef = ref(storage, `delivery_proofs/${order.id}_${Date.now()}.jpg`);
        const uploadResult = await uploadBytes(storageRef, blob);
        finalImageUrl = await getDownloadURL(uploadResult.ref);
      } catch (imgErr) { console.error("Image Upload Error:", imgErr); }

      const amountToCollect = order.paymentStatus !== 'paid' ? Number(order.totalAmount || 0) : 0;
      if (amountToCollect > 0) {
        await updateDoc(riderRef, { holdingBalance: increment(amountToCollect), lastBalanceUpdate: serverTimestamp() });
        try {
          await addDoc(collection(db, 'transactions'), {
            riderId: riderUID, orderId: order.id, orderSeq: order.seq || 'N/A',
            amount: amountToCollect, type: 'cash_collection', status: 'completed', createdAt: serverTimestamp()
          });
        } catch (trxErr) { console.error("Transaction Record Error:", trxErr); }
      }

      await updateDoc(orderRef, {
        status: 'delivered', deliveredAt: serverTimestamp(), isOTPVerified: true,
        paymentStatus: 'paid', collectedAmount: amountToCollect,
        deliveryProofImage: finalImageUrl || '', updatedAt: serverTimestamp(), updatedBy: riderUID
      });

      setIsSubmitting(false);
      setShowSuccess(true);
      setTimeout(() => {
        onComplete();
      }, 2500);
    } catch (err) {
      console.error("Critical Submission Error:", err);
      setError(lang === 'bn' ? 'অর্ডার আপডেট সম্পন্ন হতে পারেনি। আবার চেষ্টা করুন।' : 'Could not complete delivery. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (!visible && !showSuccess) return null;

  const isPaid = order?.paymentStatus === 'paid';
  const displayId = order?.seq ? `#${order.seq}` : `#${order?.id?.slice(-6).toUpperCase()}`;

  return (
    <View style={{ flex: 1, backgroundColor: surf }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, backgroundColor: surf }}>
          
          {isSubmitting && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 300, backgroundColor: isDark ? 'rgba(7,7,15,0.97)' : 'rgba(240,240,248,0.97)', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
              <ActivityIndicator size="large" color={T.accent} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, color: T.text, marginBottom: 6 }}>
                  {lang === 'bn' ? 'প্রসেসিং হচ্ছে...' : 'Processing...'}
                </Text>
                <Text style={{ fontSize: 10, color: T.sub }}>
                  {lang === 'bn' ? 'একটু অপেক্ষা করুন' : 'Please wait a moment'}
                </Text>
              </View>
            </View>
          )}

          {!showSuccess ? (
            <View style={{ flex: 1, backgroundColor: surf }}>
              <View style={{ paddingTop: insets.top + 10, paddingBottom: 10, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: T.text, fontFamily: font }}>{lang === 'bn' ? 'ডেলিভারি সম্পন্ন' : 'Delivery Finish'}</Text>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: T.accent, textTransform: 'uppercase', letterSpacing: 1 }}>{displayId}</Text>
                </View>
                <Pressable onPress={onCancel} style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
                  <X size={22} color={T.text} strokeWidth={2.5} />
                </Pressable>
              </View>

              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                <View style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: T.border, overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16 }}>
                    <RNAnimated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: T.accent, transform: [{ scale: pulseAnim }] }} />
                    <Text style={{ fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2.5, color: T.accent }}>
                      {lang === 'bn' ? 'ডেলিভারি কনফার্মেশন' : 'Delivery Confirmation'}
                    </Text>
                  </View>

                  <View style={{ gap: 10 }}>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}><InfoRow icon={<User size={13} color={T.accent} strokeWidth={2} />} label={lang === 'bn' ? 'কাস্টমার' : 'Customer'} value={order?.customer?.name || '—'} accent={T.accent} T={T} /></View>
                      <View style={{ flex: 1 }}>
                        <InfoRow icon={<Phone size={13} color={T.green} strokeWidth={2} />} label={lang === 'bn' ? 'ফোন' : 'Phone'} value={order?.customer?.phone || '—'} accent={T.green} T={T} />
                      </View>
                    </View>
                    <InfoRow icon={<MapPin size={13} color="#fb923c" strokeWidth={2} />} label={lang === 'bn' ? 'ঠিকানা' : 'Address'} value={order?.customer?.address || '—'} accent="#fb923c" T={T} />
                    <InfoRow icon={<Banknote size={13} color={isPaid ? T.accent : T.green} strokeWidth={2} />} label={lang === 'bn' ? (isPaid ? 'আগেই পেইড' : 'মোট নগদ বিল') : (isPaid ? 'Pre-Paid' : 'Total Cash')} value={`৳${order?.totalAmount || 0}`} accent={isPaid ? T.accent : T.green} T={T} />
                  </View>
                </View>

                <View style={{ padding: 20 }}>
                  <StepPills step={step} T={T} lang={lang} />

                  {step === 1 && (
                    <View style={{ gap: 14 }}>
                      <View style={{ backgroundColor: isPaid ? `${T.accent}07` : `${T.green}07`, borderWidth: 1, borderColor: isPaid ? `${T.accent}15` : `${T.green}15`, borderRadius: 24, padding: 24, alignItems: 'center' }}>
                        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: isPaid ? `${T.accent}12` : `${T.green}12`, borderWidth: 1, borderColor: isPaid ? `${T.accent}25` : `${T.green}25`, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                          <Banknote size={26} color={isPaid ? T.accent : T.green} strokeWidth={2} />
                        </View>
                        <Text style={{ fontFamily: font, fontSize: 60, letterSpacing: 1, color: T.text, marginBottom: 6, lineHeight: 60 }}>
                          ৳{order?.totalAmount || 0}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: isPaid ? `${T.accent}10` : `${T.green}10`, borderWidth: 1, borderColor: isPaid ? `${T.accent}20` : `${T.green}20`, borderRadius: 99, paddingVertical: 5, paddingHorizontal: 14 }}>
                          <Text style={{ fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, color: isPaid ? T.accent : T.green }}>
                            {isPaid ? (lang === 'bn' ? '✓ আগেই পেমেন্ট হয়েছে' : '✓ Pre-Paid') : (lang === 'bn' ? 'নগদ সংগ্রহ করুন' : 'Collect Cash')}
                          </Text>
                        </View>
                      </View>

                      <View style={{ backgroundColor: surfHi, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: T.border, gap: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <AlertCircle size={12} color={T.accent} strokeWidth={2.5} />
                          <Text style={{ fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, color: T.accent }}>{lang === 'bn' ? 'নির্দেশনা' : 'Instructions'}</Text>
                        </View>
                        {isPaid ? (
                          <InstructionCard number="!" T={T} text={lang === 'bn' ? 'এই অর্ডারটি আগেই পেইড। কাস্টমারের কাছ থেকে কোনো টাকা নেবেন না।' : 'This order is pre-paid. Do NOT collect cash from the customer.'} />
                        ) : (
                          <>
                            <InstructionCard number="1" T={T} text={lang === 'bn' ? `কাস্টমারের কাছ থেকে নগদ ৳${order?.totalAmount} টাকা বুঝে নিন।` : `Collect exactly ৳${order?.totalAmount} cash from the customer.`} />
                            <InstructionCard number="2" T={T} text={lang === 'bn' ? 'টাকা গণনা করে নিশ্চিত হওয়ার পর নিচের বাটনে ক্লিক করুন।' : 'Count the cash carefully, then tap the button to confirm.'} />
                          </>
                        )}
                      </View>

                      <Pressable onPress={() => setStep(2)} style={{ width: '100%', height: 58, borderRadius: 18, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }}>
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2 }}>
                          {isPaid ? (lang === 'bn' ? 'পরবর্তী ধাপে যান' : 'Next Step') : (lang === 'bn' ? 'টাকা পেয়েছি' : 'Cash Collected')}
                        </Text>
                        <ArrowRight size={18} color="#fff" strokeWidth={3} />
                      </Pressable>
                    </View>
                  )}

                  {step === 2 && (
                    <View style={{ gap: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: `${T.accent}12`, borderWidth: 1, borderColor: `${T.accent}25`, alignItems: 'center', justifyContent: 'center' }}>
                          <ShieldCheck size={24} color={T.accent} strokeWidth={2} />
                        </View>
                        <View>
                          <Text style={{ fontFamily: font, fontSize: 22, letterSpacing: 1, color: T.text, marginBottom: 2 }}>{lang === 'bn' ? 'OTP যাচাই করুন' : 'OTP Verification'}</Text>
                          <Text style={{ fontSize: 10, color: T.sub }}>{lang === 'bn' ? 'কাস্টমারের ফোনে ৪ সংখ্যার কোড পাঠানো হয়েছে' : '4-digit code sent to customer\'s phone'}</Text>
                        </View>
                      </View>

                      <View style={{ position: 'relative', height: 84, justifyContent: 'center' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 14 }}>
                          {[0, 1, 2, 3].map((idx) => {
                            const char = otpInput[idx] || '';
                            const isFocused = otpInput.length === idx;
                            return (
                              <View 
                                key={idx} 
                                style={{ 
                                  width: 62, 
                                  height: 74, 
                                  borderRadius: 18, 
                                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', 
                                  borderWidth: 2, 
                                  borderColor: error ? '#ff4d6d' : isFocused ? T.accent : char ? T.green : T.border + '40',
                                  alignItems: 'center', 
                                  justifyContent: 'center',
                                  shadowColor: isFocused ? T.accent : 'transparent',
                                  shadowOpacity: 0.2,
                                  shadowRadius: 10,
                                  elevation: isFocused ? 4 : 0
                                }}
                              >
                                <Text style={{ fontSize: 32, fontWeight: '900', color: error ? '#ff4d6d' : char ? T.text : T.border + '60', fontFamily: font }}>{char}</Text>
                                {isFocused && (
                                  <Animated.View entering={FadeIn.duration(400)} style={{ position: 'absolute', bottom: 12, width: 20, height: 3, borderRadius: 2, backgroundColor: T.accent }} />
                                )}
                              </View>
                            );
                          })}
                        </View>
                        <TextInput
                          keyboardType="number-pad" 
                          maxLength={4} 
                          value={otpInput} 
                          onChangeText={(v) => { setOtpInput(v.replace(/[^0-9]/g, '')); setError(''); }}
                          style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0 }}
                          autoFocus={true}
                        />
                      </View>

                      {error ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,77,109,.08)', borderWidth: 1, borderColor: 'rgba(255,77,109,.2)', borderRadius: 14, padding: 12 }}>
                          <AlertCircle size={16} color="#ff4d6d" strokeWidth={2.5} />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#ff4d6d' }}>{error}</Text>
                        </View>
                      ) : null}

                      <Pressable onPress={handleResendOTP} disabled={isResending} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 }}>
                        <RefreshCw size={14} color={T.accent} strokeWidth={2.5} />
                        <Text style={{ fontSize: 11, fontWeight: '800', color: T.accent, textTransform: 'uppercase', letterSpacing: 1 }}>{isResending ? '...' : (lang === 'bn' ? 'কোড আবার পাঠান' : 'Resend Code')}</Text>
                      </Pressable>

                      <Pressable onPress={() => setStep(3)} disabled={isSubmitting || otpInput.length < 4} style={{ width: '100%', height: 58, borderRadius: 18, backgroundColor: otpInput.length === 4 ? T.accent : T.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }}>
                        <CheckCircle2 size={18} color="#fff" strokeWidth={3} />
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2 }}>{lang === 'bn' ? 'ওটিপি যাচাই সম্পন্ন' : 'OTP Verified, Next'}</Text>
                      </Pressable>
                    </View>
                  )}

                  {step === 3 && (
                    <View style={{ gap: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: `${T.accent}10`, borderWidth: 1, borderColor: `${T.accent}20`, alignItems: 'center', justifyContent: 'center' }}>
                          <Camera size={24} color={T.accent} strokeWidth={2} />
                        </View>
                        <View>
                          <Text style={{ fontFamily: font, fontSize: 22, letterSpacing: 1, color: T.text, marginBottom: 2 }}>{lang === 'bn' ? 'ডেলিভারি প্রমাণ' : 'Proof of Delivery'}</Text>
                          <Text style={{ fontSize: 10, color: T.sub }}>{lang === 'bn' ? 'প্যাকেজ হস্তান্তরের সময় ছবি তুলুন' : 'Capture the package handover'}</Text>
                        </View>
                      </View>

                      <Pressable onPress={handleCapture} style={{ width: '100%', aspectRatio: 4 / 3, backgroundColor: surfHi, borderRadius: 24, borderWidth: 2, borderColor: previewUrl ? T.green : T.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {previewUrl ? (
                          <Image source={{ uri: previewUrl }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                          <View style={{ alignItems: 'center', gap: 12, opacity: 0.6 }}>
                            <Camera size={32} color={T.accent} strokeWidth={2} />
                            <Text style={{ fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, color: T.text }}>{lang === 'bn' ? 'ক্যামেরা খুলুন' : 'Open Camera'}</Text>
                          </View>
                        )}
                      </Pressable>

                      <Pressable onPress={handleFinalSubmit} disabled={!previewUrl || isSubmitting} style={{ width: '100%', height: 58, borderRadius: 18, backgroundColor: previewUrl ? T.green : T.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }}>
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2 }}>{lang === 'bn' ? 'ডেলিভারি সম্পন্ন করুন' : 'Complete Delivery'}</Text>
                        <ArrowRight size={18} color="#fff" strokeWidth={3} />
                      </Pressable>
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          ) : (
            <View style={{ flex: 1, backgroundColor: surf, alignItems: 'center', padding: 24, paddingTop: insets.top + 60 }}>
              <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: T.green, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                <CheckCircle2 size={50} color="#fff" strokeWidth={3} />
              </View>
              <Text style={{ fontFamily: font, fontSize: 32, fontWeight: '900', color: T.text, marginBottom: 8 }}>{lang === 'bn' ? 'ডেলিভারি সফল!' : 'Delivery Successful!'}</Text>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${T.green}10`, paddingVertical: 8, paddingHorizontal: 20, borderRadius: 99, borderWidth: 1, borderColor: `${T.green}25`, marginBottom: 30 }}>
                <Package size={14} color={T.green} strokeWidth={2.5} />
                <Text style={{ fontSize: 12, fontWeight: '900', color: T.green, letterSpacing: 1.5, textTransform: 'uppercase' }}>{displayId}</Text>
              </View>

              {nextOrder && (
                <View style={{ width: '100%', backgroundColor: isDark ? 'rgba(34,212,122,0.1)' : 'rgba(34,212,122,0.05)', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: 'rgba(34,212,122,0.4)', gap: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: T.text, textTransform: 'uppercase', letterSpacing: 1.5 }}>{lang === 'bn' ? 'পরবর্তী গন্তব্য' : 'Next Destination'}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: T.text }}>#{nextOrder.seq || nextOrder.id?.slice(-6).toUpperCase()}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: T.text }}>{nextOrder.customer?.address || 'N/A'}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
