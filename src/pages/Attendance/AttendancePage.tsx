import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, ActivityIndicator, Animated, PanResponder, ScrollView } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { db } from '../../config/firebase';
import { collection, query, orderBy, onSnapshot, where, doc, updateDoc, serverTimestamp, setDoc, getDoc } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import MapView, { Marker, Callout, PROVIDER_DEFAULT } from 'react-native-maps';
import { useApp } from '../../context/AppContext';
import { ChevronLeft, PackageCheck, LogIn, BarChart2, TrendingUp, History, Power, ChevronDown, ChevronUp } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');

const SNAP_EXPANDED = SCREEN_H * 0.38;
const SNAP_COLLAPSED = SCREEN_H * 0.88;

const formatTime = (isoString: string) => {
  if (!isoString) return '--:--';
  const d = new Date(isoString);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
};

const formatDateDayMonth = (isoString: string) => {
  const d = new Date(isoString);
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${days[d.getDay()]}, ${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]}`;
};

const getShortDay = (isoString: string) => {
  const d = new Date(isoString);
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return days[d.getDay()];
};

const getMonthShort = (isoString: string) => {
  const d = new Date(isoString);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()];
};

export default function AttendancePage() {
  const { rider } = useAuthStore();
  const router = useRouter();
  const { T, t, theme, lang, font } = useApp();
  const isDark = theme === 'dark';
  
  const getTodayId = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  };
  const todayId = getTodayId();

  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [orderMarkers, setOrderMarkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [summaryView, setSummaryView] = useState<'week' | 'history'>('week');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    if (!rider?.uid) return;
    const unsub = onSnapshot(
      query(collection(db, 'employees', rider.uid, 'attendance'), orderBy('date', 'desc')),
      snap => {
        setAttendanceLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );
    return () => unsub();
  }, [rider?.uid]);

  useEffect(() => {
    if (!rider?.uid) return;
    const unsub = onSnapshot(
      query(
        collection(db, 'orders'),
        where('riderId', '==', rider.uid),
        where('status', 'in', ['delivered', 'success'])
      ),
      snap => {
        const markers = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((o: any) => {
            if (!o.deliveredAt?.seconds || !o.customer?.location?.lat) return false;
            const d = new Date(o.deliveredAt.seconds * 1000);
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
            return d.toISOString().split('T')[0] === todayId;
          })
          .map((o: any, i) => ({
            num: i + 1,
            lat: o.customer.location.lat,
            lng: o.customer.location.lng,
            name: o.customer?.name || `Order #${o.seq}`,
            amount: o.totalAmount,
            deliveryTime: formatTime(new Date(o.deliveredAt.seconds * 1000).toISOString()),
          }));
        setOrderMarkers(markers);
      }
    );
    return () => unsub();
  }, [rider?.uid, todayId]);

  const handleToggleDuty = async () => {
    if (loading || !rider?.uid) return;
    setLoading(true);
    try {
      const attendRef = doc(db, 'employees', rider.uid, 'attendance', todayId);
      const riderRef = doc(db, 'employees', rider.uid);

      if (rider.dutyStatus !== 'online') {
        await setDoc(attendRef, {
          date: todayId,
          lastCheckIn: serverTimestamp(),
          checkInTime: new Date().toISOString(),
          status: 'present',
          totalMinutes: 0,
        }, { merge: true });
        await updateDoc(riderRef, { dutyStatus: 'online', 'currentLocation.lastSeen': serverTimestamp() });
      } else {
        const snap = await getDoc(attendRef);
        const data = snap.data() || {};
        let diffMins = 0;
        if (data.lastCheckIn) {
          const checkInDate = data.lastCheckIn.toDate();
          diffMins = Math.floor((new Date().getTime() - checkInDate.getTime()) / 60000);
        }
        await updateDoc(attendRef, {
          lastCheckOut: serverTimestamp(),
          checkOutTime: new Date().toISOString(),
          totalMinutes: (data.totalMinutes || 0) + diffMins,
          totalOrders: orderMarkers.length,
        });
        await updateDoc(riderRef, { dutyStatus: 'offline' });
      }
    } catch (err) {
      console.error('[Attendance] Toggle Duty Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const logs = [...attendanceLogs].slice(0, 7).reverse();
    const maxVal = Math.max(...logs.map(l => l.totalMinutes || 0), 60);
    return logs.map(l => ({
      day: getShortDay(l.date),
      value: ((l.totalMinutes || 0) / 60).toFixed(1),
      height: ((l.totalMinutes || 0) / maxVal) * 100,
      orders: l.totalOrders || 0
    }));
  }, [attendanceLogs]);

  const todayLog = attendanceLogs.find(l => l.id === todayId);
  const checkInTime = todayLog?.checkInTime ? formatTime(todayLog.checkInTime) : '--:--';
  const isOnline = rider?.dutyStatus === 'online';

  // Draggable Sheet Logic
  const sheetY = useRef(new Animated.Value(SNAP_EXPANDED)).current;
  const isCollapsed = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 5,
      onPanResponderMove: (_, gesture) => {
        const base = isCollapsed.current ? SNAP_COLLAPSED : SNAP_EXPANDED;
        let newY = base + gesture.dy;
        if (newY < SNAP_EXPANDED) newY = SNAP_EXPANDED;
        if (newY > SNAP_COLLAPSED) newY = SNAP_COLLAPSED;
        sheetY.setValue(newY);
      },
      onPanResponderRelease: (_, gesture) => {
        const velocity = gesture.vy;
        let target = isCollapsed.current ? SNAP_COLLAPSED : SNAP_EXPANDED;
        if (velocity > 0.5 || gesture.dy > 50) {
          target = SNAP_COLLAPSED;
        } else if (velocity < -0.5 || gesture.dy < -50) {
          target = SNAP_EXPANDED;
        }
        isCollapsed.current = target === SNAP_COLLAPSED;
        Animated.spring(sheetY, { toValue: target, useNativeDriver: false, tension: 50, friction: 8 }).start();
      }
    })
  ).current;

  const toggleSheet = () => {
    const target = isCollapsed.current ? SNAP_EXPANDED : SNAP_COLLAPSED;
    isCollapsed.current = !isCollapsed.current;
    Animated.spring(sheetY, { toValue: target, useNativeDriver: false, tension: 50, friction: 8 }).start();
  };

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (isOnline) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
        ])
      );
      anim.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [isOnline]);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      
      {/* MAP */}
      <View style={{ position: 'absolute', inset: 0 }}>
        <MapView
          provider={PROVIDER_DEFAULT}
          style={{ width: '100%', height: '100%' }}
          initialRegion={{
            latitude: 24.653312,
            longitude: 89.42376,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          userInterfaceStyle={isDark ? 'dark' : 'light'}
          showsUserLocation={true}
          showsMyLocationButton={false}
          showsCompass={false}
        >
          {orderMarkers.map((marker, i) => (
            <Marker key={i} coordinate={{ latitude: marker.lat, longitude: marker.lng }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: T.accent, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12 }}>
                <Text style={{ fontFamily: font, fontSize: 13, fontWeight: '900', color: '#fff' }}>{marker.num}</Text>
              </View>
              <Callout tooltip>
                <View style={{ backgroundColor: T.surface, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: T.border, minWidth: 100 }}>
                  <Text style={{ fontFamily: font, fontSize: 12, fontWeight: '800', color: T.text, marginBottom: 4 }}>{marker.name}</Text>
                  <Text style={{ fontFamily: font, fontSize: 11, color: T.accent, marginBottom: 2 }}>৳ {marker.amount}</Text>
                  <Text style={{ fontFamily: font, fontSize: 10, color: T.sub }}>{marker.deliveryTime}</Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>
      </View>

      {/* TOP ACTION BAR */}
      <View style={{ position: 'absolute', top: 50, left: 20, right: 20, zIndex: 100, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)')} style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={20} color={T.text} strokeWidth={2.5} />
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ backgroundColor: isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: T.border, borderRadius: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isOnline ? T.green : T.danger, opacity: pulseAnim }} />
            <Text style={{ fontSize: 11, fontWeight: '800', color: T.text, textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: font }}>{isOnline ? t('att_active') : t('att_offline')}</Text>
          </View>
          <View style={{ backgroundColor: isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: T.border, borderRadius: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <PackageCheck size={16} color={T.accent} strokeWidth={2.5} />
            <Text style={{ fontSize: 13, fontWeight: '900', color: T.text, fontFamily: font }}>{orderMarkers.length}</Text>
          </View>
        </View>
      </View>

      {/* DRAGGABLE DATA SHEET */}
      <Animated.View 
        style={{ 
          position: 'absolute', left: 0, right: 0, bottom: 0, top: sheetY,
          backgroundColor: isDark ? 'rgba(15,23,42,0.96)' : 'rgba(255,255,255,0.98)', 
          borderTopLeftRadius: 32, borderTopRightRadius: 32,
          borderWidth: 1, borderColor: T.border, borderBottomWidth: 0,
          elevation: 20, shadowColor: '#000', shadowOpacity: isDark ? 0.5 : 0.08, shadowRadius: 40
        }}
      >
        {/* Drag Handle Area */}
        <View {...panResponder.panHandlers} style={{ width: '100%', paddingVertical: 14, alignItems: 'center' }}>
          <Pressable onPress={toggleSheet} style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: T.border }} />
        </View>

        {/* Header Summary */}
        <View style={{ paddingHorizontal: 24, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: '900', color: T.text, marginBottom: 2, letterSpacing: -0.5, fontFamily: font }}>{t('att_log')}</Text>
            <Text style={{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, color: T.sub, fontFamily: font }}>{formatDateDayMonth(new Date().toISOString())}</Text>
          </View>
          <Pressable onPress={handleToggleDuty} disabled={loading} style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: isOnline ? `${T.danger}15` : `${T.green}15`, borderWidth: 1, borderColor: isOnline ? `${T.danger}30` : `${T.green}30`, alignItems: 'center', justifyContent: 'center' }}>
            {loading ? <ActivityIndicator size="small" color={isOnline ? T.danger : T.green} /> : <Power size={22} color={isOnline ? T.danger : T.green} strokeWidth={2.5} />}
          </Pressable>
        </View>

        {/* Scrollable Content */}
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          
          {/* STATS CHIPS */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            <View style={{ flex: 1, backgroundColor: `${T.accent}08`, borderWidth: 1, borderColor: `${T.accent}15`, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' }}>
                <LogIn size={20} color="#fff" strokeWidth={2.5} />
              </View>
              <View>
                <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', color: T.sub, marginBottom: 2, fontFamily: font }}>{t('att_checkin')}</Text>
                <Text style={{ fontSize: 16, fontWeight: '900', color: T.text, fontFamily: font }}>{checkInTime}</Text>
              </View>
            </View>
            <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', borderWidth: 1, borderColor: T.border, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: T.hi, alignItems: 'center', justifyContent: 'center' }}>
                <BarChart2 size={20} color={T.sub} strokeWidth={2.5} />
              </View>
              <View>
                <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', color: T.sub, marginBottom: 2, fontFamily: font }}>{t('att_deliveries')}</Text>
                <Text style={{ fontSize: 16, fontWeight: '900', color: T.text, fontFamily: font }}>{orderMarkers.length}</Text>
              </View>
            </View>
          </View>

          {/* WEEKLY ACTIVITY CHART */}
          <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderWidth: 1, borderColor: T.border, borderRadius: 24, padding: 24, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={16} color={T.accent} strokeWidth={2.5} />
                <Text style={{ fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, color: T.text, fontFamily: font }}>{t('att_weekly_act')}</Text>
              </View>
              <View style={{ flexDirection: 'row', backgroundColor: T.hi, borderRadius: 10, padding: 3 }}>
                {['week', 'history'].map(v => (
                  <Pressable key={v} onPress={() => setSummaryView(v as any)} style={{ backgroundColor: summaryView === v ? T.surface : 'transparent', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 }}>
                    <Text style={{ color: summaryView === v ? T.accent : T.sub, fontSize: 9, fontWeight: '800', textTransform: 'uppercase', fontFamily: font }}>{v === 'week' ? t('att_week') : t('att_history')}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {summaryView === 'week' ? (
              <View style={{ height: 120, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                {stats.map((day, i) => (
                  <View key={i} style={{ flex: 1, alignItems: 'center', gap: 10 }}>
                    <View style={{ width: '100%', height: 100, justifyContent: 'flex-end', alignItems: 'center' }}>
                      <View style={{ width: '80%', height: `${Math.max(day.height, 4)}%`, borderTopLeftRadius: 6, borderTopRightRadius: 6, overflow: 'hidden' }}>
                        <LinearGradient colors={day.height > 0 ? [T.accent, '#fb923c'] : [T.border, T.border]} style={{ flex: 1 }} />
                      </View>
                      {day.orders > 0 && <Text style={{ position: 'absolute', top: 100 - day.height - 18, fontSize: 8, fontWeight: '900', color: T.accent, fontFamily: font }}>{day.orders}</Text>}
                    </View>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: T.sub, textTransform: 'uppercase', fontFamily: font }}>{day.day}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                 <Text style={{ fontSize: 11, fontWeight: '600', color: T.sub, fontFamily: font }}>{t('att_detailed_logs')}</Text>
              </View>
            )}
          </View>

          {/* RECENT LOGS */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <History size={16} color={T.accent} strokeWidth={2.5} />
              <Text style={{ fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, color: T.text, fontFamily: font }}>{t('att_rider_hist')}</Text>
            </View>

            <View style={{ gap: 10 }}>
              {attendanceLogs.slice(0, 10).map((log) => {
                const isEx = expandedLog === log.id;
                const duration = ((log.totalMinutes || 0) / 60).toFixed(1);
                
                return (
                  <Pressable key={log.id} onPress={() => setExpandedLog(isEx ? null : log.id)} style={{ backgroundColor: T.hi, borderWidth: 1.5, borderColor: isEx ? T.accent : T.border, borderRadius: 20, overflow: 'hidden' }}>
                    <View style={{ paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 9, fontWeight: '900', color: T.accent, fontFamily: font }}>{getMonthShort(log.date)}</Text>
                          <Text style={{ fontSize: 16, fontWeight: '900', color: T.text, fontFamily: font }}>{new Date(log.date).getDate()}</Text>
                        </View>
                        <View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <Text style={{ fontSize: 13, fontWeight: '800', color: T.text, fontFamily: font }}>{formatDateDayMonth(log.date).split(',')[0]}</Text>
                            {log.totalOrders > 0 && (
                              <View style={{ backgroundColor: `${T.green}15`, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6 }}>
                                <Text style={{ fontSize: 8, fontWeight: '900', color: T.green, fontFamily: font }}>{log.totalOrders} {t('att_del')}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={{ fontSize: 10, color: T.sub, fontWeight: '700', fontFamily: font }}>{duration} {t('att_hours_worked')}</Text>
                        </View>
                      </View>
                      {isEx ? <ChevronUp size={16} color={T.accent} /> : <ChevronDown size={16} color={T.sub} />}
                    </View>

                    {isEx && (
                      <View style={{ paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center' }}>
                          <Text style={{ fontSize: 8, fontWeight: '800', color: T.sub, textTransform: 'uppercase', marginBottom: 4, fontFamily: font }}>{t('att_checkin')}</Text>
                          <Text style={{ fontSize: 13, fontWeight: '900', color: T.text, fontFamily: font }}>{log.checkInTime ? formatTime(log.checkInTime) : '--'}</Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center' }}>
                          <Text style={{ fontSize: 8, fontWeight: '800', color: T.sub, textTransform: 'uppercase', marginBottom: 4, fontFamily: font }}>{t('att_checkout')}</Text>
                          <Text style={{ fontSize: 13, fontWeight: '900', color: T.text, fontFamily: font }}>{log.checkOutTime ? formatTime(log.checkOutTime) : '--'}</Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: T.surface, borderWidth: 1, borderColor: `${T.accent}25`, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center' }}>
                          <Text style={{ fontSize: 8, fontWeight: '800', color: T.accent, textTransform: 'uppercase', marginBottom: 4, fontFamily: font }}>{t('att_orders')}</Text>
                          <Text style={{ fontSize: 13, fontWeight: '900', color: T.text, fontFamily: font }}>{log.totalOrders || 0}</Text>
                        </View>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

        </ScrollView>
      </Animated.View>
    </View>
  );
}
