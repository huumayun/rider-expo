import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions, ScrollView, Linking, Platform } from 'react-native';
import { X, Navigation, MapPin, Phone, MessageCircle, Package, Store, User, ChevronRight, PackageCheck } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut, SlideInUp, SlideOutUp } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

/* ─────────────────────────────────────────────
   BranchOverlay
───────────────────────────────────────────── */
export function BranchNavigationOverlay({ visible, onClose, order, branchData, onPickedUp }: any) {
  const { T, lang, font } = useApp();

  const navUrl = branchData
    ? `https://www.google.com/maps/dir/?api=1&destination=${branchData.location?.lat},${branchData.location?.lng}&travelmode=motorcycle&dir_action=navigate`
    : null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.scrimContainer}>
        <Animated.View entering={FadeIn} exiting={FadeOut} style={StyleSheet.absoluteFillObject}>
          <TouchableOpacity activeOpacity={1} onPress={onClose} style={styles.scrim} />
        </Animated.View>

        <Animated.View 
          entering={SlideInUp.springify().damping(22).stiffness(280)} 
          exiting={SlideOutUp}
          style={[styles.cardContainer, { top: Platform.OS === 'ios' ? 50 : 20 }]}
        >
          <View style={[styles.card, { backgroundColor: T.bg === '#07070f' || T.bg?.includes('0d') || T.bg?.includes('111') ? 'rgba(14,14,28,0.97)' : 'rgba(255,255,255,0.97)', borderColor: T.border, borderTopColor: T.accent }]}>
            <LinearGradient colors={[T.accent as string, '#facc15', '#22c55e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.accentBar} />

            <View style={[styles.header, { borderBottomColor: T.border }]}>
              <View style={styles.headerLeft}>
                <View style={[styles.iconBg, { backgroundColor: 'rgba(232,93,4,0.12)', borderColor: 'rgba(232,93,4,0.22)' }]}>
                  <Store size={16} color={T.accent as string} strokeWidth={2} />
                </View>
                <View>
                  <Text style={[styles.headerLabel, { color: T.accent, fontFamily: font }]}>{lang === 'bn' ? 'গন্তব্য' : 'Destination'}</Text>
                  <Text style={[styles.headerTitle, { color: T.text, fontFamily: font }]}>{lang === 'bn' ? 'পিকআপ শাখা' : 'Pickup Branch'}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: T.surface, borderColor: T.border }]}>
                <X size={15} color={T.sub as string} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <Text style={[styles.branchName, { color: T.text, fontFamily: font }]}>{branchData?.name || (lang === 'bn' ? 'লোড হচ্ছে…' : 'Loading…')}</Text>
              <View style={styles.infoRow}>
                <MapPin size={11} color={T.sub as string} strokeWidth={2} style={styles.infoIcon} />
                <Text style={[styles.infoText, { color: T.sub, fontFamily: font }]}>{branchData?.address || '—'}</Text>
              </View>

              {order?.items?.length > 0 && (
                <View style={[styles.itemsBox, { backgroundColor: T.surface, borderColor: T.border }]}>
                  <View style={styles.itemsHeader}>
                    <Package size={10} color={T.accent as string} strokeWidth={2} />
                    <Text style={[styles.itemsLabel, { color: T.sub, fontFamily: font }]}>
                      {lang === 'bn' ? `${order.items.length} টি পণ্য পিকআপ করুন` : `${order.items.length} items to pickup`}
                    </Text>
                  </View>
                  <View style={styles.itemsList}>
                    {order.items.slice(0, 3).map((item: any, i: number) => (
                      <View key={i} style={styles.itemRow}>
                        <Text style={[styles.itemName, { color: T.text, fontFamily: font }]}>
                          {lang === 'bn' ? (item.name_bn || item.name_en) : (item.name_en || item.name_bn)}
                        </Text>
                        <Text style={[styles.itemQty, { color: T.accent, fontFamily: font }]}>{item.qty}x</Text>
                      </View>
                    ))}
                    {order.items.length > 3 && (
                      <Text style={[styles.moreText, { color: T.sub, fontFamily: font }]}>
                        +{order.items.length - 3} {lang === 'bn' ? 'আরো' : 'more'}
                      </Text>
                    )}
                  </View>
                </View>
              )}

              <View style={styles.actions}>
                <TouchableOpacity onPress={() => navUrl && Linking.openURL(navUrl)} style={[styles.secondaryBtn, { backgroundColor: T.surface, borderColor: T.border }]}>
                  <Navigation size={14} color={T.accent as string} strokeWidth={2.5} />
                  <Text style={[styles.secondaryBtnText, { color: T.text, fontFamily: font }]}>{lang === 'bn' ? 'ম্যাপ খুলুন' : 'Open Map'}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { onPickedUp?.(); onClose(); }} style={styles.primaryBtn}>
                  <LinearGradient colors={['#22c55e', '#16a34a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
                  <PackageCheck size={16} color="#fff" strokeWidth={2.5} />
                  <Text style={[styles.primaryBtnText, { fontFamily: font }]}>{lang === 'bn' ? 'পণ্য নিয়েছি' : 'Picked Up'}</Text>
                  <ChevronRight size={14} color="rgba(255,255,255,0.7)" strokeWidth={3} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ─────────────────────────────────────────────
   CustomerOverlay
───────────────────────────────────────────── */
export function CustomerNavigationOverlay({ visible, onClose, order, onDelivered }: any) {
  const { T, lang, font } = useApp();

  const phone = order?.customer?.phone;
  const smsUrl = `sms:${phone}`;
  const callUrl = `tel:${phone}`;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.scrimContainer}>
        <Animated.View entering={FadeIn} exiting={FadeOut} style={StyleSheet.absoluteFillObject}>
          <TouchableOpacity activeOpacity={1} onPress={onClose} style={styles.scrim} />
        </Animated.View>

        <Animated.View 
          entering={SlideInUp.springify().damping(22).stiffness(280)} 
          exiting={SlideOutUp}
          style={[styles.cardContainer, { top: Platform.OS === 'ios' ? 50 : 20 }]}
        >
          <View style={[styles.card, { backgroundColor: T.bg === '#07070f' || T.bg?.includes('0d') || T.bg?.includes('111') ? 'rgba(14,14,28,0.97)' : 'rgba(255,255,255,0.97)', borderColor: T.border, borderTopColor: '#6366f1' }]}>
            <LinearGradient colors={['#6366f1', '#818cf8', '#a5b4fc']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.accentBar} />

            <View style={[styles.header, { borderBottomColor: T.border }]}>
              <View style={styles.headerLeft}>
                <View style={[styles.iconBg, { backgroundColor: 'rgba(99,102,241,0.12)', borderColor: 'rgba(99,102,241,0.22)' }]}>
                  <User size={16} color="#6366f1" strokeWidth={2} />
                </View>
                <View>
                  <Text style={[styles.headerLabel, { color: '#6366f1', fontFamily: font }]}>{lang === 'bn' ? 'গন্তব্য' : 'Destination'}</Text>
                  <Text style={[styles.headerTitle, { color: T.text, fontFamily: font }]}>{lang === 'bn' ? 'কাস্টমার' : 'Customer'}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: T.surface, borderColor: T.border }]}>
                <X size={15} color={T.sub as string} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <Text style={[styles.branchName, { color: T.text, fontFamily: font }]}>{order?.customer?.name || '—'}</Text>
              <View style={styles.infoRow}>
                <MapPin size={11} color={T.sub as string} strokeWidth={2} style={styles.infoIcon} />
                <Text style={[styles.infoText, { color: T.sub, fontFamily: font }]}>{order?.customer?.address || '—'}</Text>
              </View>

              {order?.customer?.landmark && (
                <View style={[styles.landmarkBadge, { backgroundColor: 'rgba(232,93,4,0.10)', borderColor: 'rgba(232,93,4,0.18)' }]}>
                  <Text style={[styles.landmarkText, { color: T.accent, fontFamily: font }]}>📍 {order.customer.landmark}</Text>
                </View>
              )}

              <View style={styles.paymentBadgeContainer}>
                <View style={[styles.paymentBadge, { 
                  backgroundColor: order?.paymentStatus === 'paid' ? 'rgba(59,130,246,0.1)' : 'rgba(34,212,122,0.1)',
                  borderColor: order?.paymentStatus === 'paid' ? 'rgba(59,130,246,0.25)' : 'rgba(34,212,122,0.3)'
                }]}>
                  <View style={[styles.dot, { backgroundColor: order?.paymentStatus === 'paid' ? '#3b82f6' : '#22c55e' }]} />
                  <Text style={[styles.paymentText, { color: order?.paymentStatus === 'paid' ? '#3b82f6' : '#22c55e', fontFamily: font }]}>
                    {order?.paymentStatus === 'paid'
                      ? (lang === 'bn' ? 'পেইড' : 'Paid')
                      : (lang === 'bn' ? `সংগ্রহ করুন ৳${order?.totalAmount}` : `Collect ৳${order?.totalAmount}`)}
                  </Text>
                </View>
              </View>

              <View style={styles.actions}>
                <View style={styles.topActions}>
                  <TouchableOpacity onPress={() => Linking.openURL(callUrl)} style={[styles.actionBtn, { backgroundColor: 'rgba(34,212,122,0.1)', borderColor: 'rgba(34,212,122,0.35)' }]}>
                    <Phone size={15} color="#22c55e" strokeWidth={2.5} />
                    <Text style={[styles.actionBtnText, { color: '#22c55e', fontFamily: font }]}>{lang === 'bn' ? 'কল' : 'Call'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => Linking.openURL(smsUrl)} style={[styles.actionBtn, { backgroundColor: 'rgba(99,102,241,0.10)', borderColor: 'rgba(99,102,241,0.25)' }]}>
                    <MessageCircle size={15} color="#6366f1" strokeWidth={2.5} />
                    <Text style={[styles.actionBtnText, { color: '#6366f1', fontFamily: font }]}>{lang === 'bn' ? 'মেসেজ' : 'Message'}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => { onDelivered?.(); onClose(); }} style={styles.primaryBtnLarge}>
                  <LinearGradient colors={['#6366f1', '#4338ca']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
                  <PackageCheck size={18} color="#fff" strokeWidth={2.5} />
                  <Text style={[styles.primaryBtnTextLarge, { fontFamily: font }]}>{lang === 'bn' ? 'ডেলিভারি সম্পন্ন' : 'Delivered'}</Text>
                  <ChevronRight size={15} color="rgba(255,255,255,0.65)" strokeWidth={3} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrimContainer: { flex: 1, justifyContent: 'flex-start', alignItems: 'center' },
  scrim: { flex: 1, width: '100%', backgroundColor: 'rgba(0,0,0,0.35)' },
  cardContainer: { position: 'absolute', left: 14, right: 14, maxWidth: 480 },
  card: { borderRadius: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderWidth: 1, overflow: 'hidden', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  accentBar: { height: 3 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBg: { width: 34, height: 34, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2.5 },
  headerTitle: { fontSize: 17, fontWeight: '800', letterSpacing: 0.5, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18 },
  branchName: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  infoIcon: { marginTop: 2 },
  infoText: { fontSize: 11, fontStyle: 'italic', lineHeight: 16, flex: 1 },
  itemsBox: { marginTop: 12, borderRadius: 14, borderWidth: 1, padding: 10 },
  itemsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  itemsLabel: { fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2 },
  itemsList: { gap: 5 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontSize: 11, fontWeight: '600' },
  itemQty: { fontSize: 10, fontWeight: '800' },
  moreText: { fontSize: 9, fontStyle: 'italic' },
  actions: { marginTop: 14, gap: 10 },
  secondaryBtn: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  secondaryBtnText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
  primaryBtn: { flex: 2, height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' },
  primaryBtnText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, color: '#fff' },
  landmarkBadge: { alignSelf: 'flex-start', borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 3, marginTop: 8 },
  landmarkText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5 },
  paymentBadgeContainer: { marginTop: 10 },
  paymentBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  paymentText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
  topActions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, height: 46, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  actionBtnText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
  primaryBtnLarge: { width: '100%', height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, overflow: 'hidden', marginTop: 10 },
  primaryBtnTextLarge: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, color: '#fff' },
});
