import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Dimensions, Modal, ActivityIndicator, BackHandler, Linking } from 'react-native';
import Animated, { FadeIn, FadeOut, FadeInRight, FadeOutLeft, FadeInUp, LinearTransition, useAnimatedStyle, withTiming, withSequence, useSharedValue, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { doc, updateDoc, serverTimestamp, writeBatch, arrayUnion, onSnapshot, query, collection, where } from 'firebase/firestore';
import { X, ChevronRight, XCircle, PackageCheck, CheckCircle2, Package, MessageSquare, ChevronDown, ListOrdered, CornerUpLeft, AlertCircle, Store, Navigation, Phone } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';

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
import SimpleOverviewMap from '../../components/map/SimpleOverviewMap';
import { useAutoNavigation } from '../../hooks/useAutoNavigation';
import { useLocationStore } from '../../store/locationStore';
import { calculateDistance, getOptimalDeliveryRoute } from '../../utils/batchUtils';


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
            #{order.id}
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

const PickedSuccessView = React.memo(({ orders, riderLocation, onStartClosestDelivery, onContinue }: { orders: any[], riderLocation: any, onStartClosestDelivery?: (order: any) => void, onContinue: () => void }) => {
  const { T, t, lang, font } = useApp();
  const insets = useSafeAreaInsets();

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

  const isSolo = orders.length === 1;
  const soloOrder = orders[0];
  const phone = soloOrder?.customer?.phone || soloOrder?.customerPhone || soloOrder?.phone;
  const customerName = soloOrder?.customerName || soloOrder?.customer?.name || 'Customer';
  const customerAddress = soloOrder?.customer?.address || '—';

  const distance = useMemo(() => {
    if (!isSolo) return '';
    const custLoc = soloOrder?.customer?.location || soloOrder?.customer?.address;
    if (!riderLocation || !custLoc) return '--';

    const lat = custLoc.lat ?? custLoc.latitude;
    const lng = custLoc.lng ?? custLoc.longitude;
    if (!lat || !lng) return '--';

    const distMeters = calculateDistance(riderLocation.lat, riderLocation.lng, Number(lat), Number(lng));
    if (distMeters >= 1000) {
      const km = (distMeters / 1000).toFixed(1);
      return lang === 'bn' ? `${km} কি.মি. দূরে` : `${km} km away`;
    }
    const m = Math.round(distMeters);
    return lang === 'bn' ? `${m} মি. দূরে` : `${m} m away`;
  }, [isSolo, soloOrder, riderLocation, lang]);

  const closestOrder = useMemo(() => {
    if (!orders || orders.length <= 1 || !riderLocation) return null;

    let minDistance = Infinity;
    let closest: any = null;

    orders.forEach(o => {
      const custLoc = o.customer?.location || o.customer?.address;
      if (!custLoc) return;

      const lat = custLoc.lat ?? custLoc.latitude;
      const lng = custLoc.lng ?? custLoc.longitude;
      if (!lat || !lng) return;

      const dist = calculateDistance(riderLocation.lat, riderLocation.lng, Number(lat), Number(lng));
      if (dist < minDistance) {
        minDistance = dist;
        closest = { order: o, distance: dist };
      }
    });

    return closest;
  }, [orders, riderLocation]);

  const closestDistanceStr = useMemo(() => {
    if (!closestOrder) return '';
    const distMeters = closestOrder.distance;
    if (distMeters >= 1000) {
      const km = (distMeters / 1000).toFixed(1);
      return lang === 'bn' ? `${km} কি.মি. দূরে` : `${km} km away`;
    }
    const m = Math.round(distMeters);
    return lang === 'bn' ? `${m} মি. দূরে` : `${m} m away`;
  }, [closestOrder, lang]);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg, zIndex: 10 }}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', padding: 24, paddingBottom: 120, gap: 24 }}>
        <View style={{ width: 80, height: 80, backgroundColor: T.green, borderRadius: 24, alignItems: 'center', justifyContent: 'center', shadowColor: '#22d47a', shadowOpacity: 0.4, shadowRadius: 20, elevation: 10 }}>
          <PackageCheck size={40} color="#fff" />
        </View>

        {isSolo ? (
          <>
            <View style={{ alignItems: 'center' }}>
              <View style={{ backgroundColor: `${T.accent}12`, borderWidth: 1.5, borderColor: `${T.accent}30`, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 14, marginBottom: 8 }}>
                <Text style={{ fontFamily: font, fontSize: 14, fontWeight: '900', color: T.accent }}>
                  #{soloOrder.id}
                </Text>
              </View>
              <Text style={{ fontFamily: font, fontSize: 28, fontWeight: '900', color: T.text }}>
                {lang === 'bn' ? 'পিকআপ সফল' : 'Pickup Successful'}
              </Text>
            </View>

            {/* Premium Customer Card */}
            <View style={{ width: '100%', maxWidth: 360, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 24, padding: 20, gap: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, color: T.sub, marginBottom: 4 }}>
                    {lang === 'bn' ? 'কাস্টমার' : 'CUSTOMER'}
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: T.text }} numberOfLines={1}>
                    {customerName}
                  </Text>
                </View>
                {phone ? (
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${phone}`)}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      backgroundColor: T.green || '#22c55e',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: T.green || '#22c55e',
                      shadowOpacity: 0.25,
                      shadowRadius: 10,
                      elevation: 4
                    }}
                  >
                    <Phone size={20} color="#fff" />
                  </Pressable>
                ) : null}
              </View>

              <View style={{ borderTopWidth: 1, borderTopColor: T.border, paddingTop: 16 }}>
                <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, color: T.sub, marginBottom: 4 }}>
                  {lang === 'bn' ? 'ডেলিভারি ঠিকানা' : 'DELIVERY ADDRESS'}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: T.text, lineHeight: 20 }}>
                  {customerAddress}
                </Text>
              </View>

              <View style={{ borderTopWidth: 1, borderTopColor: T.border, paddingTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Navigation size={14} color={T.accent} strokeWidth={2.5} />
                <Text style={{ fontSize: 13, fontWeight: '800', color: T.accent }}>
                  {distance}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: font, fontSize: 30, letterSpacing: 2, color: T.text, marginBottom: 6 }}>
                {lang === 'bn' ? 'পিকআপ সফল' : 'Pickup Successful'}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: T.sub, textAlign: 'center', paddingHorizontal: 16, lineHeight: 16 }}>
                {`অর্ডার ${orders.map(o => `#${o.id}`).join(', ')} সফলভাবে পিকআপ করা হয়েছে`}
              </Text>
            </View>

            {/* Premium Suggestion Card inside Batch Pickup Success */}
            {closestOrder && (
              <View style={{ width: '100%', maxWidth: 360, backgroundColor: `${T.accent}08`, borderWidth: 1.5, borderColor: `${T.accent}30`, borderRadius: 24, padding: 18, gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Navigation size={16} color={T.accent} strokeWidth={2.5} />
                  <Text style={{ fontFamily: font, fontSize: 13, fontWeight: '900', color: T.accent, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {lang === 'bn' ? '💡 সাজেস্টেড পরবর্তী ডেলিভারি' : '💡 Suggested Next Delivery'}
                  </Text>
                </View>

                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: T.text, lineHeight: 18 }}>
                    {lang === 'bn'
                      ? `কাস্টমার "${closestOrder.order.customerName || closestOrder.order.customer?.name || 'Customer'}" আপনার সবচেয়ে কাছে (${closestDistanceStr}) আছেন।`
                      : `Customer "${closestOrder.order.customerName || closestOrder.order.customer?.name || 'Customer'}" is nearest to you (${closestDistanceStr}).`}
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: T.sub, marginTop: 4 }}>
                    {lang === 'bn' ? `অর্ডার আইডি: #${closestOrder.order.id}` : `Order ID: #${closestOrder.order.id}`}
                  </Text>
                </View>

                <Pressable
                  onPress={() => onStartClosestDelivery?.(closestOrder.order)}
                  style={{
                    width: '100%',
                    height: 48,
                    borderRadius: 14,
                    backgroundColor: T.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 6,
                    shadowColor: T.accent,
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    elevation: 3
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                    {lang === 'bn' ? 'ডেলিভারি শুরু করুন' : 'Start Delivery'}
                  </Text>
                  <ChevronRight size={14} color="#fff" strokeWidth={3} />
                </Pressable>
              </View>
            )}
          </>
        )}

        {/* Package Items Card */}
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

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, paddingBottom: Math.max(24, insets.bottom + 8), zIndex: 20 }}>
        <Pressable onPress={onContinue} style={{ width: '100%', height: 60, borderRadius: 20, backgroundColor: T.text, alignItems: 'center', justifyContent: 'center', shadowColor: T.text, shadowOpacity: 0.25, shadowRadius: 15, elevation: 8 }}>
          <Text style={{ color: T.bg, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2.5 }}>
            {orders.length > 1
              ? (lang === 'bn' ? 'ঠিক আছে' : 'OKAY')
              : (lang === 'bn' ? 'ডেলিভারি শুরু করুন' : 'Start Delivery Trip')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

const NextOrderTransitionView = React.memo(({ targetOrder, riderLocation, onStart }: { targetOrder: any, riderLocation: any, onStart: () => void }) => {
  const { T, lang, font } = useApp();

  const distance = useMemo(() => {
    const custLoc = targetOrder?.customer?.location || targetOrder?.customer?.address;
    if (!riderLocation || !custLoc) return '--';

    const lat = custLoc.lat ?? custLoc.latitude;
    const lng = custLoc.lng ?? custLoc.longitude;
    if (!lat || !lng) return '--';

    const distMeters = calculateDistance(riderLocation.lat, riderLocation.lng, lat, lng);
    if (distMeters >= 1000) {
      return `${(distMeters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(distMeters)} m`;
  }, [targetOrder, riderLocation]);

  const phone = targetOrder?.customer?.phone || targetOrder?.customerPhone || targetOrder?.phone;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ alignItems: 'center', gap: 20, marginBottom: 40 }}>
        <View style={{ width: 100, height: 100, borderRadius: 32, backgroundColor: `${T.accent}12`, borderWidth: 2, borderColor: `${T.accent}30`, alignItems: 'center', justifyContent: 'center' }}>
          <Navigation size={48} color={T.accent} strokeWidth={2} />
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 3, textTransform: 'uppercase', color: T.accent, marginBottom: 6 }}>
            {lang === 'bn' ? 'পরবর্তী গন্তব্য' : 'NEXT DESTINATION'}
          </Text>
          <Text style={{ fontFamily: font, fontSize: 32, fontWeight: '900', color: T.text, textAlign: 'center', lineHeight: 38 }}>
            {distance} {lang === 'bn' ? 'দূরে রয়েছে' : 'Away'}
          </Text>
        </View>
      </View>

      <View style={{ width: '100%', maxWidth: 360, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 24, padding: 24, gap: 16, marginBottom: 40 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, color: T.sub, marginBottom: 4 }}>
              {lang === 'bn' ? 'কাস্টমার' : 'CUSTOMER'}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: T.text }} numberOfLines={1}>
              {targetOrder.customerName || targetOrder.customer?.name || 'Customer'}
            </Text>
          </View>
          <View style={{ backgroundColor: `${T.accent}12`, borderWidth: 1.5, borderColor: `${T.accent}30`, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 12 }}>
            <Text style={{ fontFamily: font, fontSize: 13, fontWeight: '800', color: T.accent }}>
              #{targetOrder.id}
            </Text>
          </View>
        </View>

        <View style={{ borderTopWidth: 1, borderTopColor: T.border, paddingTop: 16 }}>
          <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, color: T.sub, marginBottom: 4 }}>
            {lang === 'bn' ? 'ডেলিভারি ঠিকানা' : 'DELIVERY ADDRESS'}
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '500', color: T.text, lineHeight: 20 }}>
            {targetOrder.customer?.address || '—'}
          </Text>
        </View>
      </View>

      <View style={{ width: '100%', maxWidth: 360, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        {phone ? (
          <Pressable
            onPress={() => Linking.openURL(`tel:${phone}`)}
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              backgroundColor: T.green || '#22c55e',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: T.green || '#22c55e',
              shadowOpacity: 0.3,
              shadowRadius: 15,
              elevation: 8
            }}
          >
            <Phone size={24} color="#fff" />
          </Pressable>
        ) : null}
        <Pressable
          onPress={onStart}
          style={{
            flex: 1,
            height: 64,
            borderRadius: 20,
            backgroundColor: T.accent,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: T.accent,
            shadowOpacity: 0.3,
            shadowRadius: 15,
            elevation: 8
          }}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2.5 }}>
            {lang === 'bn' ? 'ডেলিভারি শুরু করুন' : 'Start Next Delivery'}
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
                      #{o.id}
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

