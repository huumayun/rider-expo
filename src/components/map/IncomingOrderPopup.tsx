import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet, Dimensions } from 'react-native';
import { X, Check, Package, MapPin } from 'lucide-react-native';
import { calcDist, fmtDist } from './mapUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const IncomingOrderPopup = React.memo(({
  incomingOrder,
  livePos,
  isDark,
  T,
  lang,
  font,
  labels,
  onAccept,
  onReject,
  onDismiss,
}: any) => {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const prevId = useRef<string | null>(null);

  useEffect(() => {
    if (incomingOrder?.id && incomingOrder.id !== prevId.current) {
      prevId.current = incomingOrder.id;
      slideAnim.setValue(300);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 55,
        friction: 10,
        useNativeDriver: true,
      }).start();
    }
    if (!incomingOrder) {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [incomingOrder?.id]);

  if (!incomingOrder) return null;

  const pickupLoc = incomingOrder.pickupLocation || incomingOrder.branchDetail?.location;
  const distToPickup = livePos && pickupLoc?.lat
    ? fmtDist(calcDist(livePos.lat, livePos.lng, Number(pickupLoc.lat), Number(pickupLoc.lng)))
    : null;

  const itemCount = incomingOrder.items?.length ?? incomingOrder.itemCount ?? 0;
  const earning = incomingOrder.estimatedEarning ?? incomingOrder.earning ?? null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <View style={[styles.card, { backgroundColor: isDark ? '#1e1e2e' : '#fff', borderColor: T.border }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.newBadge, { backgroundColor: T.accent }]}>
            <Text style={[styles.newBadgeText, { fontFamily: font }]}>{labels.newTag?.[lang] ?? 'NEW'}</Text>
          </View>
          <Pressable onPress={onDismiss} style={styles.closeBtn} hitSlop={8}>
            <X size={16} color={T.sub} />
          </Pressable>
        </View>

        {/* Body */}
        <View style={styles.body}>
          <View style={styles.row}>
            <Package size={15} color={T.accent} />
            <Text style={[styles.itemsText, { color: T.text, fontFamily: font }]}>
              {itemCount}{labels.items?.[lang] ?? ' items'}
            </Text>
            {distToPickup && (
              <>
                <View style={[styles.dot, { backgroundColor: T.border }]} />
                <MapPin size={13} color={T.sub} />
                <Text style={[styles.distText, { color: T.sub }]}>{distToPickup}</Text>
              </>
            )}
          </View>

          {earning != null && (
            <View style={styles.earningRow}>
              <Text style={[styles.earningLabel, { color: T.sub, fontFamily: font }]}>
                {labels.estEarning?.[lang] ?? 'Est. Earning'}
              </Text>
              <Text style={[styles.earningValue, { color: T.accent, fontFamily: font }]}>
                ৳{earning}
              </Text>
            </View>
          )}

          {incomingOrder.branchDetail?.name && (
            <View style={[styles.branchRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderColor: T.border }]}>
              <Text style={[styles.branchText, { color: T.sub }]} numberOfLines={1}>
                {incomingOrder.branchDetail.name}
              </Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            onPress={() => { onReject?.(incomingOrder.id); onDismiss?.(); }}
            style={[styles.btn, styles.rejectBtn, { borderColor: T.border }]}
          >
            <X size={16} color={T.sub} />
            <Text style={[styles.btnText, { color: T.sub, fontFamily: font }]}>{labels.reject?.[lang] ?? 'Ignore'}</Text>
          </Pressable>
          <Pressable
            onPress={() => { onAccept?.(incomingOrder.id); onDismiss?.(); }}
            style={[styles.btn, styles.acceptBtn, { backgroundColor: T.accent }]}
          >
            <Check size={16} color="#fff" />
            <Text style={[styles.btnText, { color: '#fff', fontFamily: font }]}>{labels.accept?.[lang] ?? 'Accept'}</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 390,
    left: 16,
    right: 16,
    zIndex: 200,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  newBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemsText: {
    fontSize: 14,
    fontWeight: '700',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  distText: {
    fontSize: 13,
  },
  earningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  earningLabel: {
    fontSize: 12,
  },
  earningValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  branchRow: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  branchText: {
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  rejectBtn: {
    borderWidth: 1,
  },
  acceptBtn: {},
  btnText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
