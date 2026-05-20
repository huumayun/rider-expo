import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Animated, Dimensions, PanResponder, Modal, ScrollView, Image, Linking, Platform, StyleSheet } from 'react-native';
import { X, Phone, MapPin, ClipboardList, Timer, CheckCircle2, Eye, EyeOff, Info } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OrderDetailsModal({ order, onClose, visible }: any) {
  const { T, t, theme, lang, font } = useApp();
  const isDark = theme === 'dark';
  const surf = isDark ? '#0e0e1c' : '#ffffff';
  const surfHi = isDark ? '#141428' : '#f4f4f9';
  const cardBg = isDark ? '#0a0a17' : '#f9f9fd';
  
  const [showOTP, setShowOTP] = useState(false);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible && order) {
      setShowOTP(false);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 100 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 20, stiffness: 100 }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true })
      ]).start();
    } else {
      translateY.setValue(SCREEN_HEIGHT);
      scale.setValue(0.9);
      opacity.setValue(0);
    }
  }, [visible, order]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      ])
    ).start();
  }, []);

  const closeAnim = () => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: SCREEN_HEIGHT, useNativeDriver: true, tension: 50 }),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true })
    ]).start(() => {
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
        if (gestureState.dy > 120 || gestureState.vy > 0.6) closeAnim();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      }
    })
  ).current;

  if (!visible || !order) return null;

  const formatLocalTime = (ts: any) => {
    if (!ts) return lang === 'bn' ? 'অপেক্ষমাণ' : 'Pending';
    const d = ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const timeline = [
    { labelKey: 'odm_tl_created', time: order.createdAt, active: !!order.createdAt },
    { labelKey: 'odm_tl_accepted', time: order.acceptedAt, active: !!order.acceptedAt },
    { labelKey: 'odm_tl_branch', time: order.arrived_at_branchAt, active: !!order.arrived_at_branchAt },
    { labelKey: 'odm_tl_picked', time: order.pickedAt, active: !!order.pickedAt },
    { labelKey: 'odm_tl_onway', time: order.out_for_deliveryAt, active: !!order.out_for_deliveryAt },
    { labelKey: 'odm_tl_delivered', time: order.deliveredAt, active: !!order.deliveredAt },
  ];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeAnim}>
      <View style={styles.overlay}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
          <BlurView intensity={Platform.OS === 'ios' ? 40 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <Pressable style={StyleSheet.absoluteFill} onPress={closeAnim} />
        </Animated.View>

        <Animated.View style={[
          styles.sheet, 
          { backgroundColor: cardBg, transform: [{ translateY }, { scale }], opacity }
        ]}>
          
          <View {...panResponder.panHandlers} style={styles.dragHandleContainer}>
            <View style={[styles.dragHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]} />
          </View>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: T.border, backgroundColor: isDark ? 'rgba(10,10,23,0.85)' : 'rgba(249,249,253,0.92)' }]}>
            <View>
              <View style={styles.badgeContainer}>
                <View style={[styles.badge, { backgroundColor: `${T.accent}18`, borderColor: `${T.accent}30` }]}>
                  <Text style={[styles.badgeText, { color: T.accent, fontFamily: font }]}>
                    {lang === 'bn' ? 'অর্ডার' : 'Order'} #{order.seq || 'N/A'}
                  </Text>
                </View>
                <Text style={[styles.orderId, { color: T.sub, opacity: 0.5, fontFamily: font }]}>
                  {order.id.slice(-8)}
                </Text>
              </View>
              <Text style={[styles.title, { fontFamily: font, color: T.text, fontWeight: '800' }]}>
                {t('odm_title') || 'Order Details'}
              </Text>
            </View>
            <Pressable onPress={closeAnim} style={({ pressed }) => [styles.closeButton, { backgroundColor: surfHi, borderColor: T.border, opacity: pressed ? 0.7 : 1 }]}>
              <X size={20} color={T.text} strokeWidth={2.5} />
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            
            {/* Status + OTP */}
            <View style={styles.grid}>
              <View style={[styles.gridItem, { backgroundColor: surf, borderColor: T.border }]}>
                <Text style={[styles.label, { color: T.sub }]}>
                  {t('odm_payment') || 'Payment Status'}
                </Text>
                <View style={styles.statusRow}>
                  <Animated.View style={[styles.statusDot, { backgroundColor: order.paymentStatus === 'paid' ? T.green : '#f59e0b', shadowColor: order.paymentStatus === 'paid' ? T.green : '#f59e0b', opacity: pulseAnim }]} />
                  <Text style={[styles.statusText, { color: T.text }]}>
                    {order.paymentStatus}
                  </Text>
                </View>
              </View>

              <View style={[styles.gridItem, { backgroundColor: surf, borderColor: `${T.accent}30` }]}>
                <Text style={[styles.label, { color: T.accent }]}>
                  {t('odm_otp') || 'Delivery OTP'}
                </Text>
                <View style={styles.otpRow}>
                  <Text style={[styles.otpText, { fontFamily: font, color: showOTP ? T.text : 'transparent' }]}>
                    {order.deliveryOTP || '----'}
                  </Text>
                  {!showOTP && (
                    <View style={styles.otpMask}>
                      {[1,2,3,4].map(i => <View key={i} style={[styles.maskDot, { backgroundColor: T.sub }]} />)}
                    </View>
                  )}
                  <Pressable onPress={() => setShowOTP(!showOTP)} style={[styles.otpToggle, { backgroundColor: `${T.accent}18` }]}>
                    {showOTP ? <EyeOff size={14} color={T.accent} strokeWidth={2} /> : <Eye size={14} color={T.accent} strokeWidth={2} />}
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Recipient Details */}
            <View>
              <View style={styles.sectionHeader}>
                <Info size={11} color={T.accent} strokeWidth={2} />
                <Text style={[styles.sectionLabel, { color: T.sub }]}>
                  {t('odm_recipient') || 'Recipient Details'}
                </Text>
              </View>
              <View style={[styles.card, { backgroundColor: isDark ? 'rgba(30,41,59,0.3)' : '#f8fafc', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={[styles.customerName, { color: T.text }]}>{order.customer?.name}</Text>
                    <Text style={[styles.customerPhone, { color: T.sub }]}>{order.customer?.phone}</Text>
                  </View>
                  <Pressable onPress={() => Linking.openURL(`tel:${order.customer?.phone}`)} style={[styles.callButton, { backgroundColor: T.green, shadowColor: T.green }]}>
                    <Phone size={20} color="#fff" strokeWidth={2.5} />
                  </Pressable>
                </View>
                <View style={[styles.addressBox, { backgroundColor: surfHi, borderColor: T.border }]}>
                  <MapPin size={18} color={T.accent} strokeWidth={2} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.addressText, { color: T.text }]}>{order.customer?.address}</Text>
                    {order.customer?.landmark && (
                      <Text style={[styles.landmarkText, { color: T.accent }]}>
                        📍 {order.customer.landmark}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </View>

            {/* Items */}
            <View>
              <View style={styles.sectionHeader}>
                <ClipboardList size={11} color={T.accent} strokeWidth={2} />
                <Text style={[styles.sectionLabel, { color: T.sub }]}>
                  {t('odm_items') || 'Order Items'}
                </Text>
              </View>
              <View style={[styles.itemsContainer, { backgroundColor: surf, borderColor: T.border }]}>
                <View style={styles.itemsList}>
                  {order.items?.map((item: any, idx: number) => (
                    <View key={idx} style={[styles.itemRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }]}>
                      <View style={styles.itemInfo}>
                        <Text style={[styles.itemQty, { fontFamily: font, color: T.accent }]}>{item.qty}x</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.itemName, { color: T.text }]}>
                            {lang === 'bn' ? (item.name_bn || item.name_en) : (item.name_en || item.name_bn)}
                          </Text>
                          <Text style={[styles.itemUnit, { color: T.sub }]}>
                            {item.selectedVariation ? (lang === 'bn' ? item.selectedVariation.label_bn : item.selectedVariation.label_en) : item.unit_en}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.itemPrice, { fontFamily: font, color: T.text }]}>৳{item.total}</Text>
                    </View>
                  ))}
                </View>
                
                {/* Total Bill Gradient */}
                <LinearGradient colors={[T.accent, '#c44d00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.totalBar}>
                  <View>
                    <Text style={styles.totalLabel}>{t('odm_total') || 'Total Bill'}</Text>
                    <Text style={[styles.totalAmount, { fontFamily: font }]}>৳{order.totalAmount}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.feeText}>Fee: ৳{order.deliveryFee}</Text>
                    <Text style={styles.paymentMethod}>{order.paymentMethod}</Text>
                  </View>
                </LinearGradient>
              </View>
            </View>

            {/* Timeline */}
            <View>
              <View style={styles.sectionHeader}>
                <Timer size={11} color={T.accent} strokeWidth={2} />
                <Text style={[styles.sectionLabel, { color: T.sub }]}>
                  {t('odm_timeline') || 'Tracking Timeline'}
                </Text>
              </View>
              <View style={styles.timelineContainer}>
                <LinearGradient 
                  colors={[T.accent, T.border]} 
                  style={styles.timelineLine} 
                />
                <View style={{ gap: 20 }}>
                  {timeline.filter(step => step.active).map((step, idx) => (
                    <View key={idx} style={styles.timelineStep}>
                      <View style={[styles.timelineDot, { backgroundColor: T.accent, borderColor: cardBg, shadowColor: T.accent, shadowOpacity: 0.6, shadowRadius: 8, elevation: 5 }]} />
                      <Text style={[styles.timelineLabel, { color: T.text, fontWeight: '700' }]}>
                        {t(step.labelKey) || step.labelKey}
                      </Text>
                      <View style={[styles.timelineTimeBox, { backgroundColor: surfHi }]}>
                        <Text style={[styles.timelineTime, { fontFamily: font, color: T.sub }]}>{formatLocalTime(step.time)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Proof Image */}
            {order.deliveryProofImage && (
              <View style={[styles.proofContainer, { borderColor: `${T.green}30` }]}>
                <Image source={{ uri: order.deliveryProofImage }} style={styles.proofImage} resizeMode="cover" />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.proofOverlay}>
                  <View style={styles.proofBadge}>
                    <CheckCircle2 size={15} color={T.green} strokeWidth={2} />
                    <Text style={[styles.proofText, { color: T.green }]}>
                      {t('odm_proof') || 'Delivery Proof Attached'}
                    </Text>
                  </View>
                </LinearGradient>
              </View>
            )}

          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { width: '100%', height: '90%', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', elevation: 20, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20 },
  dragHandleContainer: { alignItems: 'center', paddingTop: 14, paddingBottom: 4 },
  dragHandle: { width: 48, height: 5, borderRadius: 99 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  badgeContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  badge: { borderWidth: 1, borderRadius: 8, paddingVertical: 2, paddingHorizontal: 8 },
  badgeText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2 },
  orderId: { fontSize: 9, textTransform: 'uppercase', letterSpacing: 2, opacity: 0.6 },
  title: { fontSize: 24, letterSpacing: 1.5 },
  closeButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 20, paddingBottom: 60, gap: 18 },
  grid: { flexDirection: 'row', gap: 12 },
  gridItem: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 14 },
  label: { fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 7, height: 7, borderRadius: 4, shadowOpacity: 0.8, shadowRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  otpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  otpText: { fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  otpMask: { position: 'absolute', left: 0, flexDirection: 'row', gap: 4 },
  maskDot: { width: 8, height: 8, borderRadius: 4 },
  otpToggle: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionLabel: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2.5 },
  card: { borderWidth: 1, borderRadius: 22, padding: 18 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  customerName: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  customerPhone: { fontSize: 11 },
  callButton: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.3, shadowRadius: 16, elevation: 5 },
  addressBox: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1 },
  addressText: { fontSize: 12, fontWeight: '600', lineHeight: 18 },
  landmarkText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginTop: 4, fontStyle: 'italic' },
  itemsContainer: { borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  itemsList: { padding: 8, gap: 4 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 14 },
  itemInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  itemQty: { fontSize: 18, letterSpacing: 0.5 },
  itemName: { fontSize: 12, fontWeight: '700', lineHeight: 16 },
  itemUnit: { fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5 },
  itemPrice: { fontSize: 16 },
  totalBar: { padding: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  totalLabel: { fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.6)', marginBottom: 3 },
  totalAmount: { fontSize: 32, color: '#fff', lineHeight: 32 },
  feeText: { fontSize: 9, color: 'rgba(255,255,255,0.6)', marginBottom: 2 },
  paymentMethod: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', color: '#fff' },
  timelineContainer: { paddingLeft: 28, position: 'relative' },
  timelineLine: { position: 'absolute', left: 10, top: 4, bottom: 4, width: 2 },
  timelineStep: { position: 'relative', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineDot: { position: 'absolute', left: -24, top: 2, width: 12, height: 12, borderRadius: 6, borderWidth: 3 },
  timelineLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  timelineTimeBox: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 8 },
  timelineTime: { fontSize: 9 },
  proofContainer: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, marginTop: 8 },
  proofImage: { width: '100%', height: 220 },
  proofOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, justifyContent: 'flex-end', padding: 16 },
  proofBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  proofText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }
});
