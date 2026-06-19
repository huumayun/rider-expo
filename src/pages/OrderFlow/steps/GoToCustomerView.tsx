import React, { useState, useRef, useMemo, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Animated, Dimensions, PanResponder, Linking } from 'react-native';
import ReAnimated, { FadeInRight, FadeOutRight, useSharedValue, useAnimatedStyle, withDelay, withRepeat, withSequence, withTiming, FadeIn, FadeOut } from 'react-native-reanimated';
import { MapPin, Phone, Navigation, User, Info, AlertTriangle, CornerUpLeft, CornerUpRight, ArrowUp, Compass, Package, Banknote, Store, Truck, X, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ArrowUpLeft, ArrowUpRight } from 'lucide-react-native';
import { LargeTurnIndicator } from '../../../components/map/LargeTurnIndicator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../../context/AppContext';
import { translateInstruction } from '../../../components/map/mapUtils';
import { useUIStore } from '../../../store/uiStore';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SNAP_EXPANDED = SCREEN_HEIGHT * 0.42;
const SNAP_COLLAPSED = SCREEN_HEIGHT + 100; // Push completely off-screen so bottom buttons stay transparent over map

const ChevronTurnIndicator = React.memo(({ direction }: { direction: 'left' | 'right' | 'straight' }) => {
  const activeColor = '#fff'; // Standard clean white static arrow like Google Maps

  if (direction === 'left') {
    return <ChevronLeft size={36} color={activeColor} strokeWidth={4.5} />;
  }

  if (direction === 'right') {
    return <ChevronRight size={36} color={activeColor} strokeWidth={4.5} />;
  }

  return <ChevronUp size={36} color={activeColor} strokeWidth={4.5} />;
});

const getTurnDirection = (maneuver: string | undefined, instruction: string) => {
  const instr = (instruction || '').toLowerCase();
  if (maneuver?.includes('left') || instr.includes('left') || instr.includes('বামে')) {
    return 'left';
  }
  if (maneuver?.includes('right') || instr.includes('right') || instr.includes('ডানে')) {
    return 'right';
  }
  return 'straight';
};

const LivePulsatingDot = ({ isLive }: { isLive: boolean }) => {
  const pulse = useSharedValue(1);
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    if (isLive) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.6, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        false
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 1000 }),
          withTiming(0.4, { duration: 1000 })
        ),
        -1,
        false
      );
    } else {
      pulse.value = 1;
      opacity.value = 0.4;
    }
  }, [isLive]);

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: opacity.value,
  }));

  const activeColor = isLive ? '#ff4d6d' : '#10b981';

  return (
    <View style={{ width: 12, height: 12, alignItems: 'center', justifyContent: 'center' }}>
      {isLive && (
        <ReAnimated.View
          style={[
            glowStyle,
            {
              position: 'absolute',
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: activeColor,
            },
          ]}
        />
      )}
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: activeColor,
          borderWidth: 1,
          borderColor: '#fff',
        }}
      />
    </View>
  );
};

