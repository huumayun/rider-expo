import React from 'react';
import { View, Text, Pressable, Animated, ScrollView, StyleSheet } from 'react-native';
import { Package, MapPin, ChevronRight, RotateCcw } from 'lucide-react-native';
import { calcDist, fmtDist, STATUS_COLOR } from './mapUtils';

export const OrderListSheet = React.memo(({
  cardsAnim,
  assignedOrders,
  activeBatchGroups,
  branches,
  selectedBatchId,
  closestBatchId,
  livePos,
  onOpenOrder,
  onAcceptOrder,
  onRejectOrder,
  handleMarkerClick,
  setSelectedBatchId,
  returningCount,
  T,
  lang,
  font,
  labels,
  isDark,
  scrollRef,
  hideBottomNav,
}: any) => {
  if (!activeBatchGroups || activeBatchGroups.length === 0) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: cardsAnim }],
          backgroundColor: isDark ? '#12121f' : '#f8f8fc',
          borderColor: T.border,
          bottom: hideBottomNav ? 0 : 80,
        },
      ]}
    >
      {/* Handle */}
      <View style={styles.handleWrap}>
        <View style={[styles.handle, { backgroundColor: T.border }]} />
      </View>

      {/* Title row */}
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: T.text, fontFamily: font }]}>
          {labels.list?.[lang] ?? 'Task Overview'}
        </Text>
        <View style={[styles.badge, { backgroundColor: T.accent }]}>
          <Text style={styles.badgeText}>{activeBatchGroups.length}</Text>
        </View>
        {returningCount > 0 && (
          <View style={[styles.badge, { backgroundColor: '#f97316', marginLeft: 6 }]}>
            <RotateCcw size={10} color="#fff" />
            <Text style={styles.badgeText}>{returningCount}</Text>
          </View>
        )}
      </View>

      {/* Batch cards */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {activeBatchGroups.map((batch: any) => {
          const p = batch[0];
          const batchId = p.batchId || p.id;
          const isSelected = selectedBatchId === batchId;
          const isClosest = closestBatchId === batchId;
          const color = STATUS_COLOR[p.status] || T.accent;

          const isBeforePick = ['assigned', 'accepted', 'go_to_branch', 'arrived_at_branch'].includes(p.status);
          const bLoc = branches?.[p.branchId]?.location || p.pickupLocation || p.branchDetail?.location;
          const target = isBeforePick && bLoc?.lat ? bLoc : (p.customer?.location || p.deliveryLocation);

          const dist = livePos && target?.lat
            ? fmtDist(calcDist(livePos.lat, livePos.lng, Number(target.lat), Number(target.lng)))
            : null;

          const branchName = branches?.[p.branchId]?.name || p.branchDetail?.name || '';
          const customerName = p.customer?.name || '';
          const itemCount = batch.reduce((acc: number, o: any) => acc + (o.items?.length ?? o.itemCount ?? 0), 0);

          return (
            <Pressable
              key={batchId}
              onPress={() => handleMarkerClick(batchId, target)}
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? '#1e1e2e' : '#fff',
                  borderColor: isSelected ? color : T.border,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
            >
              {/* Status dot + label */}
              <View style={styles.cardHeader}>
                <View style={[styles.statusDot, { backgroundColor: color }]} />
                <Text style={[styles.statusText, { color, fontFamily: font }]} numberOfLines={1}>
                  {p.status?.replace(/_/g, ' ') ?? ''}
                </Text>
                {isClosest && (
                  <View style={[styles.closestBadge, { backgroundColor: color }]}>
                    <Text style={styles.closestText}>★</Text>
                  </View>
                )}
              </View>

              {/* Branch */}
              {branchName ? (
                <Text style={[styles.branchName, { color: T.text, fontFamily: font }]} numberOfLines={1}>
                  {branchName}
                </Text>
              ) : null}

              {/* Customer */}
              {customerName ? (
                <Text style={[styles.customerName, { color: T.sub }]} numberOfLines={1}>
                  {customerName}
                </Text>
              ) : null}

              {/* Distance + items */}
              <View style={styles.cardFooter}>
                {dist && (
                  <View style={styles.footerItem}>
                    <MapPin size={11} color={T.sub} />
                    <Text style={[styles.footerText, { color: T.sub }]}>{dist}</Text>
                  </View>
                )}
                {itemCount > 0 && (
                  <View style={styles.footerItem}>
                    <Package size={11} color={T.sub} />
                    <Text style={[styles.footerText, { color: T.sub }]}>{itemCount}{labels.items?.[lang] ?? ' items'}</Text>
                  </View>
                )}
              </View>

              {/* Open arrow */}
              <Pressable
                onPress={() => onOpenOrder?.(p)}
                style={[styles.openBtn, { backgroundColor: `${color}15` }]}
                hitSlop={6}
              >
                <ChevronRight size={14} color={color} />
              </Pressable>
            </Pressable>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    zIndex: 80,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  scroll: {
    paddingHorizontal: 12,
    gap: 10,
    paddingBottom: 4,
  },
  card: {
    width: 160,
    borderRadius: 16,
    padding: 12,
    gap: 4,
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  closestBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closestText: {
    color: '#fff',
    fontSize: 8,
  },
  branchName: {
    fontSize: 13,
    fontWeight: '700',
  },
  customerName: {
    fontSize: 11,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  footerText: {
    fontSize: 11,
  },
  openBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
