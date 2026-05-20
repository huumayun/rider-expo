import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Dimensions, Modal, ActivityIndicator, BackHandler } from 'react-native';
import Animated, { FadeIn, FadeOut, FadeInRight, FadeOutLeft, FadeInUp, LinearTransition, useAnimatedStyle, withTiming, withSequence, useSharedValue, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { doc, updateDoc, serverTimestamp, writeBatch, arrayUnion, onSnapshot, query, collection, where } from 'firebase/firestore';
import { X, ChevronRight, XCircle, PackageCheck, CheckCircle2, Package, MessageSquare, ChevronDown, ListOrdered, CornerUpLeft, AlertCircle, Store } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { useRouter, useLocalSearchParams } from 'expo-router';

import GoToBranchView from '../OrderFlow/steps/GoToBranchView';
import ArrivedAtBranchView from '../OrderFlow/steps/ArrivedAtBranchView';
import GoToCustomerView from '../OrderFlow/steps/GoToCustomerView';
import ArrivedAtCustomerView from '../OrderFlow/steps/ArrivedAtCustomerView';
import SuccessView from '../OrderFlow/steps/SuccessView';
import CancelledView from '../OrderFlow/steps/CancelledView';
import { useRiderData } from '../../context/RiderDataContext';
import { useUIStore } from '../../store/uiStore';
import ChatWindow from '../../components/chat/ChatWindow';
import { ref as dbRef, onValue } from 'firebase/database';
import { rtdb, storage } from '../../config/firebase';
import { RTDB_PATHS } from '../../config/constants';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import DeliveryConfirmation from '../../components/modals/DeliveryConfirmation';
import ReturnOrderModal from '../../components/modals/ReturnOrderModal';
import RouteOverviewMap from '../../components/map/RouteOverviewMap';
import { useAutoNavigation } from '../../hooks/useAutoNavigation';
import { useLocationStore } from '../../store/locationStore';

// Realtime UnreadBadge for Footer
const UnreadBadge = React.memo(({ count, bg }: { count: number, bg: string }) => {
  if (count === 0) return null;
  return (
    <View style={{ position: 'absolute', top: -5, right: -5, minWidth: 20, height: 20, backgroundColor: '#fb923c', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: bg, elevation: 4 }}>
      <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>{count}</Text>
    </View>
  );
});

const ReturnInProgressView = React.memo(({ order }: { order: any }) => {
  const { T, t, lang, font } = useApp();
  return (
    <View style={{ flex: 1, backgroundColor: T.bg, padding: 24, paddingTop: 80, alignItems: 'center' }}>
      <View style={{ alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(249,115,22,.12)', borderWidth: 2, borderColor: 'rgba(249,115,22,.3)', alignItems: 'center', justifyContent: 'center' }}>
          <CornerUpLeft size={36} color="#f97316" strokeWidth={2} />
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 3, textTransform: 'uppercase', color: '#f97316', marginBottom: 4 }}>
            {lang === 'bn' ? 'ফেরত যাচ্ছে' : 'Returning to Branch'}
          </Text>
          <Text style={{ fontFamily: font, fontSize: 30, letterSpacing: 2, color: T.text }}>
            #{order.seq || order.id?.slice(-6).toUpperCase()}
          </Text>
        </View>
      </View>

      {(order.returnNote || order.returnReason) && (
        <View style={{ width: '100%', backgroundColor: T.surface, borderWidth: 1, borderColor: 'rgba(249,115,22,.2)', borderRadius: 20, padding: 18, marginBottom: 20 }}>
          <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, color: '#f97316', marginBottom: 8 }}>
            {lang === 'bn' ? 'ফেরতের কারণ' : 'Return Reason'}
          </Text>
          {order.returnReason && (
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#ea580c', marginBottom: 6, lineHeight: 22 }}>
              {order.returnReason}
            </Text>
          )}
          {order.returnNote && (
            <Text style={{ fontSize: 13, fontWeight: '500', color: T.text, lineHeight: 20 }}>
              {order.returnNote}
            </Text>
          )}
        </View>
      )}

      <View style={{ width: '100%', backgroundColor: T.hi, borderWidth: 1, borderColor: T.border, borderRadius: 16, padding: 16, alignItems: 'center' }}>
        <Text style={{ fontSize: 13, color: T.sub, lineHeight: 20, fontWeight: '500', textAlign: 'center' }}>
          {lang === 'bn'
            ? 'ব্রাঞ্চে পৌঁছে পণ্যটি জমা দিন। অ্যাডমিন এটি রিসিভ করলে অর্ডারটি আপনার লিস্ট থেকে মুছে যাবে।'
            : 'Go back to branch and hand over the parcel. It will be removed once the admin receives it.'}
        </Text>
      </View>
    </View>
  );
});