export default function OrderExecution({ batchOrders = [], order = null, onMinimize, onFinish, onActiveBatchChange }: any) {
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

    if (batchOrders && batchOrders.length === 0) return [];

    return contextActiveOrders;
  }, [batchOrders, order, contextActiveOrders, batchId]);

  const { T, t, theme, lang, showToast, font } = useApp();
  const insets = useSafeAreaInsets();
  const setIsExecuting = useUIStore(s => s.setIsExecuting);

  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? true);
    });
    return () => unsubscribe();
  }, []);

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
  const initialBatchSize = useRef(initOrders.length);
  useEffect(() => {
    initialBatchSize.current = liveOrders.length;
  }, [liveOrders.length]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mapTouchTime, setMapTouchTime] = useState(Date.now());

  const { currentLocation: riderLocation, heading, speed } = useLocationStore();

  const [capturedLocation, setCapturedLocation] = useState<any>(riderLocation);
  useEffect(() => {
    if (riderLocation) {
      setCapturedLocation(riderLocation);
    }
  }, [liveOrders.map((o: any) => o.status).join(','), liveOrders.length]);

  // --- Dynamic Location-Aware Sorting Logic ---
  const sortedOrders = useMemo(() => {
    return getOptimalDeliveryRoute(liveOrders, capturedLocation);
  }, [liveOrders, capturedLocation]);

  const activeOrder = sortedOrders[currentIndex] || sortedOrders[0];

  const [transitionTargetOrder, setTransitionTargetOrder] = useState<any>(null);
  const prevOrderStatuses = useRef<Record<string, string>>({});
  const transitionPendingRef = useRef(false);

  // Detect when ANY order becomes delivered — independent of which order is activeOrder
  useEffect(() => {
    if (liveOrders.length === 0) return;
    const DONE = ['delivered', 'success', 'cancelled', 'rescheduled', 'skipped', 'returned'];

    const newlyDelivered = liveOrders.filter(o => {
      const prev = prevOrderStatuses.current[o.id];
      return prev && !DONE.includes(prev) && ['delivered', 'success'].includes(o.status);
    });

    // Update stored statuses
    liveOrders.forEach(o => { prevOrderStatuses.current[o.id] = o.status; });

    if (newlyDelivered.length > 0) {
      const nextIncomplete = liveOrders.find((o: any) => !DONE.includes(o.status));
      if (nextIncomplete) {
        transitionPendingRef.current = true;
        setTransitionTargetOrder(nextIncomplete);
      } else {
        // No incomplete orders in current liveOrders.
        // Check if there are other active (incomplete) orders in contextActiveOrders
        const globalIncomplete = contextActiveOrders.filter((o: any) => !DONE.includes(o.status) && !liveOrders.some(x => x.id === o.id));
        if (globalIncomplete.length > 0 && riderLocation) {
          // Find the one nearest to riderLocation
          const sorted = [...globalIncomplete].sort((a: any, b: any) => {
            const aLoc = a.customer?.location || a.customer?.address;
            const bLoc = b.customer?.location || b.customer?.address;
            const aLat = aLoc?.lat ?? aLoc?.latitude;
            const aLng = aLoc?.lng ?? aLoc?.longitude;
            const bLat = bLoc?.lat ?? bLoc?.latitude;
            const bLng = bLoc?.lng ?? bLoc?.longitude;

            if (!aLat || !aLng) return 1;
            if (!bLat || !bLng) return -1;

            const distA = calculateDistance(riderLocation.lat, riderLocation.lng, Number(aLat), Number(aLng));
            const distB = calculateDistance(riderLocation.lat, riderLocation.lng, Number(bLat), Number(bLng));
            return distA - distB;
          });

          transitionPendingRef.current = true;
          setTransitionTargetOrder(sorted[0]);
        }
      }
    }
  }, [liveOrders, contextActiveOrders, riderLocation]);

  useEffect(() => {
    // Only auto-advance if there's no pending transition waiting for user input
    if (transitionTargetOrder || transitionPendingRef.current) return;
    if (sortedOrders.length > 0 && ['delivered', 'cancelled', 'returned'].includes(sortedOrders[currentIndex]?.status)) {
      const nextIdx = sortedOrders.findIndex(o => !['delivered', 'success', 'cancelled', 'rescheduled', 'skipped', 'returned'].includes(o.status));
      if (nextIdx !== -1) setCurrentIndex(nextIdx);
    }
  }, [sortedOrders, currentIndex, transitionTargetOrder]);

  const [isPickedSuccess, setIsPickedSuccess] = useState(() => {
    return initOrders.some((o: any) => o.status === 'picked');
  });

  const orderStatusesString = useMemo(() => 
    initOrders.map((o: any) => `${o.id}_${o.status}`).sort().join(','),
    [initOrders]
  );

  useEffect(() => {
    if (isPickedSuccess) return; // Freeze liveOrders while success screen is shown
    if (initOrders.length > 0) {
      setLiveOrders(prev => {
        if (prev.length === 0) return initOrders;

        // 1. Update existing orders with new data from initOrders
        const updatedPrev = prev.map(p => {
          const match = initOrders.find((o: any) => o.id === p.id);
          if (match) {
            if (p.status !== match.status || p.updatedAt?.seconds !== match.updatedAt?.seconds) {
              return match;
            }
          }
          return p;
        });

        // 2. Append any new orders that are in initOrders but not in prev
        const prevIds = new Set(prev.map(o => o.id));
        const newOrders = initOrders.filter((o: any) => !prevIds.has(o.id));
        
        return [...updatedPrev, ...newOrders];
      });
    }
  }, [orderStatusesString, isPickedSuccess]);

  const [otpOrder, setOtpOrder] = useState<any>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showOverviewDrawer, setShowOverviewDrawer] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [pickupPhotos, setPickupPhotos] = useState<any>({});
  const [branchCheckedItems, setBranchCheckedItems] = useState<any>({});
  const [branchPhoto, setBranchPhoto] = useState<any>(null);
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

  const [visualStatus, setVisualStatus] = useState<string | null>(null);
  const currentStatus = visualStatus || activeOrder?.status || 'delivered';

  useEffect(() => {
    if (activeOrder?.status) {
      setVisualStatus(activeOrder.status);
    }
  }, [activeOrder?.id, activeOrder?.status]);

  useEffect(() => {
    if (!isPickedSuccess && ['go_to_branch', 'picked', 'out_for_delivery'].includes(currentStatus)) {
      setIsNavigatingState(true);
      setFollowMode(true);
    } else {
      setIsNavigatingState(false);
    }
  }, [currentStatus, isPickedSuccess]);

  const isBatchMode = initialBatchSize.current > 1;

  const totalUnread = useMemo(() => Object.values(unreadCounts).reduce((a, b) => a + b, 0), [unreadCounts]);

  // Unread messages listener for live orders
  useEffect(() => {
    if (!liveOrders || liveOrders.length === 0) {
      setUnreadCounts({});
      return;
    }
    
    const unsubs: (() => void)[] = [];

    liveOrders.forEach(o => {
      const chatRef = dbRef(rtdb, RTDB_PATHS.chat(o.id));
      const unsub = onValue(chatRef, (snap) => {
        setUnreadCounts(prev => {
          const next = { ...prev };
          if (snap.exists()) {
            const msgs = Object.values(snap.val() as any);
            next[o.id] = msgs.filter((m: any) => m.senderRole === 'customer' && !m.read).length;
          } else {
            next[o.id] = 0;
          }
          return next;
        });
      });
      unsubs.push(() => unsub());
    });

    return () => unsubs.forEach(u => u());
  }, [liveOrders]);

  // 1. Optimized Listener (Single Listener for all orders)
  useEffect(() => {
    if (liveOrders.length === 0) return;

    // Listen to all relevant orders in one go if a real Firestore batchId exists
    const bid = (batchId && typeof batchId === 'string' && !String(batchId).startsWith('pickup_'))
      ? batchId
      : (liveOrders[0]?.batchId && !String(liveOrders[0].batchId).startsWith('pickup_'))
        ? liveOrders[0].batchId
        : null;

    let unsubs: any[] = [];

    if (bid) {
      // Real Firestore batchId — single query listener
      const q = query(collection(db, 'orders'), where('batchId', '==', bid));
      const unsub = onSnapshot(q, (snap: any) => {
        const updated = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        setLiveOrders(prev => {
          const changed = updated.some((u: any) => {
            const p = prev.find(x => x.id === u.id);
            return !p || p.status !== u.status || p.updatedAt?.seconds !== (u as any).updatedAt?.seconds;
          });
          return changed ? updated : prev;
        });
      });
      unsubs = [unsub];
    } else {
      // Virtual batch (pre-pick grouping) or solo order — subscribe to each doc individually
      unsubs = liveOrders.map(ord =>
        onSnapshot(doc(db, 'orders', ord.id), (snap: any) => {
          if (!snap.exists()) return;
          const updated = { id: snap.id, ...snap.data() };
          setLiveOrders(prev => {
            const idx = prev.findIndex(x => x.id === updated.id);
            if (idx === -1) return prev;
            const existing = prev[idx];
            if (existing.status === updated.status && existing.updatedAt?.seconds === updated.updatedAt?.seconds) return prev;
            const next = [...prev];
            next[idx] = updated;
            return next;
          });
        })
      );
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
      unsubs.forEach(u => u());
      chatUnsubs.forEach(u => u());
    };
  }, [orderIdsString, batchId]);

  // 3. Rider Location listener
  // Location tracking is now handled by Zustand useLocationStore

  useEffect(() => {
    if (liveOrders.length === 0 || transitionTargetOrder || transitionPendingRef.current) return;
    const curStatus = (liveOrders[currentIndex] as any)?.status;
    const isCompleted = ['delivered', 'success', 'cancelled', 'rescheduled', 'skipped', 'returned'].includes(curStatus);
    if (isCompleted) {
      const nextIncomplete = liveOrders.findIndex((o: any) => !['delivered', 'success', 'cancelled', 'rescheduled', 'skipped', 'returned'].includes(o.status));
      if (nextIncomplete !== -1 && nextIncomplete !== currentIndex) {
        setCurrentIndex(nextIncomplete);
      }
    }
  }, [liveOrders, currentIndex, transitionTargetOrder]);

  // Sync Branch Data for Map
  useEffect(() => {
    if (activeOrder?.branchId) {
      const bRef = doc(db, 'branches', activeOrder.branchId);
      onSnapshot(bRef, (snap) => {
        if (snap.exists()) setBranchData(snap.data());
      });
    }
  }, [activeOrder?.branchId]);

  const routeDestinationMapProp = useMemo(() => {
    const isBeforePick = ['assigned', 'accepted', 'go_to_branch', 'arrived_at_branch'].includes(currentStatus);
    if (isBeforePick && branchData?.location) {
      const lat = branchData.location.lat ?? branchData.location.latitude;
      const lng = branchData.location.lng ?? branchData.location.longitude;
      return lat && lng ? { latitude: Number(lat), longitude: Number(lng) } : null;
    }
    const custLoc = activeOrder?.customer?.location || activeOrder?.customer?.address;
    if (custLoc) {
      const lat = custLoc.lat ?? custLoc.latitude;
      const lng = custLoc.lng ?? custLoc.longitude;
      return lat && lng ? { latitude: Number(lat), longitude: Number(lng) } : null;
    }
    return null;
  }, [currentStatus, branchData, activeOrder]);

  const branchLocationMapProp = useMemo(() => {
    if (!branchData?.location) return undefined;
    const lat = branchData.location.lat ?? branchData.location.latitude;
    const lng = branchData.location.lng ?? branchData.location.longitude;
    return lat && lng ? { latitude: Number(lat), longitude: Number(lng) } : undefined;
  }, [branchData?.location]);

  const customerDestinationsMapProp = useMemo(() => {
    return liveOrders.map((o: any) => {
      const loc = o.customer?.location || o.customer?.address;
      if (!loc) return null;
      const lat = loc.lat ?? loc.latitude;
      const lng = loc.lng ?? loc.longitude;
      return lat && lng ? { latitude: Number(lat), longitude: Number(lng), name: o.customer?.name } : null;
    }).filter(Boolean);
  }, [liveOrders]);

  useAutoNavigation(isNavigating ? (routeDestinationMapProp ? { lat: routeDestinationMapProp.latitude, lng: routeDestinationMapProp.longitude } : null) : null);

  const flow = FLOW_CONFIG[currentStatus] || { textKey: 'flow_waiting', finished: true, grad: '#374151' };
  const isMapView = !isPicking && ['assigned', 'accepted', 'go_to_branch', 'picked', 'out_for_delivery'].includes(currentStatus);
  const hasNavHeader = ['go_to_branch', 'picked', 'out_for_delivery'].includes(currentStatus);

  const allPhotosTaken = useMemo(() => Object.keys(pickupPhotos).length > 0, [pickupPhotos]);
  const isAllItemsVerified = useMemo(() => {
    const activeOrders = (liveOrders || []).filter((o: any) =>
      !['delivered', 'cancelled', 'returned', 'success', 'skipped'].includes(o.status)
    );
    const allItems: Array<{orderId: string, localIdx: number}> = [];
    activeOrders.forEach((ord: any) => {
      if (ord.items) ord.items.forEach((_: any, idx: number) => allItems.push({ orderId: ord.id, localIdx: idx }));
    });
    return allItems.length > 0 && allItems.every(item => !!branchCheckedItems[`${item.orderId}-${item.localIdx}`]);
  }, [liveOrders, branchCheckedItems]);
  const isButtonDisabled = (currentStatus === 'arrived_at_branch') && (!isAllItemsVerified || !allPhotosTaken);

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

      const beforeDelivery = ['assigned', 'accepted', 'go_to_branch', 'arrived_at_branch'].includes(currentStatus);
      if (beforeDelivery) {
        if (currentStatus === 'arrived_at_branch') {
          setIsPicking(true);
          try {
            // 1. Upload photos first
            const uploadedUrls = await Promise.all(liveOrders.map(async (ord: any) => {
              const photoData = pickupPhotos[ord.id];
              const uri = photoData?.uri || photoData?.file?.uri || photoData?.previewUrl;
              if (!uri) return { id: ord.id, url: '' };

              try {
                const response = await fetch(uri);
                const blob = await response.blob();
                const sRef = storageRef(storage, `pickup_proofs/${ord.id}.jpg`);
                const uploadResult = await uploadBytes(sRef, blob);
                const url = await getDownloadURL(uploadResult.ref);
                return { id: ord.id, url };
              } catch (err) {
                console.error(`Upload failed for order ${ord.id}:`, err);
                return { id: ord.id, url: '' };
              }
            }));

            const urlMap = uploadedUrls.reduce((acc: any, item: any) => {
              acc[item.id] = item.url;
              return acc;
            }, {});

            const batch = writeBatch(db);
            // 2. Update status and pickupProofImage for all orders
            liveOrders.forEach((ord: any) => {
              batch.update(doc(db, 'orders', ord.id), {
                status: 'picked',
                pickedAt: serverTimestamp(),
                pickupProofImage: urlMap[ord.id] || '',
                updatedAt: serverTimestamp(),
                batchId: null,
              });
            });
            await batch.commit();
            await ensureMinDelay();

            // 3. Transition UI
            setIsPicking(false);
            setIsPickedSuccess(true);
            setIsUploading(false); // No longer blocking
            showToast?.(t('toast_picked'), `#${activeOrder.id}`, 'order_status');
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
        setVisualStatus(flow.next);
        await ensureMinDelay();
        if (currentStatus === 'assigned') showToast?.(t('toast_accepted'), `#${activeOrder.id}`, 'new_order');
        else if (currentStatus === 'accepted') {
          showToast?.(t('flow_go_branch'), `#${activeOrder.id}`, 'order_status');
          setIsNavigating(true);
        }
        if (currentStatus === 'go_to_branch') showToast?.(t('toast_arrived_branch'), `#${activeOrder.id}`, 'order_status');
        else if (currentStatus === 'arrived_at_branch') {
          showToast?.(t('toast_trip_started'), `#${activeOrder.id}`, 'order_status');
          setIsNavigating(true);
        }
        return;
      }

      if (flow.isOTP) {
        setOtpOrder(activeOrder);
        return;
      }
      await updateDoc(doc(db, 'orders', activeOrder.id), { status: flow.next, [`${flow.next}At`]: serverTimestamp(), updatedAt: serverTimestamp() });
      setVisualStatus(flow.next);
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
    if (isPicking) {
      return (
        <View style={{ flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 32 }}>
          <View style={{
            width: 100, height: 100, borderRadius: 32,
            backgroundColor: `${T.accent}12`, borderWidth: 2, borderColor: `${T.accent}30`,
            alignItems: 'center', justifyContent: 'center'
          }}>
            <ActivityIndicator size="large" color={T.accent} />
          </View>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: font, fontSize: 22, fontWeight: '900', color: T.text, textAlign: 'center' }}>
              {lang === 'bn' ? 'পার্সেল প্রসেসিং হচ্ছে...' : 'Processing Parcels...'}
            </Text>
            <Text style={{ fontSize: 13, color: T.sub, textAlign: 'center', fontWeight: '600', lineHeight: 18 }}>
              {lang === 'bn' ? 'তথ্য ও ছবি আপলোড করা হচ্ছে, দয়া করে অপেক্ষা করুন।' : 'Uploading data and photos, please wait.'}
            </Text>
          </View>
        </View>
      );
    }
    if (transitionTargetOrder) {
      return (
        <NextOrderTransitionView
          targetOrder={transitionTargetOrder}
          riderLocation={riderLocation}
          onStart={() => {
            const idx = sortedOrders.findIndex(o => o.id === transitionTargetOrder.id);
            if (idx !== -1) {
              setCurrentIndex(idx);
              transitionPendingRef.current = false;
              setTransitionTargetOrder(null);
            } else {
              // It's a global order!
              // Call the callback to update the active batch in parent
              if (onActiveBatchChange) {
                setLiveOrders([transitionTargetOrder]);
                setCurrentIndex(0);
                onActiveBatchChange(transitionTargetOrder.id);
                transitionPendingRef.current = false;
                setTransitionTargetOrder(null);
              } else {
                // Fallback if no callback (e.g. standalone screen)
                setLiveOrders([transitionTargetOrder]);
                setCurrentIndex(0);
                transitionPendingRef.current = false;
                setTransitionTargetOrder(null);
              }
            }
          }}
        />
      );
    }
    if (isPickedSuccess) {
      return (
        <PickedSuccessView
          orders={liveOrders}
          riderLocation={riderLocation}
          onStartClosestDelivery={async (closestOrd: any) => {
            setIsPickedSuccess(false);
            // 1. Update the closest order's status to 'out_for_delivery' in Firestore
            try {
              await updateDoc(doc(db, 'orders', closestOrd.id), {
                status: 'out_for_delivery',
                out_for_deliveryAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
            } catch (err) {
              console.error("Start closest delivery error:", err);
            }

            // 2. Set activeBatchId in parent to this closest order's ID
            if (onActiveBatchChange) {
              onActiveBatchChange(closestOrd.id);
            }

            // 3. Trigger transition to out_for_delivery UI in OrderExecution
            setLiveOrders([closestOrd]);
            setCurrentIndex(0);
            setVisualStatus('out_for_delivery');
          }}
          onContinue={async () => {
            setIsPickedSuccess(false);
            if (liveOrders.length > 1) {
              // Batch order - close success screen and exit to home screen, leaving orders as 'picked'
              if (onFinish) onFinish();
              else if (onMinimize) onMinimize();
            } else {
              // Single order - transition to delivery page
              if (onActiveBatchChange) {
                onActiveBatchChange(activeOrder.id);
              }
              await handleAction();
            }
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

    const allCompleted = !transitionTargetOrder && !transitionPendingRef.current && liveOrders.every((o: any) => ['delivered', 'success', 'cancelled', 'rescheduled', 'skipped', 'returned'].includes(o.status));
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
      routeDestination: routeDestinationMapProp,
      heading,
      mapTouchTime
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
      case 'arrived_at_branch': return <ArrivedAtBranchView {...props} onPhotosChange={setPickupPhotos} checkedItems={branchCheckedItems} onCheckedItemsChange={setBranchCheckedItems} batchPhoto={branchPhoto} onBatchPhotoChange={setBranchPhoto} />;
      case 'picked':
      case 'out_for_delivery': return <GoToCustomerView {...props} batchOrders={[activeOrder]} orderStatus={currentStatus} onCancelRequest={() => setShowReturnModal(true)} />;
      case 'arrived_at_customer': return <ArrivedAtCustomerView {...props} batchOrders={[activeOrder]} onCancelRequest={() => setShowReturnModal(true)} />;
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
              {isBatchMode ? `Drop ${currentIndex + 1}/${initialBatchSize.current}` : t('exec_order_label')} #{activeOrder.id}
            </Text>
            <Text adjustsFontSizeToFit style={{ fontFamily: font, fontSize: 24, letterSpacing: 1.5, textTransform: 'uppercase', color: T.text, lineHeight: 28 }} numberOfLines={1}>
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
          {hasNavHeader ? (
            <>
              <Pressable onPress={() => (onMinimize ? onMinimize() : router.back())} style={{ position: 'absolute', top: insets.top + 90, right: 16, zIndex: 100, width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}>
                <ChevronDown size={19} color="#fff" strokeWidth={2.5} />
              </Pressable>
              {isBatchMode && (
                <Pressable onPress={() => setShowOverviewDrawer(true)} style={{ position: 'absolute', top: insets.top + 90, left: 16, zIndex: 100, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.65)', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: `${T.accent}66` }}>
                  <ListOrdered size={16} color={T.accent} />
                  <Text style={{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, color: '#fff' }}>
                    {lang === 'bn' ? `ডেলিভারি ${currentIndex + 1}/${initialBatchSize.current}` : `Drop ${currentIndex + 1}/${initialBatchSize.current}`}
                  </Text>
                  <ChevronDown size={14} color="rgba(255,255,255,0.6)" strokeWidth={2.5} />
                </Pressable>
              )}
            </>
          ) : (
            <Animated.View entering={FadeInUp.duration(400)} style={{
              position: 'absolute',
              top: insets.top + 10,
              left: 16, right: 16,
              zIndex: 100,
            }}>
              <View style={{
                backgroundColor: isDark ? 'rgba(30,30,45,0.95)' : 'rgba(255,255,255,0.95)',
                borderWidth: 1,
                borderColor: T.border,
                borderRadius: 20,
                paddingVertical: 14,
                paddingHorizontal: 20,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOpacity: 0.15,
                shadowRadius: 15,
                elevation: 8
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, color: T.accent, marginBottom: 4 }}>
                    {lang === 'bn' ? 'মোট দূরত্ব' : 'TOTAL DISTANCE'}
                  </Text>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: T.text }}>
                    {routeInfo?.distance || '--'}
                  </Text>
                </View>

                <View style={{ width: 1, height: 34, backgroundColor: T.border, marginHorizontal: 16 }} />

                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 4 }}>
                    {lang === 'bn' ? 'আনুমানিক সময়' : 'EST. TIME'}
                  </Text>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: T.text }}>
                    {routeInfo?.duration || '--'}
                  </Text>
                </View>

                <View style={{ width: 1, height: 34, backgroundColor: T.border, marginHorizontal: 16 }} />

                <Pressable onPress={() => (onMinimize ? onMinimize() : router.back())} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={20} color={T.text} strokeWidth={2.5} />
                </Pressable>
              </View>
              {isBatchMode && (
                <Pressable onPress={() => setShowOverviewDrawer(true)} style={{ alignSelf: 'flex-start', marginTop: 12, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.65)', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: `${T.accent}66` }}>
                  <ListOrdered size={16} color={T.accent} />
                  <Text style={{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, color: '#fff' }}>
                    {lang === 'bn' ? `ডেলিভারি ${currentIndex + 1}/${initialBatchSize.current}` : `Drop ${currentIndex + 1}/${initialBatchSize.current}`}
                  </Text>
                  <ChevronDown size={14} color="rgba(255,255,255,0.6)" strokeWidth={2.5} />
                </Pressable>
              )}
            </Animated.View>
          )}
        </>
      )}

      {isMapView && (
        <View style={{ position: 'absolute', inset: 0 }}>
          {['assigned', 'accepted'].includes(currentStatus) ? (
            <SimpleOverviewMap
              assignedOrders={liveOrders}
              livePos={riderLocation}
              branchLocation={branchLocationMapProp}
              customerDestinations={customerDestinationsMapProp}
              isAccepted={currentStatus === 'accepted'}
              accentColor={T.accent}
              T={T}
              lang={lang}
              isDark={isDark}
              onRouteReady={setRouteInfo}
              onMapInteraction={() => setMapTouchTime(Date.now())}
            />
          ) : (
            <RouteOverviewMap
              assignedOrders={liveOrders}
              branches={branches}
              minimal={true}
              routeOrigin={riderLocation ? { latitude: riderLocation.lat, longitude: riderLocation.lng } : undefined}
              routeDestination={routeDestinationMapProp}
              onRouteReady={setRouteInfo}
              accentColor={T.accent}
              navigationMode={isNavigating}
              followMode={followMode}
              onFollowModeChange={setFollowMode}
              livePos={riderLocation}
              heading={heading || 0}
              currentStatus={currentStatus}
              branchLocation={branchLocationMapProp}
              customerDestinations={customerDestinationsMapProp}
              onMapInteraction={() => setMapTouchTime(Date.now())}
            />
          )}
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
      {!isPicking && !flow.finished && !isPickedSuccess && !transitionTargetOrder && (
        <Animated.View
          layout={LinearTransition.springify().damping(25).stiffness(200)}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 80, padding: 16, paddingBottom: Math.max(24, insets.bottom + 8), flexDirection: 'row', gap: 10, backgroundColor: isMapView ? 'transparent' : T.bg, borderTopWidth: 0 }}
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
              <UnreadBadge count={totalUnread} bg={surfHi} />
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
              const deliveredOrder = otpOrder;
              setOtpOrder(null);
              showToast?.(t('toast_delivered'), `#${deliveredOrder.id}`, 'order_status');

              // Seamlessly calculate and trigger transition directly from the completed order to the next nearest one
              const DONE = ['delivered', 'success', 'cancelled', 'rescheduled', 'skipped', 'returned'];
              const nextIncomplete = liveOrders.find((o: any) => o.id !== deliveredOrder.id && !DONE.includes(o.status));

              if (nextIncomplete) {
                transitionPendingRef.current = true;
                setTransitionTargetOrder(nextIncomplete);
              } else {
                // If there's no other order in the active batch/liveOrders, find the next nearest incomplete global order
                const globalIncomplete = contextActiveOrders.filter((o: any) => o.id !== deliveredOrder.id && !DONE.includes(o.status) && !liveOrders.some(x => x.id === o.id));
                if (globalIncomplete.length > 0 && riderLocation) {
                  const sorted = [...globalIncomplete].sort((a: any, b: any) => {
                    const aLoc = a.customer?.location || a.customer?.address;
                    const bLoc = b.customer?.location || b.customer?.address;
                    const aLat = aLoc?.lat ?? aLoc?.latitude;
                    const aLng = aLoc?.lng ?? aLoc?.longitude;
                    const bLat = bLoc?.lat ?? bLoc?.latitude;
                    const bLng = bLoc?.lng ?? bLoc?.longitude;

                    if (!aLat || !aLng) return 1;
                    if (!bLat || !bLng) return -1;

                    const distA = calculateDistance(riderLocation.lat, riderLocation.lng, Number(aLat), Number(aLng));
                    const distB = calculateDistance(riderLocation.lat, riderLocation.lng, Number(bLat), Number(bLng));
                    return distA - distB;
                  });

                  transitionPendingRef.current = true;
                  setTransitionTargetOrder(sorted[0]);
                }
              }
            }}
            onCancel={() => setOtpOrder(null)}
            hasNextOrder={initialBatchSize.current > 1 && currentIndex < sortedOrders.length - 1}
            nextOrder={sortedOrders[currentIndex + 1]}
          />
        </View>
      )}

      {/* OFFLINE CONNECTION BANNER */}
      {!isConnected && (
        <Animated.View
          entering={FadeInUp.springify().damping(15)}
          exiting={FadeOut.duration(200)}
          style={{
            position: 'absolute',
            top: insets.top + 80, // perfect spacing right below header
            left: 20,
            right: 20,
            zIndex: 9999,
            backgroundColor: 'rgba(239, 68, 68, 0.95)', // translucent vibrant red
            borderRadius: 16,
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderWidth: 1.5,
            borderColor: 'rgba(239, 68, 68, 0.4)',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            shadowColor: '#ef4444',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          <AlertCircle size={20} color="#ffffff" strokeWidth={2.5} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 }}>
              {lang === 'bn' ? 'সংযোগ বিচ্ছিন্ন হয়েছে' : 'Connection Lost'}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '700', marginTop: 1, fontFamily: font }}>
              {lang === 'bn' ? 'অফলাইন মোড সক্রিয় - আপনার লোকেশন ট্র্যাকিং বজায় থাকবে।' : 'Offline mode active - location tracking will still persist.'}
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
