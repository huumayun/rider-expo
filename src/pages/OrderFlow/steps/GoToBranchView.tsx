import React, { useState, useRef, useMemo, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Animated, Dimensions, PanResponder, Linking } from 'react-native';
import { MapPin, Phone, Package, Banknote, CornerUpLeft, CornerUpRight, ArrowUp, Compass, Store, Navigation, Truck } from 'lucide-react-native';
import { LargeTurnIndicator } from '../../../components/map/LargeTurnIndicator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../../context/AppContext';
import RouteOverviewMap from '../../../components/map/RouteOverviewMap';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SNAP_EXPANDED = SCREEN_HEIGHT * 0.38;
const SNAP_COLLAPSED = SCREEN_HEIGHT * 0.88;

export default React.memo(function GoToBranchView({ 
  order, 
  riderLocation, 
  batchOrders = [], 
  currentIndex = 0, 
  isNavigating, 
  setIsNavigating, 
  followMode, 
  routeInfo,
  orderStatus,
  branchData,
  routeDestination,
  heading
}: any) {
  const { T, theme, lang, font } = useApp();
  const insets = useSafeAreaInsets();
  const [collapsed, setCollapsed] = useState(false);
  
  const sheetY = useRef(new Animated.Value(SNAP_EXPANDED)).current;
  const hasAutoNavigated = useRef(false);

  const isNavMode = orderStatus === 'go_to_branch';

  const isDark = theme === 'dark';
  const cardBg = T.bg;
  const txt = T.text;
  const sub = T.sub;
  const brd = T.border;
  const rowBg = T.hi;

  // ─── STATE ─────────────────────────────────────────────────────────────────
  const [distance, setDistance] = useState('--');
  const [duration, setDuration] = useState('--');

  // Auto-collapse sheet when entering go_to_branch
  useEffect(() => {
    if (isNavMode && !hasAutoNavigated.current) {
      hasAutoNavigated.current = true;
      setCollapsed(true);
      Animated.spring(sheetY, {
        toValue: SNAP_COLLAPSED,
        useNativeDriver: false,
        stiffness: 380,
        damping: 36
      }).start();
    }
  }, [isNavMode]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5, // Only hijack if moving vertically
      onPanResponderGrant: () => {
        sheetY.extractOffset(); // Preserve current position while dragging
      },
      onPanResponderMove: (_, gestureState) => {
        sheetY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        sheetY.flattenOffset(); // Merge offset into base value
        // Use gesture velocity combined with distance to determine snap target
        const isScrollingUp = gestureState.vy < -0.5 || gestureState.dy < -40;
        const target = isScrollingUp ? SNAP_EXPANDED : SNAP_COLLAPSED;
        setCollapsed(target === SNAP_COLLAPSED);
        Animated.spring(sheetY, {
          toValue: target,
          useNativeDriver: false,
          stiffness: 380,
          damping: 36
        }).start();
      }
    })
  ).current;

  const toggleSheet = () => {
    const target = collapsed ? SNAP_EXPANDED : SNAP_COLLAPSED;
    setCollapsed(!collapsed);
    Animated.spring(sheetY, {
      toValue: target,
      useNativeDriver: false,
      stiffness: 380,
      damping: 36
    }).start();
  };

  const branch = branchData || order.branchDetail || {};

  const ordersList = useMemo(() => {
    const list = batchOrders && batchOrders.length > 0 ? batchOrders : [order];
    return list.filter((o: any) => !['delivered', 'cancelled', 'returned', 'success', 'skipped'].includes(o.status));
  }, [batchOrders, order]);

  const totalBatchAmount = useMemo(() => 
    ordersList.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0),
    [ordersList]
  );
  const totalBatchItemsCount = useMemo(() =>
    ordersList.reduce((count: number, o: any) => count + (o.items?.length || 0), 0),
    [ordersList]
  );

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }} pointerEvents="box-none">

      {/* ── STATIC OVERVIEW MAP (assigned/accepted only) ── */}
      {!isNavMode && (
        <View style={{ position: 'absolute', inset: 0 }}>
          <RouteOverviewMap
            assignedOrders={ordersList}
            branches={{ [branch.id || order.branchId]: branch }}
            minimal={true}
            routeOrigin={riderLocation ? { latitude: riderLocation.lat, longitude: riderLocation.lng } : undefined}
            routeDestination={routeDestination ? { latitude: routeDestination.lat, longitude: routeDestination.lng } : undefined}
            accentColor={T.accent}
            navigationMode={false}
            livePos={riderLocation}
            heading={heading || 0}
            currentStatus={orderStatus}
            branchLocation={branch?.location ? { latitude: Number(branch.location.lat), longitude: Number(branch.location.lng) } : undefined}
            customerDestinations={ordersList.map((o: any) => {
              const loc = o.customer?.location || o.customer?.address;
              return loc?.lat ? { latitude: Number(loc.lat), longitude: Number(loc.lng) } : null;
            }).filter(Boolean)}
            onRouteReady={(info: any) => {
              if (info?.distance) setDistance(info.distance);
              if (info?.duration) setDuration(info.duration);
            }}
          />
        </View>
      )}

      {/* ── LARGE TURN INDICATOR (go_to_branch only) ── */}
      {isNavMode && (
        <LargeTurnIndicator
          nextStep={routeInfo.nextStep}
          isVisible={isNavigating && routeInfo.nextStep?.rawDist < 0.1}
        />
      )}

      {/* ── NAVIGATION HEADER (go_to_branch only) ── */}
      {isNavMode && (
        <Animated.View style={{
          position: 'absolute',
          top: insets.top + 10,
          left: 12, right: 12,
          height: 70,
          backgroundColor: isDark ? 'rgba(20,20,30,0.95)' : 'rgba(255,255,255,0.97)',
          borderRadius: 20,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          borderWidth: 1,
          borderColor: brd,
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 16,
          elevation: 12,
          zIndex: 100,
          gap: 10
        }}>
          {/* Compass / Re-center button */}
          <Pressable
            onPress={() => {
              if (!isNavigating) setIsNavigating(true);
              else setIsNavigating(true, true);
            }}
            style={{
              width: 46, height: 46, borderRadius: 14,
              backgroundColor: (isNavigating && followMode) ? '#ff4d6d' : T.accent,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: (isNavigating && followMode) ? '#ff4d6d' : T.accent,
              shadowOpacity: 0.35, shadowRadius: 8,
              borderWidth: (isNavigating && !followMode) ? 2 : 0,
              borderColor: '#fff'
            }}
          >
            <Compass size={22} color="#fff" strokeWidth={2.5} />
          </Pressable>

          {/* Next Turn */}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center' }}>
              {routeInfo.nextStep?.maneuver?.includes('left') ? (
                <CornerUpLeft size={26} color={T.green} strokeWidth={2.5} />
              ) : routeInfo.nextStep?.maneuver?.includes('right') ? (
                <CornerUpRight size={26} color={T.green} strokeWidth={2.5} />
              ) : (
                <ArrowUp size={26} color={T.green} strokeWidth={2.5} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1,
                color: routeInfo.nextStep?.rawDist < 0.1 ? '#ef4444' : routeInfo.nextStep?.rawDist < 0.25 ? '#f97316' : T.green
              }}>
                {routeInfo.nextStep?.distance || '--'} {lang === 'bn' ? 'পর' : 'left'}
              </Text>
              <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: txt }}>
                {routeInfo.nextStep?.instruction || (lang === 'bn' ? 'সরাসরি যান' : 'Go Straight')}
              </Text>
            </View>
          </View>

          <View style={{ width: 1, height: 28, backgroundColor: brd }} />

          {/* ETA + Distance */}
          <View style={{ alignItems: 'flex-end', minWidth: 46 }}>
            <Text style={{ fontSize: 7, fontWeight: '900', color: sub, textTransform: 'uppercase', marginBottom: 1 }}>
              {routeInfo.duration}
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '900', color: T.accent }}>
              {routeInfo.distance}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* ── STAT PILLS (visible when sheet is up, for assigned/accepted) ── */}
      {!isNavMode && !collapsed && (
        <Animated.View style={{
          position: 'absolute',
          top: sheetY,
          transform: [{ translateY: -72 }],
          left: 16, right: 16,
          flexDirection: 'row',
          justifyContent: 'space-between',
          zIndex: 20,
        }} pointerEvents="none">
          <View style={{
            backgroundColor: cardBg, borderWidth: 1, borderColor: brd, borderRadius: 16,
            paddingVertical: 10, paddingHorizontal: 16,
            shadowColor: '#000', shadowOpacity: isDark ? 0.5 : 0.08, shadowRadius: 16, elevation: 8,
          }}>
            <Text style={{ fontSize: 7, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, color: T.accent, marginBottom: 2 }}>
              {lang === 'bn' ? 'দূরত্ব' : 'Distance'}
            </Text>
            <Text style={{ fontFamily: font, fontSize: 22, color: txt, lineHeight: 24 }}>
              {distance}
            </Text>
          </View>
          <View style={{
            backgroundColor: cardBg, borderWidth: 1, borderColor: brd, borderRadius: 16,
            paddingVertical: 10, paddingHorizontal: 16, alignItems: 'flex-end',
            shadowColor: '#000', shadowOpacity: isDark ? 0.5 : 0.08, shadowRadius: 16, elevation: 8,
          }}>
            <Text style={{ fontSize: 7, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, color: sub, marginBottom: 2 }}>
              {lang === 'bn' ? 'আনুমানিক সময়' : 'Est. Time'}
            </Text>
            <Text style={{ fontFamily: font, fontSize: 22, color: txt, lineHeight: 24 }}>
              {duration}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* ── COLLAPSED QUICK-EXPAND BUTTON ── */}
      {collapsed && (
        <Animated.View style={{
          position: 'absolute',
          top: sheetY,
          transform: [{ translateY: -64 }],
          left: 0, right: 0,
          alignItems: 'center',
          zIndex: 20,
        }}>
          <Pressable 
            onPress={toggleSheet}
            style={{
              backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)',
              borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              borderRadius: 30,
              paddingVertical: 10, paddingHorizontal: 20,
              flexDirection: 'row', alignItems: 'center', gap: 8,
            }}
          >
            <ArrowUp size={16} color={txt} strokeWidth={3} />
            <Text style={{ fontSize: 12, fontWeight: '800', color: txt, textTransform: 'uppercase', letterSpacing: 1 }}>
              {lang === 'bn' ? 'অর্ডার বিস্তারিত' : 'Order Details'}
            </Text>
          </Pressable>
        </Animated.View>
      )}

      {/* ── SWIPEABLE BOTTOM SHEET ── */}
      <Animated.View
        style={{
          position: 'absolute', top: sheetY, left: 0, right: 0, bottom: -40,
          backgroundColor: cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 32, elevation: 20,
          borderWidth: 1, borderColor: brd, borderBottomWidth: 0,
          zIndex: 10, overflow: 'hidden'
        }}
      >
        {/* Drag Handle Container (Expanded touch area) */}
        <Animated.View
          {...panResponder.panHandlers}
          style={{ width: '100%', alignItems: 'center', backgroundColor: cardBg }}
        >
          <Pressable 
            onPress={toggleSheet} 
            style={{ width: '100%', paddingTop: 24, paddingBottom: collapsed ? 24 : 16, alignItems: 'center', justifyContent: 'center' }}
          >
            <View style={{ width: 44, height: 5, borderRadius: 99, backgroundColor: isDark ? 'rgba(255,255,255,.3)' : 'rgba(0,0,0,.15)' }} />
          </Pressable>
        </Animated.View>

        {collapsed && (
          <Text style={{ textAlign: 'center', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, color: sub, marginBottom: 18 }}>
            {lang === 'bn' ? '↑ উপরে টানুন' : '↑ Swipe up for details'}
          </Text>
        )}

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140, gap: 12 }} scrollEnabled={!collapsed}>

          {/* ── ROUTE CARD: Pickup → Delivery ── */}
          <View style={{ backgroundColor: T.surface, borderWidth: 1, borderColor: brd, borderRadius: 22, padding: 18, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', gap: 14 }}>
              {/* Dotted Line Connector */}
              <View style={{ alignItems: 'center', paddingTop: 4 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 3, borderColor: T.accent, backgroundColor: cardBg }} />
                <View style={{ width: 2, flex: 1, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: `${T.green}66`, marginVertical: 4 }} />
                <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 3, borderColor: T.green, backgroundColor: cardBg }} />
              </View>

              <View style={{ flex: 1, gap: 18 }}>
                {/* Pickup Section */}
                <View>
                  <Text style={{ fontSize: 8, fontWeight: '800', letterSpacing: 2.5, textTransform: 'uppercase', color: T.accent, marginBottom: 4 }}>
                    {lang === 'bn' ? 'পিকআপ (শাখা)' : 'Pickup (Branch)'}
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: txt, marginBottom: 2 }}>
                        {branch.name || (lang === 'bn' ? 'লোড হচ্ছে…' : 'Loading…')}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 2 }}>
                        <MapPin size={12} color="#3b82f6" strokeWidth={2} style={{ marginTop: 2 }} />
                        <Text style={{ fontSize: 11, fontWeight: '500', fontStyle: 'italic', color: sub, flex: 1, lineHeight: 16 }}>
                          {branch.address || (lang === 'bn' ? 'ঠিকানা নেই' : 'No address')}
                        </Text>
                      </View>
                    </View>
                    {branch.phone && (
                      <Pressable onPress={() => Linking.openURL(`tel:${branch.phone}`)} style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center', shadowColor: T.accent, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4, marginLeft: 10 }}>
                        <Phone size={18} color="#fff" strokeWidth={2.5} />
                      </Pressable>
                    )}
                  </View>
                </View>

                {/* Delivery Destinations */}
                <View style={{ gap: 14 }}>
                  <Text style={{ fontSize: 8, fontWeight: '800', letterSpacing: 2.5, textTransform: 'uppercase', color: T.green, marginBottom: -4 }}>
                    {lang === 'bn' ? 'ডেলিভারি গন্তব্যসমূহ' : 'Delivery Destinations'}
                  </Text>
                  {ordersList.map((ord: any, idx: number) => (
                    <View key={ord.id} style={{ borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: brd, paddingTop: idx > 0 ? 12 : 0 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <View style={{ backgroundColor: `${T.green}20`, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6 }}>
                              <Text style={{ fontSize: 9, fontWeight: '900', color: T.green }}>
                                {lang === 'bn' ? `ড্রপ ${idx + 1}` : `Drop ${idx + 1}`}
                              </Text>
                            </View>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: sub }}>
                              #{ord.seq || ord.id.slice(-5).toUpperCase()}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: txt }}>{ord.customer?.name || '—'}</Text>
                        </View>
                        {ord.customer?.phone && (
                          <Pressable onPress={() => Linking.openURL(`tel:${ord.customer.phone}`)} style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: T.green, alignItems: 'center', justifyContent: 'center', shadowColor: T.green, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3 }}>
                            <Phone size={14} color="#fff" strokeWidth={2.5} />
                          </Pressable>
                        )}
                      </View>
                      <Text style={{ fontSize: 11, fontWeight: '500', fontStyle: 'italic', color: sub, lineHeight: 16 }}>
                        {ord.customer?.address || (lang === 'bn' ? 'ঠিকানা নেই' : 'No address')}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Navigate to Branch Button (go_to_branch only) */}
            {isNavMode && (
              <Pressable
                onPress={() => {
                  const lat = branch.location?.lat || branch.lat;
                  const lng = branch.location?.lng || branch.lng;
                  if (lat && lng) {
                    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving&dir_action=navigate`);
                  }
                }}
                style={{
                  marginTop: 20, height: 52, borderRadius: 16,
                  backgroundColor: T.accent,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                  shadowColor: T.accent, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
                }}
              >
                <Navigation size={16} color="#fff" strokeWidth={2.5} />
                <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                  {lang === 'bn' ? 'গুগল ম্যাপে নেভিগেট' : 'Navigate in Google Maps'}
                </Text>
              </Pressable>
            )}
          </View>

          {/* ── PACKAGE ITEMS ── */}
          <View style={{ backgroundColor: rowBg, borderWidth: 1, borderColor: brd, borderRadius: 20, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Package size={12} color={T.accent} strokeWidth={2} />
              <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2.5, color: sub }}>
                {lang === 'bn' ? 'প্যাকেজ আইটেমসমূহ' : 'All Package Items'}
              </Text>
              <View style={{ marginLeft: 'auto', backgroundColor: `${T.accent}16`, borderWidth: 1, borderColor: `${T.accent}26`, borderRadius: 99, paddingVertical: 2, paddingHorizontal: 8 }}>
                <Text style={{ fontSize: 8, fontWeight: '900', color: T.accent }}>{totalBatchItemsCount}</Text>
              </View>
            </View>

            <View style={{ gap: 14 }}>
              {ordersList.map((ord: any) => (
                <View key={ord.id}>
                  {ordersList.length > 1 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: T.accent }} />
                      <Text style={{ fontSize: 10, fontWeight: '800', color: txt, textTransform: 'uppercase' }}>
                        ORDER #{ord.seq || ord.id.slice(-5).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ gap: 7, paddingLeft: ordersList.length > 1 ? 12 : 0 }}>
                    {ord.items?.map((item: any, idx: number) => (
                      <View key={idx} style={{
                        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                        backgroundColor: T.surface, borderRadius: 13, paddingVertical: 10, paddingHorizontal: 13,
                        borderWidth: 1, borderColor: brd,
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 }}>
                          <Text style={{ fontSize: 11, fontWeight: '900', color: T.accent }}>{item.qty || item.quantity}x</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: txt, lineHeight: 14 }}>
                              {lang === 'bn' ? (item.name_bn || item.name_en || item.name) : (item.name_en || item.name_bn || item.name)}
                            </Text>
                            {item.selectedVariation && (
                              <Text style={{ fontSize: 9, fontWeight: '800', color: T.accent, marginTop: 2 }}>
                                {lang === 'bn' ? item.selectedVariation.label_bn : item.selectedVariation.label_en}
                              </Text>
                            )}
                          </View>
                        </View>
                        <Text style={{ fontSize: 11, fontWeight: '900', color: txt }}>৳{item.total || item.price}</Text>
                      </View>
                    ))}
                    {(!ord.items || ord.items.length === 0) && (
                      <Text style={{ fontSize: 10, color: sub, fontStyle: 'italic' }}>
                        {lang === 'bn' ? 'কোনো আইটেম নেই' : 'No items listed'}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>

            {/* Total Bill */}
            <View style={{
              marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: brd,
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Banknote size={14} color={sub} strokeWidth={2} />
                <Text style={{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, color: txt }}>
                  {lang === 'bn' ? 'মোট বিল' : 'Total Bill'}
                </Text>
              </View>
              <Text style={{ fontFamily: font, fontSize: 24, color: T.accent }}>
                ৳{totalBatchAmount}
              </Text>
            </View>
          </View>

          {/* ── PICKUP INSTRUCTIONS (assigned/accepted only) ── */}
          {!isNavMode && (
            <View style={{ backgroundColor: rowBg, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: brd }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Truck size={12} color={T.accent} strokeWidth={2} />
                <Text style={{ fontSize: 10, fontWeight: '800', color: txt }}>
                  {lang === 'bn' ? 'পিকআপ নির্দেশাবলী' : 'Pickup Instructions'}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: sub, lineHeight: 18 }}>
                {lang === 'bn' 
                  ? 'অর্ডার গ্রহণ করুন, ব্রাঞ্চে যান, পার্সেলগুলো সংগ্রহ করুন এবং অ্যাপে নিশ্চিত করুন।' 
                  : 'Accept the order, go to the branch, collect the parcels and confirm in the app.'}
              </Text>
            </View>
          )}

        </ScrollView>
      </Animated.View>
    </View>
  );
});