const PickedSuccessView = React.memo(({ orders, onContinue }: { orders: any[], onContinue: () => void }) => {
  const { T, t, lang, font } = useApp();
  
  const aggregatedItems = useMemo(() => {
    const map: Record<string, any> = {};
    orders.forEach(o => {
      (o.items || []).forEach((item: any) => {
        const vKey = item.selectedVariation ? (item.selectedVariation.label_en || item.selectedVariation.label_bn) : '';
        const key = (item.productId || item.id || (item.name_en + item.name_bn)) + vKey;
        if (!map[key]) map[key] = { ...item, qty: 0 };
        map[key].qty += item.qty;
      });
    });
    return Object.values(map);
  }, [orders]);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg, zIndex: 10 }}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', padding: 24, paddingBottom: 120, gap: 28 }}>
        <View style={{ width: 80, height: 80, backgroundColor: T.green, borderRadius: 24, alignItems: 'center', justifyContent: 'center', shadowColor: '#22d47a', shadowOpacity: 0.4, shadowRadius: 20, elevation: 10 }}>
          <PackageCheck size={40} color="#fff" />
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: font, fontSize: 30, letterSpacing: 2, color: T.text, marginBottom: 6 }}>{t('exec_picked_title')}</Text>
          <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, color: T.sub }}>
            {orders.length > 1 ? (lang === 'bn' ? `এই ব্যাচে ${orders.length}টি অর্ডার আছে` : `${orders.length} orders in this trip`) : t('exec_picked_sub')}
          </Text>
        </View>

        <View style={{ width: '100%', maxWidth: 360, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 24, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: T.border, marginBottom: 12 }}>
            <Package size={13} color={T.accent} strokeWidth={2} />
            <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2.5, color: T.sub }}>{t('exec_summary')}</Text>
          </View>
          <View style={{ gap: 8, maxHeight: 192 }}>
            {aggregatedItems.map((item, idx) => (
              <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: T.hi, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: T.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: `${T.green}18`, alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle2 size={14} color={T.green} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: T.text, lineHeight: 14 }} numberOfLines={1}>
                      {lang === 'bn' ? (item.name_bn || item.name_en) : (item.name_en || item.name_bn)}
                    </Text>
                    <Text style={{ fontSize: 9, color: T.accent, marginTop: 2, fontWeight: '800' }}>
                      {item.selectedVariation ? (lang === 'bn' ? item.selectedVariation.label_bn : item.selectedVariation.label_en) : item.category}
                    </Text>
                  </View>
                </View>
                <View style={{ backgroundColor: `${T.accent}18`, borderWidth: 1, borderColor: `${T.accent}30`, borderRadius: 99, paddingVertical: 2, paddingHorizontal: 10 }}>
                  <Text style={{ fontSize: 9, fontWeight: '900', color: T.accent }}>{item.qty}x</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, zIndex: 20 }}>
        <Pressable onPress={onContinue} style={{ width: '100%', height: 60, borderRadius: 20, backgroundColor: T.text, alignItems: 'center', justifyContent: 'center', shadowColor: T.text, shadowOpacity: 0.25, shadowRadius: 15, elevation: 8 }}>
          <Text style={{ color: T.bg, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2.5 }}>
            {lang === 'bn' ? 'ডেলিভারি শুরু করুন' : 'Start Delivery Trip'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

const BatchOverviewDrawer = React.memo(({ liveOrders, currentIndex, setCurrentIndex, onClose }: any) => {
  const { T, lang, font, theme } = useApp();
  return (
    <Modal transparent animationType="fade" visible={true} onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }} onPress={onClose} />
      <Animated.View 
        entering={SlideInDown.springify().damping(20)}
        style={{ 
          position: 'absolute', bottom: 0, left: 0, right: 0, 
          backgroundColor: T.surface, 
          borderTopLeftRadius: 32, borderTopRightRadius: 32, 
          paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40, 
          maxHeight: '85%',
          shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20
        }}
      >
        <View style={{ width: 40, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20, opacity: 0.5 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <View>
            <Text style={{ fontFamily: font, fontSize: 24, fontWeight: '900', color: T.text }}>
              {lang === 'bn' ? 'ট্রিপ ওভারভিউ' : 'Trip Overview'}
            </Text>
            <Text style={{ fontSize: 12, color: T.sub, fontWeight: '600', marginTop: 2 }}>
              {liveOrders.length} {lang === 'bn' ? 'টি গন্তব্য বাকি' : 'destinations remaining'}
            </Text>
          </View>
          <Pressable onPress={onClose} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: T.hi, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.border }}>
            <X size={22} color={T.text} />
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
          {liveOrders.map((o: any, idx: number) => {
            const isActive = idx === currentIndex;
            const isPickup = o.status === 'accepted' || o.status === 'arrived_at_branch';
            return (
              <Pressable 
                key={o.id} 
                onPress={() => { setCurrentIndex(idx); onClose(); }}
                style={{ 
                  backgroundColor: isActive ? `${T.accent}08` : T.hi, 
                  borderWidth: 1.5, 
                  borderColor: isActive ? T.accent : T.border, 
                  borderRadius: 20, padding: 16, 
                  flexDirection: 'row', gap: 14
                }}
              >
                <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: isActive ? T.accent : `${T.sub}15`, alignItems: 'center', justifyContent: 'center' }}>
                  {isPickup ? (
                    <Store size={22} color={isActive ? '#fff' : T.sub} />
                  ) : (
                    <Package size={22} color={isActive ? '#fff' : T.sub} />
                  )}
                  <View style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: T.text }}>{idx + 1}</Text>
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: T.text }}>
                      #{o.seq || o.id.slice(-6).toUpperCase()}
                    </Text>
                    <View style={{ backgroundColor: isPickup ? '#f59e0b22' : '#22c55e22', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 6 }}>
                      <Text style={{ fontSize: 9, fontWeight: '900', color: isPickup ? '#f59e0b' : '#22c55e', textTransform: 'uppercase' }}>
                        {isPickup ? (lang === 'bn' ? 'পিকআপ' : 'PICKUP') : (lang === 'bn' ? 'ড্রপ' : 'DROP')}
                      </Text>
                    </View>
                  </View>
                  <Text numberOfLines={1} style={{ fontSize: 12, color: T.sub, fontWeight: '500' }}>
                    {isPickup ? (o.branchDetail?.name || 'Branch') : (o.customer?.address || 'Customer Address')}
                  </Text>
                </View>
                
                {isActive && (
                  <View style={{ alignSelf: 'center' }}>
                    <ChevronRight size={20} color={T.accent} />
                  </View>
                )}
              </Pressable>
            )
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
});

