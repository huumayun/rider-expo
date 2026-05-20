import React, { useRef, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, NativeSyntheticEvent, NativeScrollEvent, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Check, MousePointerClick } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';

const { height } = Dimensions.get('window');

const TERMS_BN = `গ্রামবাজার রাইডার অ্যাপ ব্যবহারের শর্তাবলী

১. পরিষেবার শর্তাবলী
এই অ্যাপ্লিকেশনটি শুধুমাত্র গ্রামবাজার কর্তৃক অনুমোদিত ডেলিভারি রাইডারদের জন্য। অননুমোদিত ব্যক্তির ব্যবহার সম্পূর্ণ নিষিদ্ধ।

২. অবস্থান ট্র্যাকিং
আপনার ডিউটি অনলাইন থাকাকালীন আপনার জিপিএস অবস্থান রিয়েল-টাইমে সংরক্ষণ করা হবে। এই তথ্য শুধুমাত্র ডেলিভারি কার্যক্রম পরিচালনার জন্য ব্যবহার করা হবে।

৩. ছবি ও ডেটা
ডেলিভারি প্রমাণের জন্য তোলা ছবি গ্রামবাজারের সার্ভারে সংরক্ষণ করা হবে এবং ব্যবহারকারীর পরিচয় যাচাইয়ের জন্য ব্যবহার হতে পারে।

৪. নগদ পরিচালনা
COD অর্ডারের নগদ অর্থ সঠিকভাবে সংগ্রহ করে এবং নির্ধারিত সময়ের মধ্যে এডমিনের কাছে জমা দেওয়া রাইডারের দায়িত্ব।

৫. আচরণবিধি
রাইডারকে সর্বদা পেশাদার আচরণ বজায় রাখতে হবে। কাস্টমারের সাথে অসদাচরণ অ্যাকাউন্ট বাতিলের কারণ হতে পারে।

৬. গোপনীয়তা
কাস্টমারের ব্যক্তিগত তথ্য (নাম, ঠিকানা, ফোন নম্বর) কোনো তৃতীয় পক্ষের সাথে শেয়ার করা সম্পূর্ণ নিষিদ্ধ।

৭. পরিবর্তনের অধিকার
গ্রামবাজার যেকোনো সময় এই শর্তাবলী পরিবর্তন করার অধিকার সংরক্ষণ করে। পরিবর্তনের পর অ্যাপ ব্যবহার অব্যাহত রাখলে নতুন শর্তাবলী মেনে নেওয়া হয়েছে বলে ধরা হবে।

৮. বিরোধ নিষ্পত্তি
যেকোনো বিরোধ গ্রামবাজারের অভ্যন্তরীণ নিষ্পত্তি পদ্ধতি অনুযায়ী সমাধান করা হবে।

এই শর্তাবলী মেনে নিয়ে আপনি নিশ্চিত করছেন যে আপনি একজন অনুমোদিত গ্রামবাজার রাইডার এবং উপরোক্ত সকল শর্ত বোঝেন ও মানতে সম্মত।`;

const TERMS_EN = `GraamBazaar Rider App Terms & Conditions

1. Service Terms
This application is exclusively for GraamBazaar-approved delivery riders. Unauthorized use is strictly prohibited.

2. Location Tracking
While your duty status is online, your GPS location will be tracked in real-time. This data is used solely for delivery operations.

3. Photos & Data
Delivery proof photos are stored on GraamBazaar servers and may be used for verification purposes.

4. Cash Management
Riders are responsible for correctly collecting COD amounts and submitting cash to admin within the designated timeframe.

5. Code of Conduct
Riders must maintain professional conduct at all times. Misconduct toward customers may result in account termination.

6. Privacy
Sharing customer personal information (name, address, phone number) with third parties is strictly prohibited.

7. Right to Modify
GraamBazaar reserves the right to modify these terms at any time. Continued use after changes implies acceptance.

8. Dispute Resolution
Any disputes will be resolved through GraamBazaar's internal resolution process.

By accepting, you confirm that you are an authorized GraamBazaar rider and agree to all the above terms.`;

export default function TermsPage() {
  const { T, t, font, lang } = useApp();
  const router = useRouter();
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const atBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
    if (atBottom && !scrolledToBottom) setScrolledToBottom(true);
  }, [scrolledToBottom]);

  const handleAccept = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(auth)/login');
    }
  };

  const termsText = lang === 'bn' ? TERMS_BN : TERMS_EN;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: T.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: T.border, backgroundColor: T.surface }]}>
        <TouchableOpacity 
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(auth)/login')} 
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text, fontFamily: 'Nunito_700Bold' }]}>
          {t('terms_title')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      {/* Scroll note */}
      {!scrolledToBottom && (
        <View style={[styles.scrollNote, { backgroundColor: '#22d47a22' }]}>
          <MousePointerClick size={16} color="#22d47a" style={{ marginRight: 8 }} />
          <Text style={[styles.scrollNoteText, { color: '#22d47a', fontFamily: font }]}>
            {t('terms_scroll_note')}
          </Text>
        </View>
      )}

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={true}
      >
        <View style={[styles.termsCard, { backgroundColor: T.surface, borderColor: T.border }]}>
          <Text style={[styles.termsText, { color: T.text, fontFamily: font }]}>
            {termsText}
          </Text>
        </View>

        {/* Spacer so content doesn't hide behind button */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Accept button — fixed at bottom */}
      <View style={[styles.footer, { backgroundColor: T.bg, borderTopColor: T.border }]}>
        {!scrolledToBottom && (
          <Text style={[styles.readMoreHint, { color: T.sub, fontFamily: font }]}>
            {lang === 'bn' ? 'সব পড়লে বাটন সক্রিয় হবে' : 'Scroll to the end to enable'}
          </Text>
        )}
        <TouchableOpacity
          onPress={handleAccept}
          disabled={!scrolledToBottom}
          style={[styles.acceptBtn, { opacity: scrolledToBottom ? 1 : 0.35 }]}
        >
          <LinearGradient
            colors={['#22d47a', '#16a85a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.acceptGrad}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Check size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={[styles.acceptText, { fontFamily: font }]}>
                {t('terms_accept_btn')}
              </Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 17, textAlign: 'center' },
  scrollNote: {
    marginHorizontal: 16, marginTop: 10,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  scrollNoteText: { fontSize: 13, fontWeight: '600' },
  scrollView: { flex: 1 },
  content: { padding: 16 },
  termsCard: {
    borderRadius: 16, borderWidth: 1, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  termsText: {
    fontSize: 14, lineHeight: 24,
  },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, paddingBottom: 28,
    borderTopWidth: 1, gap: 8,
  },
  readMoreHint: { textAlign: 'center', fontSize: 12 },
  acceptBtn: { borderRadius: 14, overflow: 'hidden' },
  acceptGrad: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  acceptText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