const LiveDot = React.memo(() => {
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800 }),
        withTiming(0.4, { duration: 800 })
      ),
      -1,
      true
    );
  }, []);

  const dotStyle = useAnimatedStyle(() => {
    return {
      opacity: pulse.value,
      transform: [{ scale: 0.8 + pulse.value * 0.4 }]
    };
  });

  return (
    <ReAnimated.View style={[{
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#22c55e',
      marginRight: 6,
    }, dotStyle]} />
  );
});
const LaneGuidance = React.memo(({ nextStep }: { nextStep: any }) => {
  const isLeft = nextStep?.maneuver?.includes('left') || nextStep?.instruction?.toLowerCase().includes('left') || nextStep?.instruction?.includes('বামে');
  const isRight = nextStep?.maneuver?.includes('right') || nextStep?.instruction?.toLowerCase().includes('right') || nextStep?.instruction?.includes('ডানে');
  const rawDist = nextStep?.rawDist;
  const isClose = rawDist !== undefined && rawDist <= 0.15; // Show within 150 meters

  if (!isClose) return null;

  return (
    <View style={{
      backgroundColor: 'transparent',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 4,
      zIndex: 10,
    }}>
      <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Lanes:
      </Text>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        {isLeft ? (
          <>
            <View style={{ width: 22, height: 22, borderRadius: 5, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowUpLeft size={14} color="#fff" strokeWidth={3.5} />
            </View>
            <View style={{ width: 22, height: 22, opacity: 0.35, alignItems: 'center', justifyContent: 'center' }}>
              <ArrowUp size={14} color="#fff" strokeWidth={3} />
            </View>
          </>
        ) : isRight ? (
          <>
            <View style={{ width: 22, height: 22, opacity: 0.35, alignItems: 'center', justifyContent: 'center' }}>
              <ArrowUp size={14} color="#fff" strokeWidth={3} />
            </View>
            <View style={{ width: 22, height: 22, borderRadius: 5, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowUpRight size={14} color="#fff" strokeWidth={3.5} />
            </View>
          </>
        ) : (
          <>
            <View style={{ width: 22, height: 22, borderRadius: 5, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowUp size={14} color="#fff" strokeWidth={3.5} />
            </View>
          </>
        )}
      </View>
    </View>
  );
});



export default React.memo(function GoToCustomerView({ 
  order, 
  riderLocation, 
  batchOrders = [], 
  currentIndex = 0, 
  onCancelRequest, 
  isNavigating, 
  setIsNavigating, 
  followMode, 
  routeInfo,
  branchData,
  orderStatus,
  routeDestination,
  customerData,
  mapTouchTime,
  heading
}: any) {
  const { T, theme, lang, font } = useApp();
  const insets = useSafeAreaInsets();
  
  const getCompassDirection = (h: number, l: string) => {
    const isBn = l === 'bn';
    const dirs = isBn 
      ? ['উত্তরে', 'উত্তর-পূর্বে', 'পূর্বে', 'দক্ষিণ-পূর্বে', 'দক্ষিণে', 'দক্ষিণ-পশ্চিমে', 'পশ্চিমে', 'উত্তর-পশ্চিমে']
      : ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
    const idx = Math.round(((h %= 360) < 0 ? h + 360 : h) / 45) % 8;
    return isBn ? `${dirs[idx]} যান` : `Head ${dirs[idx]}`;
  };

  const setIsOrderSheetOpen = useUIStore(s => s.setIsOrderSheetOpen);

  const getBannerInstructions = () => {
    const headingDirection = getCompassDirection(heading || 0, lang);
    const nextInstruction = translateInstruction(routeInfo.nextStep?.instruction || '', lang);
    const distanceToTurn = routeInfo.nextStep?.rawDist || 0; // in km

    // If we are far from the next turn (>= 100m) or there's no turn yet, tell rider to continue in current compass direction
    if (distanceToTurn >= 0.1 || !routeInfo.nextStep?.instruction) {
      return {
        main: headingDirection,
        sub: routeInfo.nextStep?.instruction 
          ? (lang === 'bn' ? `তারপর ${nextInstruction}` : `Then ${routeInfo.nextStep.instruction}`)
          : null
      };
    } else {
      // If we are very close to the turn (< 100m), show the turn maneuver in large text!
      return {
        main: nextInstruction,
        sub: lang === 'bn' ? 'তারপর সোজা চলুন' : 'Then head straight'
      };
    }
  };
  const [collapsed, setCollapsed] = useState(true);
  const [showFab, setShowFab] = useState(true);

  useEffect(() => {
    setShowFab(true);
    const timer = setTimeout(() => {
      setShowFab(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [mapTouchTime, collapsed]);
  
  const hasAutoNavigated = useRef(false);
  
  const sheetY = useRef(new Animated.Value(SNAP_EXPANDED)).current;

  const isNavMode = orderStatus === 'picked' || orderStatus === 'out_for_delivery' || isNavigating;

  const isDark = theme === 'dark';
  const cardBg = T.bg;
  const txt = T.text;
  const sub = T.sub;
  const brd = T.border;
  const rowBg = T.hi;
  const pillBg = T.surface;
  const pillBrd = T.border;

  // Auto-collapse sheet when entering out_for_delivery or when isNavigating turns true
  useEffect(() => {
    if ((isNavigating || isNavMode) && !hasAutoNavigated.current) {
      hasAutoNavigated.current = true;
      setCollapsed(true);
      Animated.spring(sheetY, {
        toValue: SNAP_COLLAPSED,
        useNativeDriver: false,
        stiffness: 380,
        damping: 36
      }).start();
      setIsOrderSheetOpen(false);
    } else if (!isNavigating && !isNavMode) {
      hasAutoNavigated.current = false;
    }
  }, [isNavigating, isNavMode]);

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
        const nextCollapsed = target === SNAP_COLLAPSED;
        setCollapsed(nextCollapsed);
        setIsOrderSheetOpen(!nextCollapsed);
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
    const nextCollapsed = !collapsed;
    setCollapsed(nextCollapsed);
    setIsOrderSheetOpen(!nextCollapsed);
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
      {/* ── LARGE TURN INDICATOR (PROXIMITY BASED) ── */}
      {isNavMode && (
        <LargeTurnIndicator 
          nextStep={routeInfo.nextStep} 
          isVisible={isNavigating && collapsed && followMode && routeInfo.nextStep?.rawDist < 0.1} 
        />
      )}

      {/* ── GOOGLE MAPS STYLE NAVIGATION HEADER ── */}
      {isNavMode && (
        <Animated.View style={{
          position: 'absolute',
          top: insets.top + 10,
          left: 12, right: 12,
          zIndex: 100,
        }}>
          {/* Main Instruction Banner */}
          <View style={{
            backgroundColor: '#0A4A40', // Deep green like Google Maps
            borderRadius: 16,
            paddingVertical: 18,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 8,
          }}>
            <View style={{ marginRight: 16 }}>
              <ChevronTurnIndicator 
                direction={getTurnDirection(
                  routeInfo.nextStep?.maneuver,
                  routeInfo.nextStep?.instruction || ''
                )} 
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: 0.5 }}>
                {getBannerInstructions().main}
              </Text>
              {getBannerInstructions().sub ? (
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#a7f3d0', marginTop: 3 }}>
                  {getBannerInstructions().sub}
                </Text>
              ) : null}
            </View>
            {routeInfo.duration ? (
              <View style={{ alignItems: 'flex-end', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.2)', paddingLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <LiveDot />
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>{routeInfo.duration.replace('mins', 'min')}</Text>
                </View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#a7f3d0', marginTop: 2 }}>{routeInfo.distance}</Text>
              </View>
            ) : null}
          </View>

          {/* Lanes & Secondary Next Turn Preview Container */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'transparent',
            marginTop: 4,
            paddingLeft: 8,
            gap: 8,
          }}>
            {/* Secondary Next Turn Preview */}
            {routeInfo.nextStep?.rawDist < 1 && (
              <View style={{
                backgroundColor: 'rgba(7, 51, 43, 0.85)', // Deep green dark transparent pill
                borderRadius: 12,
                paddingVertical: 6,
                paddingHorizontal: 12,
                flexDirection: 'row',
                alignItems: 'center',
                shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
              }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff', marginRight: 8 }}>Then</Text>
                <CornerUpLeft size={14} color="#fff" strokeWidth={3} />
              </View>
            )}

            {/* Lane Guidance (transparent) */}
            <LaneGuidance nextStep={routeInfo.nextStep} />
          </View>



          {/* Live indicator (Floating below banner) */}
          <View style={{ position: 'absolute', top: 16, right: 16, alignItems: 'center', gap: 3 }}>
            <LivePulsatingDot isLive={isNavigating} />
            <Text style={{ fontSize: 8, fontWeight: '900', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' }}>
              {isNavigating ? (lang === 'bn' ? 'লাইভ' : 'Live') : (lang === 'bn' ? 'বিরতি' : 'Off')}
            </Text>
          </View>
        </Animated.View>
      )}





      {/* ── FIXED QUICK-EXPAND BUTTON ── */}
      {collapsed && showFab && (
        <ReAnimated.View 
          entering={FadeInRight.duration(300)}
          exiting={FadeOutRight.duration(300)}
          style={{
          position: 'absolute',
          bottom: 110, // Safely above the bottom action footer
          right: 16,
          zIndex: 20,
        }}>
          <Pressable 
            onPress={toggleSheet}
            style={{
              backgroundColor: isDark ? 'rgba(30,30,45,0.95)' : 'rgba(255,255,255,0.95)',
              borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              borderRadius: 30,
              paddingVertical: 12, paddingHorizontal: 16, // slightly less horizontal padding to save space
              flexDirection: 'row', alignItems: 'center', gap: 6,
              shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 8,
            }}
          >
            <ArrowUp size={18} color={txt} strokeWidth={3} />
            <Text style={{ fontSize: 13, fontWeight: '900', color: txt, textTransform: 'uppercase', letterSpacing: 1 }}>
              {lang === 'bn' ? 'অর্ডার বিস্তারিত' : 'Order Details'}
            </Text>
          </Pressable>
        </ReAnimated.View>
      )}

      {/* ── GOOGLE MAPS STYLE BOTTOM ETA CARD ── */}
      <Animated.View
        style={{
          position: 'absolute', top: sheetY, left: 0, right: 0, bottom: -40,
          backgroundColor: isDark ? '#1e1e2d' : '#ffffff',
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 32, elevation: 20,
          zIndex: 10, overflow: 'hidden'
        }}
      >
        {/* Drag Handle Container */}
        <Animated.View
          {...panResponder.panHandlers}
          style={{ width: '100%', alignItems: 'center', backgroundColor: isDark ? '#1e1e2d' : '#ffffff' }}
        >
          <Pressable 
            onPress={toggleSheet} 
            style={{ width: '100%', paddingTop: 12, paddingBottom: 8, alignItems: 'center', justifyContent: 'center' }}
          >
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#d1d5db' }} />
          </Pressable>
        </Animated.View>

        {/* Minimal Bottom Handle View */}
        {collapsed && (
          <View style={{ alignItems: 'center', paddingBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#6b7280' }}>
              {lang === 'bn' ? 'উপরে সোয়াইপ করে অর্ডার দেখুন' : 'Swipe up for order details'}
            </Text>
          </View>
        )}

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140, gap: 12 }} scrollEnabled={!collapsed}>
          
          {/* ── ACTIVE CUSTOMER CARD ── */}
          <View style={{ backgroundColor: T.surface, borderWidth: 1, borderColor: brd, borderRadius: 22, padding: 18, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: 'rgba(99,102,241,.12)', borderWidth: 1, borderColor: 'rgba(99,102,241,.2)', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={22} color="#6366f1" strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: txt }}>{order.customer?.name || '—'}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                    <View style={{ backgroundColor: rowBg, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, borderWidth: 1, borderColor: brd }}>
                      <Text style={{ fontSize: 7, fontWeight: '900', color: sub }}>ID: {order.id}</Text>
                    </View>
                    <View style={{ backgroundColor: `${T.accent}15`, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, borderWidth: 1, borderColor: `${T.accent}25` }}>
                      <Text style={{ fontSize: 7, fontWeight: '900', color: T.accent, textTransform: 'uppercase' }}>{order.paymentMethod || 'COD'}</Text>
                    </View>
                  </View>
                </View>
              </View>
              {order.customer?.phone && (
                <Pressable onPress={() => Linking.openURL(`tel:${order.customer?.phone}`)} style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: T.green, alignItems: 'center', justifyContent: 'center', shadowColor: T.green, shadowOpacity: 0.4, shadowRadius: 16, elevation: 6, marginLeft: 10 }}>
                  <Phone size={20} color="#fff" strokeWidth={2.5} />
                </Pressable>
              )}
            </View>

            <View style={{ gap: 10, marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <MapPin size={14} color="#6366f1" strokeWidth={2} style={{ marginTop: 2 }} />
                <Text style={{ fontSize: 12, fontWeight: '500', fontStyle: 'italic', color: sub, flex: 1, lineHeight: 18 }}>
                  {order.customer?.address || (lang === 'bn' ? 'ঠিকানা পাওয়া যায়নি' : 'No address provided')}
                </Text>
              </View>
              {order.customer?.landmark && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: rowBg, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: brd }}>
                  <Info size={13} color={T.accent} strokeWidth={2} style={{ marginTop: 2 }} />
                  <View>
                    <Text style={{ fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, color: T.accent, marginBottom: 2 }}>
                      {lang === 'bn' ? 'ল্যান্ডমার্ক' : 'Landmark'}
                    </Text>
                    <Text style={{ fontSize: 11, color: txt, fontWeight: '500' }}>{order.customer.landmark}</Text>
                  </View>
                </View>
              )}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={onCancelRequest} style={{ width: 52, height: 52, borderRadius: 16, borderWidth: 1, borderColor: T.border, backgroundColor: rowBg, alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={18} color="#f87171" strokeWidth={2} />
              </Pressable>
            </View>

            {/* Navigate to Customer Button */}
            {isNavMode && (
              <Pressable
                onPress={() => {
                  const lat = order.customer?.location?.lat || order.customer?.lat || order.lat;
                  const lng = order.customer?.location?.lng || order.customer?.lng || order.lng;
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
                              #{ord.id}
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
                        ORDER #{ord.id}
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

          {/* ── DELIVERY INSTRUCTIONS ── */}
          <View style={{ backgroundColor: rowBg, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: brd }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Truck size={12} color={T.accent} strokeWidth={2} />
              <Text style={{ fontSize: 10, fontWeight: '800', color: txt }}>
                {lang === 'bn' ? 'ডেলিভারি নির্দেশাবলী' : 'Delivery Instructions'}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: sub, lineHeight: 18 }}>
              {lang === 'bn' 
                ? 'কাস্টমারের ঠিকানায় যান, ক্যাশ সংগ্রহ করুন (যদি ক্যাশ অন ডেলিভারি হয়) এবং ওটিপি কোড দিয়ে ডেলিভারি সম্পন্ন করুন।' 
                : 'Go to customer address, collect cash (if Cash on Delivery) and complete delivery using security OTP.'}
            </Text>
          </View>

        </ScrollView>
      </Animated.View>
    </View>
  );
});