export default function OrderExecution({ batchOrders = [], order = null, onMinimize, onFinish }: any) {
  const { activeOrders: contextActiveOrders, loading: contextLoading } = useRiderData();
  const branches: any[] = []; // Placeholder or fetch from context if available
  const router = useRouter();
  const { batchId } = useLocalSearchParams();

  const initOrders = useMemo(() => {
    if (batchOrders && batchOrders.length > 0) return batchOrders;
    if (order) return [order];

    if (batchId) {
      const filtered = contextActiveOrders.filter((o: any) => (o.batchId || o.id) === batchId);
      if (filtered.length > 0) return filtered;
    }

    return contextActiveOrders;
  }, [batchOrders, order, contextActiveOrders, batchId]);

  const initialBatchSize = useRef(initOrders.length);
  useEffect(() => {
    initialBatchSize.current = initOrders.length;
  }, [initOrders.length]);

  const { T, t, theme, lang, showToast, font } = useApp();
  const insets = useSafeAreaInsets();
  const setIsExecuting = useUIStore(s => s.setIsExecuting);

  useEffect(() => {
    setIsExecuting(true);
    return () => setIsExecuting(false);
  }, [setIsExecuting]);

  useEffect(() => {
    const backAction = () => {
      if (onMinimize) {
        onMinimize();
        return true;
      }
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [onMinimize, router]);

  const isDark = theme === 'dark';
  const surfHi = isDark ? T.hi : '#f4f4f9';

  const orderIdsString = useMemo(() => initOrders.map((o: any) => o.id).sort().join(','), [initOrders]);

  const [liveOrders, setLiveOrders] = useState<any[]>(initOrders);
  const [currentIndex, setCurrentIndex] = useState(0);

  // --- Intelligent Sorting Logic ---
  const sortedOrders = useMemo(() => {
    return [...liveOrders].sort((a, b) => {
      const isPickupA = a.status === 'accepted' || a.status === 'arrived_at_branch';
      const isPickupB = b.status === 'accepted' || b.status === 'arrived_at_branch';
      if (isPickupA && !isPickupB) return -1;
      if (!isPickupA && isPickupB) return 1;
      return (a.seq || 0) - (b.seq || 0);
    });
  }, [liveOrders]);

  useEffect(() => {
    if (sortedOrders.length > 0 && sortedOrders[currentIndex]?.status === 'delivered') {
      const nextIdx = sortedOrders.findIndex(o => o.status !== 'delivered' && o.status !== 'returned');
      if (nextIdx !== -1) setCurrentIndex(nextIdx);
    }
  }, [sortedOrders, currentIndex]);

  useEffect(() => {
    if (initOrders.length > 0) {
      setLiveOrders(prev => {
        const currentIds = prev.map((o: any) => o.id).sort().join(',');
        const newIds = initOrders.map((o: any) => o.id).sort().join(',');
        if (currentIds !== newIds) return initOrders;
        return prev;
      });
    }
  }, [orderIdsString]);

  const [otpOrder, setOtpOrder] = useState<any>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showOverviewDrawer, setShowOverviewDrawer] = useState(false);
  const { currentLocation: riderLocation, heading, speed } = useLocationStore();
  const [isPicking, setIsPicking] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [pickupPhotos, setPickupPhotos] = useState<any>({});
  const [isVerified, setIsVerified] = useState(false);
  const [isPickedSuccess, setIsPickedSuccess] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  
  const [isNavigating, setIsNavigatingState] = useState(false);
  const [followMode, setFollowMode] = useState(true);
  const [routeInfo, setRouteInfo] = useState({ distance: '--', duration: '--' });

  const setIsNavigating = useCallback((val: boolean, forceFollow: boolean = false) => {
    setIsNavigatingState(val);
    if (forceFollow) setFollowMode(true);
    else if (!val) setFollowMode(true);
  }, []);
  const [branchData, setBranchData] = useState<any>(null);

  const FLOW_CONFIG: Record<string, any> = {
    assigned: { textKey: 'flow_assigned', next: 'accepted', grad: '#22d47a', canCancel: true },
    accepted: { textKey: 'flow_go_branch', next: 'go_to_branch', grad: T.accent, canCancel: true },
    go_to_branch: { textKey: 'flow_accepted', next: 'arrived_at_branch', grad: T.accent },
    arrived_at_branch: { textKey: 'flow_at_branch', next: 'picked', grad: '#3b82f6' },
    picked: { textKey: 'flow_picked', next: 'out_for_delivery', grad: '#6366f1' },
    out_for_delivery: { textKey: 'flow_out_delivery', next: 'arrived_at_customer', grad: '#a855f7' },
    arrived_at_customer: { textKey: 'flow_at_customer', next: 'delivered', grad: '#22d47a', isOTP: true },
    delivered: { textKey: 'flow_delivered', finished: true, grad: '#374151' },
    returning_to_branch: { textKey: 'flow_returning', finished: true, grad: '#f97316', isReturn: true },
    returned: { textKey: 'flow_returned', finished: true, grad: '#ef4444' },
  };

  const activeOrder = sortedOrders[currentIndex] || sortedOrders[0];
  const [visualStatus, setVisualStatus] = useState<string | null>(null);

  useEffect(() => {
    if (activeOrder?.status && (!loadingAction || !visualStatus)) {
      setVisualStatus(activeOrder.status);
    }
  }, [activeOrder?.id, activeOrder?.status, loadingAction]);

  const currentStatus = visualStatus || activeOrder?.status || 'delivered';
  const isBatchMode = initialBatchSize.current > 1;

  const totalUnread = useMemo(() => Object.values(unreadCounts).reduce((a, b) => a + b, 0), [unreadCounts]);

  // 1. Optimized Listener (Single Listener for all orders)
  useEffect(() => {
    if (liveOrders.length === 0) return;
    
    // Batch updates to prevent multiple re-renders
    const ids = liveOrders.map(o => o.id);
    
    // Listen to all relevant orders in one go if batchId exists
    const bid = batchId || liveOrders[0].batchId;
    let unsub: any;
    
    if (bid) {
      const q = query(collection(db, 'orders'), where('batchId', '==', bid));
      unsub = onSnapshot(q, (snap: any) => {
        const updated = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        setLiveOrders(prev => {
          const changed = updated.some((u: any) => {
            const p = prev.find(x => x.id === u.id);
            return !p || p.status !== u.status || p.updatedAt?.seconds !== (u as any).updatedAt?.seconds;
          });
          return changed ? updated : prev;
        });
      });
    }

    // Chat unread listeners (still needed per order, but we can optimize the state update)
    const chatUnsubs = liveOrders.map(o => {
      const chatRef = dbRef(rtdb, RTDB_PATHS.chat(o.id));
      return onValue(chatRef, (snap) => {
        const count = snap.exists() ? Object.values(snap.val() as any).filter((m: any) => m.senderRole === 'customer' && !m.read).length : 0;
        setUnreadCounts(prev => prev[o.id] === count ? prev : { ...prev, [o.id]: count });
      });
    });

    return () => {
      if (unsub) unsub();
      chatUnsubs.forEach(u => u());
    };
  }, [orderIdsString, batchId]);

  // 3. Rider Location listener
  // Location tracking is now handled by Zustand useLocationStore

  useEffect(() => {
    if (liveOrders.length === 0) return;
    const curStatus = (liveOrders[currentIndex] as any)?.status;
    const isCompleted = ['delivered', 'success', 'cancelled', 'rescheduled', 'skipped', 'returned'].includes(curStatus);
    if (isCompleted) {
      const nextIncomplete = liveOrders.findIndex((o: any) => !['delivered', 'success', 'cancelled', 'rescheduled', 'skipped', 'returned'].includes(o.status));
      if (nextIncomplete !== -1 && nextIncomplete !== currentIndex) {
        setCurrentIndex(nextIncomplete);
      }
    }
  }, [liveOrders, currentIndex]);

  // Sync Branch Data for Map
  useEffect(() => {
    if (activeOrder?.branchId) {
      const bRef = doc(db, 'branches', activeOrder.branchId);
      onSnapshot(bRef, (snap) => {
        if (snap.exists()) setBranchData(snap.data());
      });
    }
  }, [activeOrder?.branchId]);

  const routeDestination = useMemo(() => {
    const isBeforePick = ['assigned', 'accepted', 'go_to_branch', 'arrived_at_branch'].includes(currentStatus);
    if (isBeforePick && branchData?.location) {
      return { lat: Number(branchData.location.lat), lng: Number(branchData.location.lng) };
    }
    if (activeOrder?.customer?.location) {
      return { lat: Number(activeOrder.customer.location.lat), lng: Number(activeOrder.customer.location.lng) };
    }
    return null;
  }, [currentStatus, branchData, activeOrder]);

  useAutoNavigation(isNavigating ? routeDestination : null);

  const flow = FLOW_CONFIG[currentStatus] || { textKey: 'flow_waiting', finished: true, grad: '#374151' };
  const isMapView = !isPicking && ['go_to_branch', 'picked', 'out_for_delivery'].includes(currentStatus);
  const hasNavHeader = ['go_to_branch', 'picked', 'out_for_delivery'].includes(currentStatus);

  const allPhotosTaken = useMemo(() => (liveOrders || []).every((o: any) => !!pickupPhotos[o.id]), [liveOrders, pickupPhotos]);
  const isButtonDisabled = (currentStatus === 'arrived_at_branch') && (!isVerified || !allPhotosTaken);

  const buttonScale = useSharedValue(1);
  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
    backgroundColor: withTiming(isButtonDisabled ? T.border : flow.grad, { duration: 400 })
  }));

  const handleAction = async (isCancel = false) => {
    if (loadingAction) return;
    setLoadingAction(true);
    buttonScale.value = withSequence(withTiming(1.04, { duration: 100 }), withTiming(1, { duration: 120 }));
    if (flow.finished) {
      setLoadingAction(false);
      return onMinimize();
    }
    
    if (flow.isReturn) {
      try { 
        await updateDoc(doc(db, 'orders', activeOrder.id), { status: 'returned', returnedAt: serverTimestamp(), updatedAt: serverTimestamp() }); 
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingAction(false);
      }
      return;
    }
    
    const startTime = Date.now();
    const ensureMinDelay = async () => {
      const elapsed = Date.now() - startTime;
      const minDelay = 800; // 800ms for premium smooth transition
      if (elapsed < minDelay) {
        await new Promise(resolve => setTimeout(resolve, minDelay - elapsed));
      }
    };

    try {
      if (isCancel) {
        const batchWr = writeBatch(db);
        liveOrders.forEach((o: any) => {
          if (!['delivered', 'cancelled', 'rescheduled', 'skipped'].includes(o.status)) {
            batchWr.update(doc(db, 'orders', o.id), { status: 'pending', riderId: null, batchId: null, rejectedBy: arrayUnion(o.riderId), updatedAt: serverTimestamp() });
          }
        });
        await batchWr.commit();
        await ensureMinDelay();
        showToast?.(t('toast_cancelled'), t('status_cancelled'), 'order_status');
        onMinimize(); return;
      }

      const beforeDelivery = ['assigned', 'accepted', 'go_to_branch', 'arrived_at_branch', 'picked'].includes(currentStatus);
      if (beforeDelivery) {
        if (currentStatus === 'arrived_at_branch') {
          setIsPicking(true);
          try {
            const batch = writeBatch(db);
            // 1. Immediately update status for all orders to 'picked'
            liveOrders.forEach((ord: any) => {
              batch.update(doc(db, 'orders', ord.id), { 
                status: 'picked', 
                pickedAt: serverTimestamp(), 
                updatedAt: serverTimestamp() 
              });
            });
            await batch.commit();
            await ensureMinDelay();

            // 2. Transition UI immediately
            setIsPicking(false);
            setIsPickedSuccess(true);
            setIsUploading(false); // No longer blocking
            showToast?.(t('toast_picked'), `#${activeOrder.id.slice(-6).toUpperCase()}`, 'order_status');

            // 3. Background Photo Upload Lifecycle
            (async () => {
              try {
                await Promise.all(liveOrders.map(async (ord: any) => {
                  const photoData = pickupPhotos[ord.id];
                  if (!photoData?.uri) return;

                  try {
                    const response = await fetch(photoData.uri);
                    const blob = await response.blob();
                    const sRef = storageRef(storage, `delivery_proofs/pickup_${ord.id}_${Date.now()}.jpg`);
                    const uploadResult = await uploadBytes(sRef, blob);
                    const url = await getDownloadURL(uploadResult.ref);

                    await updateDoc(doc(db, 'orders', ord.id), {
                      pickupProofImage: url,
                      updatedAt: serverTimestamp()
                    });
                  } catch (err) {
                    console.error(`Upload failed for order ${ord.id}:`, err);
                  }
                }));
              } catch (bgErr) {
                console.error("Background Pickup Upload Error:", bgErr);
              }
            })();
          } catch (err) {
            setIsPicking(false);
            console.error("Pickup Error:", err);
          } finally {
            setLoadingAction(false);
          }
          return;
        }

        const batchWr = writeBatch(db);
        liveOrders.forEach((o: any) => {
          if (!['cancelled', 'rescheduled', 'skipped'].includes(o.status)) batchWr.update(doc(db, 'orders', o.id), { status: flow.next, [`${flow.next}At`]: serverTimestamp(), updatedAt: serverTimestamp() });
        });
        await batchWr.commit();
        await ensureMinDelay();
        if (currentStatus === 'assigned') showToast?.(t('toast_accepted'), `#${activeOrder.id.slice(-6).toUpperCase()}`, 'new_order');
        if (currentStatus === 'accepted') {
          showToast?.(t('flow_go_branch'), `#${activeOrder.id.slice(-6).toUpperCase()}`, 'order_status');
          setIsNavigating(true);
        }
        if (currentStatus === 'go_to_branch') showToast?.(t('toast_arrived_branch'), `#${activeOrder.id.slice(-6).toUpperCase()}`, 'order_status');
        if (currentStatus === 'picked') {
          showToast?.(t('toast_trip_started'), `#${activeOrder.id.slice(-6).toUpperCase()}`, 'order_status');
          setIsNavigating(true);
        }
        return;
      }

      if (flow.isOTP) {
        setOtpOrder(activeOrder);
        return;
      }
      await updateDoc(doc(db, 'orders', activeOrder.id), { status: flow.next, [`${flow.next}At`]: serverTimestamp(), updatedAt: serverTimestamp() });
      await ensureMinDelay();
    } catch (e) { 
      console.error(e); 
    } finally {
      setLoadingAction(false);
    }
  };

  const handleUnbatch = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { batchId: null, updatedAt: serverTimestamp() });
      setLiveOrders((prev: any) => {
        const nextList = prev.filter((x: any) => x.id !== orderId);
        if (nextList.length === 0) onMinimize();
        return nextList;
      });
      if (activeOrder.id === orderId) setCurrentIndex(0);
      if (liveOrders.length <= 2) setShowOverviewDrawer(false);
    } catch (e) { console.error(e); }
  };

  const renderCurrentStep = () => {
    if (isPickedSuccess) {
      return (
        <PickedSuccessView 
          orders={liveOrders} 
          onContinue={async () => {
            setIsPickedSuccess(false);
            await handleAction();
          }} 
        />
      );
    }
    if (contextLoading && initOrders.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  if (!activeOrder) return null;

    const allCompleted = liveOrders.every((o: any) => ['delivered', 'success', 'cancelled', 'rescheduled', 'skipped', 'returned'].includes(o.status));
    const props = { 
      order: activeOrder, 
      riderLocation, 
      batchOrders: liveOrders, 
      currentIndex,
      isNavigating,
      setIsNavigating,
      followMode,
      routeInfo,
      branchData,
      routeDestination,
      heading
    };
    if (allCompleted) {
      const anySuccess = liveOrders.some((o: any) => ['delivered', 'success'].includes(o.status));
      if (anySuccess) return <SuccessView batchOrders={liveOrders} onFinish={onMinimize} />;
      return <CancelledView order={activeOrder} batchOrders={liveOrders} onFinish={onMinimize} />;
    }

    if (['delivered', 'success', 'cancelled', 'rescheduled', 'skipped', 'returned'].includes(currentStatus)) return null;

    switch (currentStatus) {
      case 'assigned': return <GoToBranchView {...props} isAccepted={false} orderStatus="assigned" />;
      case 'accepted': return <GoToBranchView {...props} isAccepted={true} orderStatus="accepted" />;
      case 'go_to_branch': return <GoToBranchView {...props} isAccepted={true} orderStatus="go_to_branch" />;
      case 'arrived_at_branch': return <ArrivedAtBranchView {...props} onPhotosChange={setPickupPhotos} onVerificationStatusChange={setIsVerified} />;
      case 'picked':
      case 'out_for_delivery': return <GoToCustomerView {...props} orderStatus={currentStatus} onCancelRequest={() => setShowReturnModal(true)} />;
      case 'arrived_at_customer': return <ArrivedAtCustomerView {...props} onCancelRequest={() => setShowReturnModal(true)} />;
      case 'returning_to_branch': return <ReturnInProgressView order={activeOrder} />;
      default: return null;
    }
  };


  // 4. Loading & Error States
  if (contextLoading && !activeOrder) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={T.accent} />
        <Text style={{ marginTop: 14, fontSize: 10, fontWeight: '800', color: T.sub, textTransform: 'uppercase', letterSpacing: 2 }}>
          {t('loading') || 'Loading Order Details...'}
        </Text>
      </View>
    );
  }

  if (!activeOrder) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <AlertCircle size={48} color={T.sub} strokeWidth={1.5} />
        <Text style={{ marginTop: 24, fontSize: 20, fontWeight: '800', color: T.text, textAlign: 'center' }}>
          {lang === 'bn' ? 'অর্ডারটি পাওয়া যায়নি' : 'Order Not Found'}
        </Text>
        <Text style={{ marginTop: 10, fontSize: 14, color: T.sub, textAlign: 'center', lineHeight: 20 }}>
          {lang === 'bn' 
            ? 'অর্ডারটি হয়তো বাতিল করা হয়েছে অথবা আপনার কাছে আর বরাদ্দ নেই।' 
            : 'The order might have been cancelled or is no longer assigned to you.'}
        </Text>
        <Pressable 
          onPress={() => (onMinimize ? onMinimize() : router.back())}
          style={{ marginTop: 32, paddingVertical: 14, paddingHorizontal: 32, backgroundColor: T.accent, borderRadius: 14, elevation: 4 }}
        >
          <Text style={{ color: '#fff', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>
            {lang === 'bn' ? 'পিছনে যান' : 'Go Back'}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bg, overflow: 'hidden' }}>
      {/* HEADER */}
      {!isPicking && !isMapView && (
        <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 24, paddingBottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border, zIndex: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 3, textTransform: 'uppercase', color: T.accent, marginBottom: 4 }}>
              {isBatchMode ? `Drop ${currentIndex + 1}/${initialBatchSize.current}` : t('exec_order_label')} #{activeOrder.seq || activeOrder.id?.slice(-6).toUpperCase()}
            </Text>
            <Text style={{ fontFamily: font, fontSize: 26, letterSpacing: 1.5, textTransform: 'uppercase', color: T.text, lineHeight: 28 }} numberOfLines={1}>
              {currentStatus.replace(/_/g, ' ')}
            </Text>
          </View>
          <Pressable onPress={() => (onMinimize ? onMinimize() : router.back())} style={{ width: 44, height: 44, borderRadius: 15, borderWidth: 1, borderColor: T.border, backgroundColor: surfHi, alignItems: 'center', justifyContent: 'center', marginLeft: 16 }}>
            <X size={20} color={T.text} strokeWidth={2.5} />
          </Pressable>
        </View>
      )}

      {/* MAP CONTROLS */}
      {isMapView && (
        <>
          <Pressable onPress={() => (onMinimize ? onMinimize() : router.back())} style={{ position: 'absolute', top: hasNavHeader ? (insets.top + 90) : (insets.top + 10), right: 16, zIndex: 100, width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}>
            <ChevronDown size={19} color="#fff" strokeWidth={2.5} />
          </Pressable>
          {isBatchMode && (
            <Pressable onPress={() => setShowOverviewDrawer(true)} style={{ position: 'absolute', top: hasNavHeader ? (insets.top + 90) : (insets.top + 10), left: 16, zIndex: 100, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.65)', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: `${T.accent}66` }}>
              <ListOrdered size={16} color={T.accent} />
              <Text style={{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, color: '#fff' }}>
                {lang === 'bn' ? `ডেলিভারি ${currentIndex + 1}/${initialBatchSize.current}` : `Drop ${currentIndex + 1}/${initialBatchSize.current}`}
              </Text>
              <ChevronDown size={14} color="rgba(255,255,255,0.6)" strokeWidth={2.5} />
            </Pressable>
          )}
        </>
      )}

      {isMapView && (
        <View style={{ position: 'absolute', inset: 0 }}>
          <RouteOverviewMap 
            assignedOrders={liveOrders} 
            branches={branches}
            minimal={true}
            routeOrigin={riderLocation ? { latitude: riderLocation.lat, longitude: riderLocation.lng } : undefined}
            routeDestination={routeDestination ? { latitude: routeDestination.lat, longitude: routeDestination.lng } : undefined}
            onRouteReady={setRouteInfo}
            accentColor={T.accent}
            navigationMode={isNavigating}
            followMode={followMode}
            onFollowModeChange={setFollowMode}
            livePos={riderLocation}
            heading={heading || 0}
            currentStatus={currentStatus}
            branchLocation={branchData?.location ? { latitude: Number(branchData.location.lat), longitude: Number(branchData.location.lng) } : undefined}
            customerDestinations={liveOrders.map((o: any) => {
              const loc = o.customer?.location || o.customer?.address;
              return loc?.lat ? { latitude: Number(loc.lat), longitude: Number(loc.lng) } : null;
            }).filter(Boolean)}
          />
        </View>
      )}

      <Animated.View 
        key={currentIndex} 
        entering={FadeInRight.duration(400)} 
        exiting={FadeOutLeft.duration(300)}
        style={{ flex: 1, overflow: 'hidden' }}
        pointerEvents="box-none"
      >
        {renderCurrentStep()}
      </Animated.View>

      {/* ACTION FOOTER */}
      {!isPicking && !flow.finished && !isPickedSuccess && (
        <Animated.View 
          layout={LinearTransition.springify().damping(25).stiffness(200)}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 80, padding: 16, paddingBottom: 24, flexDirection: 'row', gap: 10, backgroundColor: isMapView ? (isDark ? 'rgba(14,14,28,0.96)' : 'rgba(255,255,255,0.96)') : T.bg, borderTopWidth: isMapView ? 1 : 0, borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }}
        >
          {['picked', 'out_for_delivery', 'arrived_at_customer'].includes(currentStatus) && (
            <Pressable onPress={() => setShowReturnModal(true)} style={{ width: 58, height: 58, borderRadius: 17, backgroundColor: 'rgba(249,115,22,0.08)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)', alignItems: 'center', justifyContent: 'center' }}>
              <CornerUpLeft size={20} color="#f97316" strokeWidth={2} />
            </Pressable>
          )}
          {flow.canCancel && (
            <Pressable onPress={() => setShowCancelConfirm(true)} style={{ width: 58, height: 58, borderRadius: 17, backgroundColor: 'rgba(255,77,109,0.08)', borderWidth: 1, borderColor: 'rgba(255,77,109,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <XCircle size={21} color="#ff4d6d" strokeWidth={2} />
            </Pressable>
          )}
          {currentStatus !== 'assigned' && (
            <Pressable onPress={() => setIsChatOpen(true)} style={{ width: 58, height: 58, borderRadius: 17, backgroundColor: surfHi, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <MessageSquare size={21} color={T.text} strokeWidth={2} />
              <UnreadBadge count={totalUnread} bg={T.bg} />
            </Pressable>
          )}
          {(() => {
            return (
              <Animated.View style={[{ flex: 1, height: 58, borderRadius: 17, shadowColor: flow.grad, shadowOpacity: (isButtonDisabled || loadingAction) ? 0 : 0.3, shadowRadius: 12, elevation: 6, overflow: 'hidden' }, animatedButtonStyle]}>
                <Pressable 
                  disabled={isButtonDisabled || loadingAction} 
                  onPress={() => handleAction()} 
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: (isButtonDisabled || loadingAction) ? 0.8 : 1 }}
                >
                  <Animated.View 
                    key={flow.textKey + isButtonDisabled + loadingAction}
                    entering={FadeIn.duration(400)}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
                  >
                    {loadingAction ? (
                      <>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={{ fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, color: '#fff' }}>
                          {t('btn_loading') || (lang === 'bn' ? 'অপেক্ষা করুন...' : 'Processing...')}
                        </Text>
                      </>
                    ) : isButtonDisabled ? (
                      <>
                        <AlertCircle size={16} color="rgba(255,255,255,0.47)" strokeWidth={2.5} />
                        <Text style={{ fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.47)' }}>
                          {lang === 'bn' ? 'ছবি ও আইটেম চেক করুন' : 'CHECK ITEMS & PHOTOS'}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={{ fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, color: '#fff' }}>{t(flow.textKey)}</Text>
                        <ChevronRight size={18} color="#fff" strokeWidth={3} />
                      </>
                    )}
                  </Animated.View>
                </Pressable>
              </Animated.View>
            );
          })()}
        </Animated.View>
      )}

      {/* REJECTION CONFIRMATION MODAL */}
      <Modal visible={showCancelConfirm} transparent animationType="fade" onRequestClose={() => setShowCancelConfirm(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Animated.View entering={SlideInDown.duration(400)} style={{ width: '100%', backgroundColor: T.bg, borderRadius: 32, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <AlertCircle size={40} color="#ef4444" strokeWidth={2.5} />
            </View>
            <Text style={{ fontSize: 22, fontWeight: '900', color: T.text, textAlign: 'center', marginBottom: 12 }}>
              {lang === 'bn' ? 'অর্ডার কি বাতিল করবেন?' : 'Reject this Order?'}
            </Text>
            <Text style={{ fontSize: 14, color: T.sub, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
              {lang === 'bn' ? 'আপনি কি নিশ্চিত যে আপনি এই অর্ডারটি গ্রহণ করবেন না? একবার বাতিল করলে এটি আর ফিরে পাওয়া যাবে না।' : 'Are you sure you want to reject this delivery? This action cannot be undone and the order will be reassigned.'}
            </Text>
            
            <View style={{ width: '100%', gap: 12 }}>
              <Pressable 
                onPress={() => {
                  setShowCancelConfirm(false);
                  handleAction(true);
                }} 
                style={{ width: '100%', height: 60, borderRadius: 18, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', shadowColor: '#ef4444', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 }}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                  {lang === 'bn' ? 'হ্যাঁ, বাতিল করুন' : 'Yes, Reject Order'}
                </Text>
              </Pressable>
              
              <Pressable 
                onPress={() => setShowCancelConfirm(false)} 
                style={{ width: '100%', height: 60, borderRadius: 18, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: T.text, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                  {lang === 'bn' ? 'না, ফিরে যান' : 'No, Go Back'}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {showOverviewDrawer && (
        <BatchOverviewDrawer liveOrders={sortedOrders} currentIndex={currentIndex} setCurrentIndex={setCurrentIndex} onClose={() => setShowOverviewDrawer(false)} />
      )}

      {/* CHAT WINDOW */}
      <ChatWindow 
        visible={isChatOpen} 
        order={activeOrder} 
        onClose={() => setIsChatOpen(false)} 
      />


      {/* RETURN ORDER MODAL */}
      <ReturnOrderModal
        visible={showReturnModal}
        order={activeOrder}
        onClose={() => setShowReturnModal(false)}
        onComplete={() => {
          setShowReturnModal(false);
          // Modal updates status to 'returning_to_branch'
        }}
      />

      {/* FULL PAGE DELIVERY CONFIRMATION OVERLAY */}
      {otpOrder && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: T.bg }}>
          <DeliveryConfirmation
            visible={!!otpOrder}
            order={otpOrder}
            onComplete={() => {
              setOtpOrder(null);
              showToast?.(t('toast_delivered'), `#${otpOrder.id.slice(-6).toUpperCase()}`, 'order_status');
            }}
            onCancel={() => setOtpOrder(null)}
            hasNextOrder={initialBatchSize.current > 1 && currentIndex < sortedOrders.length - 1}
            nextOrder={sortedOrders[currentIndex + 1]}
          />
        </View>
      )}
    </View>
  );
}
