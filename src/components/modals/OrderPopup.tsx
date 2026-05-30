import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Dimensions, Modal, Easing, PanResponder } from 'react-native';
import { Package, Timer, MapPin, Navigation, User, Store, ArrowDown, MapPinOff } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { calcDist, fmtDist } from '../map/mapUtils';
import { db, doc, getDoc } from '../../config/firebase';

export default function OrderPopup({ order, onAccept, onSkip, visible, livePos }: any) {
  const { T, t, theme, font, lang } = useApp();
  const isDark = theme === 'dark';
  const surfHi = isDark ? '#141428' : '#f4f4f9';
  const cardBg = isDark ? '#0e0e1c' : '#ffffff';

  const [timeLeft, setTimeLeft] = useState(30);
  
  const translateY = useRef(new Animated.Value(500)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Swipe gesture tracking values
  const pan = useRef(new Animated.ValueXY()).current;

  useEffect(() => {
    let loopAnim: Animated.CompositeAnimation | null = null;
    if (visible && order) {
      setTimeLeft(30);
      progressAnim.setValue(100);
      pan.setValue({ x: 0, y: 0 }); // reset swipe state
      
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 50, friction: 7 }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(progressAnim, { toValue: 0, duration: 30000, easing: Easing.linear, useNativeDriver: false })
      ]).start();

      loopAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
        ])
      );
      loopAnim.start();

    } else {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true })
      ]).start();
    }
    
    return () => {
      if (loopAnim) loopAnim.stop();
    };
  }, [visible, order]);

  useEffect(() => {
    if (!visible) return;
    if (timeLeft <= 0) {
      onSkip();
      return;
    }
    const timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, visible, onSkip]);

  // Swipe-to-dismiss PanResponder setup
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        pan.x.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > 120) {
          // Swipe off-screen and dismiss
          Animated.spring(pan.x, {
            toValue: Math.sign(gestureState.dx) * Dimensions.get('window').width,
            useNativeDriver: true,
            tension: 40,
            friction: 8,
          }).start(() => {
            onSkip();
            pan.setValue({ x: 0, y: 0 }); // reset
          });
        } else {
          // Spring back to center
          Animated.spring(pan.x, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
          }).start();
        }
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {
        Animated.spring(pan.x, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }).start();
      }
    })
  ).current;

  const [fetchedBranch, setFetchedBranch] = useState<any>(null);

  useEffect(() => {
    if (!visible || !order?.branchId) {
      setFetchedBranch(null);
      return;
    }
    const branchRef = doc(db, 'branches', order.branchId);
    getDoc(branchRef).then((snap: any) => {
      if (snap.exists()) {
        setFetchedBranch(snap.data());
      }
    }).catch(err => {
      console.log('Error fetching branch:', err);
    });
  }, [order?.branchId, visible]);

  const bLat = order?.branchLocation?.lat ?? order?.branchLocation?.latitude ?? order?.branchDetail?.location?.lat ?? order?.branchDetail?.location?.latitude ?? order?.branch?.location?.lat ?? fetchedBranch?.location?.lat ?? fetchedBranch?.location?.latitude ?? fetchedBranch?.lat ?? fetchedBranch?.latitude;
  const bLng = order?.branchLocation?.lng ?? order?.branchLocation?.longitude ?? order?.branchDetail?.location?.lng ?? order?.branchDetail?.location?.longitude ?? order?.branch?.location?.lng ?? fetchedBranch?.location?.lng ?? fetchedBranch?.location?.longitude ?? fetchedBranch?.lng ?? fetchedBranch?.longitude;

  const cLat = order?.customerLocation?.lat ?? order?.customerLocation?.latitude ?? order?.customer?.location?.lat ?? order?.customer?.location?.latitude ?? order?.customer?.address?.lat;
  const cLng = order?.customerLocation?.lng ?? order?.customerLocation?.longitude ?? order?.customer?.location?.lng ?? order?.customer?.location?.longitude ?? order?.customer?.address?.lng;

  // 1. Distance from Rider's current location to Pickup Branch
  const distRiderToBranch = livePos && bLat && bLng
    ? fmtDist(calcDist(Number(livePos.lat), Number(livePos.lng), Number(bLat), Number(bLng)))
    : null;

  // 2. Distance from Pickup Branch to Customer Delivery Address (Branch theke koto km dhure)
  const distBranchToCustomer = bLat && bLng && cLat && cLng
    ? fmtDist(calcDist(Number(bLat), Number(bLng), Number(cLat), Number(cLng)))
    : null;

  const deliveryAddress = order?.customerLocation?.address || order?.customer?.address || order?.customer?.location?.address || order?.deliveryLocation?.address || (cLat && cLng ? `Lat: ${Number(cLat).toFixed(5)}, Lng: ${Number(cLng).toFixed(5)}` : (lang === 'bn' ? 'কাস্টমার ঠিকানা' : 'Customer Address'));

  return (
    <Modal visible={visible} transparent animationType="none">
      <Pressable 
        style={{ flex: 1, backgroundColor: isDark ? 'rgba(0,0,0,.88)' : 'rgba(0,0,0,.6)', justifyContent: 'flex-end', padding: 16, paddingBottom: 32 }}
        onPress={onSkip}
      >
        <Pressable style={{ width: '100%' }} onPress={() => {}}>
          <Animated.View
            {...panResponder.panHandlers}
          style={{
            opacity,
            transform: [
              { translateY },
              { translateX: pan.x },
              { rotate: pan.x.interpolate({ inputRange: [-200, 0, 200], outputRange: ['-8deg', '0deg', '8deg'] }) }
            ],
            backgroundColor: cardBg,
            width: '100%',
            borderRadius: 32,
            borderWidth: 1,
            borderColor: T.border,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 20
          }}
        >
          
          {/* timer bar */}
          <View style={{ height: 4, backgroundColor: T.border, width: '100%' }}>
            <Animated.View style={{ height: '100%', backgroundColor: T.accent, borderRadius: 2, width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }} />
          </View>

          <View style={{ padding: 22, paddingBottom: 26 }}>
            {/* Header: Order ID & Timer */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <View>
                <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, color: T.sub, marginBottom: 4 }}>
                  {t('popup_new') || 'New Order'}
                </Text>
                <Text style={{ fontFamily: font, fontSize: 24, fontWeight: '900', color: T.text }}>
                  #{order?.orderSeq || order?.id?.slice(-8).toUpperCase() || '----'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${T.accent}12`, borderWidth: 1, borderColor: `${T.accent}20`, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16 }}>
                <Animated.View style={{ opacity: pulseAnim }}>
                  <Timer size={13} color={T.accent} strokeWidth={2.5} />
                </Animated.View>
                <Text style={{ fontFamily: font, fontSize: 18, fontWeight: '900', color: T.accent, lineHeight: 22 }}>{timeLeft}s</Text>
              </View>
            </View>

            {/* Path Visualizer: Pickup -> Delivery */}
            <View style={{ backgroundColor: surfHi, borderWidth: 1, borderColor: T.border, borderRadius: 22, padding: 18, marginBottom: 20, gap: 16 }}>
              {/* Pickup location */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(34,212,122,0.1)', borderWidth: 1, borderColor: 'rgba(34,212,122,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                  <Store size={16} color={T.green} strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, color: T.sub, marginBottom: 2 }}>
                    {t('popup_pickup') || 'Pickup Point'}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: T.text }} numberOfLines={1}>
                    {order?.branchName || order?.branchDetail?.name || fetchedBranch?.name || 'GraamBazaar Main Branch'}
                  </Text>
                </View>
                {/* Distance to pickup */}
                {distRiderToBranch && (
                  <View style={{ backgroundColor: `${T.accent}12`, borderWidth: 1, borderColor: `${T.accent}20`, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8 }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: T.accent }}>
                      {distRiderToBranch}
                    </Text>
                  </View>
                )}
              </View>

              {/* Connecting line */}
              <View style={{ position: 'absolute', left: 34, top: 46, bottom: 46, width: 2, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ flex: 1, width: 2, borderStyle: 'dashed', borderWidth: 1, borderColor: T.border }} />
                <ArrowDown size={10} color={T.border} style={{ marginTop: 2 }} />
              </View>

              {/* Delivery location */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(59,130,246,0.1)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                  <MapPin size={16} color="#3b82f6" strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, color: T.sub, marginBottom: 2 }}>
                    {t('popup_delivery') || 'Delivery Address'}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: T.text }} numberOfLines={1}>
                    {deliveryAddress}
                  </Text>
                </View>
                {/* Delivery Distance from Branch (Branch theke koto km dhure) */}
                {distBranchToCustomer && (
                  <View style={{ backgroundColor: 'rgba(34,212,122,0.1)', borderWidth: 1, borderColor: 'rgba(34,212,122,0.2)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8 }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: T.green }}>
                      {distBranchToCustomer} {lang === 'bn' ? 'শাখা থেকে' : 'from branch'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Customer Name & Delivery Address Details */}
            <View style={{ backgroundColor: surfHi, borderWidth: 1, borderColor: T.border, borderRadius: 20, padding: 16, marginBottom: 24, gap: 12 }}>
              {order?.customerName && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={14} color={T.sub} strokeWidth={2.5} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, color: T.sub, marginBottom: 1 }}>
                      {t('popup_customer') || 'Customer'}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: T.text }} numberOfLines={1}>
                      {order.customerName}
                    </Text>
                  </View>
                </View>
              )}

              {order?.customerName && <View style={{ height: 1, backgroundColor: T.border }} />}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center' }}>
                  <Navigation size={14} color={T.accent} strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, color: T.sub, marginBottom: 1 }}>
                    {lang === 'bn' ? 'শাখা থেকে দূরত্ব' : 'Distance from Branch'}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: T.text }} numberOfLines={1}>
                    {distBranchToCustomer ? `${distBranchToCustomer} ${lang === 'bn' ? 'দূরে' : 'away'}` : (lang === 'bn' ? 'পাওয়া যায়নি' : 'Not available')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable onPress={onSkip} style={{ flex: 1, height: 52, borderRadius: 16, backgroundColor: surfHi, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: T.sub, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                  {t('popup_skip') || 'Skip'}
                </Text>
              </Pressable>

              <Pressable onPress={onAccept} style={{ flex: 1, height: 52, borderRadius: 16, backgroundColor: T.green, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, shadowColor: T.green, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 }}>
                <Navigation size={15} color="#fff" strokeWidth={2.5} />
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                  {t('popup_accept') || 'Accept'}
                </Text>
              </Pressable>
            </View>
          </View>

          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
