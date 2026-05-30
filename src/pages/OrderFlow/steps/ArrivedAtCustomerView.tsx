import React from 'react';
import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { Banknote, CreditCard, Phone, ShieldCheck, AlertCircle, User, MapPin, AlertTriangle } from 'lucide-react-native';
import { useApp } from '../../../context/AppContext';

export default React.memo(function ArrivedAtCustomerView({ order, onCancelRequest }: any) {
  const { T, theme, lang, font } = useApp();

  const isPaid = order.paymentStatus === 'paid';
  const totalToCollect = order.totalAmount || 0;
  const paymentMethod = order.paymentMethod === 'cod'
    ? (lang === 'bn' ? 'ক্যাশ অন ডেলিভারি' : 'Cash On Delivery')
    : (lang === 'bn' ? 'প্রিপেইড' : 'Prepaid');

  const pc = isPaid ? T.accent : T.green;
  const pcDim = isPaid ? `${T.accent}14` : `${T.green}14`;
  const pcBrd = isPaid ? `${T.accent}26` : `${T.green}26`;

  const isDark = theme === 'dark';
  const cardBg = T.bg;
  const sheetBg = T.hi;
  const txt = T.text;
  const sub = T.sub;
  const brd = T.border;

  return (
    <View style={{ flex: 1, backgroundColor: sheetBg, overflow: 'hidden' }}>

      {/* ── FLOATING PAYMENT HEADER CARD ── */}
      <View style={{ paddingHorizontal: 16, paddingTop: 14, zIndex: 20 }}>
        <View style={{
          backgroundColor: cardBg,
          borderWidth: 1, borderColor: brd,
          borderRadius: 24,
          padding: 24,
          overflow: 'hidden',
          shadowColor: '#000', shadowOpacity: isDark ? 0.3 : 0.08, shadowRadius: 32, elevation: 12
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ width: 54, height: 54, borderRadius: 17, backgroundColor: pcDim, borderWidth: 1, borderColor: pcBrd, alignItems: 'center', justifyContent: 'center' }}>
              <Banknote size={26} color={pc} strokeWidth={1.8} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, fontWeight: '800', letterSpacing: 2.5, textTransform: 'uppercase', color: pc, marginBottom: 2 }}>
                {isPaid
                  ? (lang === 'bn' ? 'আগেই পেমেন্ট হয়েছে' : 'Already Paid')
                  : (lang === 'bn' ? 'সংগ্রহের পরিমাণ' : 'Total Collection')}
              </Text>
              <Text adjustsFontSizeToFit numberOfLines={1} style={{ fontFamily: font, fontSize: 32, letterSpacing: 1, color: txt }}>
                ৳{totalToCollect}
              </Text>
            </View>

            <View style={{ flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 14, backgroundColor: pc, shadowColor: pc, shadowOpacity: 0.4, shadowRadius: 14, elevation: 6 }}>
              <CreditCard size={11} color="#fff" strokeWidth={2.5} style={{ flexShrink: 0 }} />
              <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: '#fff', fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>{paymentMethod}</Text>
            </View>
          </View>
        </View>

        <View style={{ width: 44, height: 5, borderRadius: 99, backgroundColor: isDark ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.15)', alignSelf: 'center', marginTop: 12, marginBottom: 2 }} />
      </View>

      {/* ── SCROLLABLE SHEET ── */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140, paddingTop: 8, gap: 12 }}>
        
        {/* customer info */}
        <View style={{ backgroundColor: cardBg, borderWidth: 1, borderColor: brd, borderRadius: 20, padding: 16, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: `${T.accent}14`, borderWidth: 1, borderColor: `${T.accent}26`, alignItems: 'center', justifyContent: 'center' }}>
                <User size={20} color={T.accent} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 8, fontWeight: '800', letterSpacing: 2.5, textTransform: 'uppercase', color: T.accent, marginBottom: 2 }}>
                  {lang === 'bn' ? 'কাস্টমার' : 'Customer'}
                </Text>
                <Text adjustsFontSizeToFit style={{ fontFamily: font, fontSize: 18, letterSpacing: 0.5, color: txt, textTransform: 'uppercase' }} numberOfLines={1}>
                  {order.customer?.name || '—'}
                </Text>
              </View>
            </View>
            <Pressable onPress={() => Linking.openURL(`tel:${order.customer?.phone}`)} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: T.green, alignItems: 'center', justifyContent: 'center', shadowColor: T.green, shadowOpacity: 0.4, shadowRadius: 14, elevation: 6, marginLeft: 10 }}>
              <Phone size={18} color="#fff" strokeWidth={2.5} />
            </Pressable>
          </View>
          {order.customer?.address && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9 }}>
              <MapPin size={13} color={T.accent} strokeWidth={2} style={{ marginTop: 2 }} />
              <Text style={{ fontSize: 11, fontWeight: '500', fontStyle: 'italic', color: sub, flex: 1, lineHeight: 16 }}>
                {order.customer.address}
              </Text>
            </View>
          )}
        </View>

        {/* action grid */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable onPress={() => Linking.openURL(`tel:${order.customer?.phone}`)} style={{ flex: 1, backgroundColor: cardBg, borderWidth: 1, borderColor: brd, borderRadius: 20, paddingVertical: 18, paddingHorizontal: 10, alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: isDark ? 0.2 : 0.04, shadowRadius: 10, elevation: 2 }}>
            <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: `${T.accent}18`, borderWidth: 1, borderColor: `${T.accent}26`, alignItems: 'center', justifyContent: 'center' }}>
              <Phone size={20} color={T.accent} strokeWidth={2} />
            </View>
            <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, color: sub, textAlign: 'center' }}>
              {lang === 'bn' ? 'কল করুন' : 'Call'}
            </Text>
          </Pressable>
          <View style={{ flex: 1, backgroundColor: cardBg, borderWidth: 1, borderColor: brd, borderRadius: 20, paddingVertical: 18, paddingHorizontal: 10, alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: isDark ? 0.2 : 0.04, shadowRadius: 10, elevation: 2 }}>
            <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(34,212,122,.1)', borderWidth: 1, borderColor: 'rgba(34,212,122,.15)', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={20} color={T.green} strokeWidth={2} />
            </View>
            <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, color: sub, textAlign: 'center' }}>
              {lang === 'bn' ? 'ওটিপি প্রয়োজন' : 'OTP Require'}
            </Text>
          </View>
          <Pressable onPress={onCancelRequest} style={{ flex: 1, backgroundColor: cardBg, borderWidth: 1, borderColor: brd, borderRadius: 20, paddingVertical: 18, paddingHorizontal: 10, alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: isDark ? 0.2 : 0.04, shadowRadius: 10, elevation: 2 }}>
            <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(248,113,113,.1)', borderWidth: 1, borderColor: 'rgba(248,113,113,.15)', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={20} color="#f87171" strokeWidth={2} />
            </View>
            <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, color: sub, textAlign: 'center' }}>
              {lang === 'bn' ? 'ক্যান্সেল' : 'Report Issue'}
            </Text>
          </Pressable>
        </View>

        {/* instruction */}
        <View style={{ backgroundColor: cardBg, borderWidth: 1, borderColor: brd, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{
            width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
            backgroundColor: isPaid ? 'rgba(59,130,246,.1)' : 'rgba(251,146,60,.1)',
            borderWidth: 1, borderColor: isPaid ? 'rgba(59,130,246,.2)' : 'rgba(251,146,60,.2)',
          }}>
            {isPaid ? <ShieldCheck size={18} color={T.accent} strokeWidth={2} /> : <AlertCircle size={18} color="#fb923c" strokeWidth={2} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: txt, lineHeight: 18, marginBottom: 5 }}>
              {isPaid
                ? (lang === 'bn' ? 'এই অর্ডারটি আগেই পেইড। কাস্টমার থেকে টাকা নিবেন না।' : 'This order is already paid. Do not collect cash from customer.')
                : (lang === 'bn' ? `কাস্টমার থেকে নগদ ৳${totalToCollect} টাকা বুঝে নিন।` : `Collect ৳${totalToCollect} cash from the customer.`)}
            </Text>
            <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: T.accent, fontStyle: 'italic' }}>
              {lang === 'bn' ? 'টাকা পাওয়ার পর "ডেলিভারি সম্পন্ন করুন" বাটনে ক্লিক করুন।' : 'After collecting, tap "Complete Delivery" button.'}
            </Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
});
