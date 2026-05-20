import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  Platform, Animated,
} from 'react-native';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../src/context/AppContext';
import { useRiderData, RiderDataProvider } from '../../src/context/RiderDataContext';
import { useAuthStore } from '../../src/store/authStore';
import { useUIStore } from '../../src/store/uiStore';
import { NoInternet } from '../../src/components/NoInternet';

import {
  Home, Package, Wallet, Bell, User
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS = [
  { name: 'index', labelKey: 'nav_home', icon: Home },
  { name: 'orders', labelKey: 'nav_orders', icon: Package },
  { name: 'wallet', labelKey: 'nav_wallet', icon: Wallet },
  { name: 'notifications', labelKey: 'nav_alerts', icon: Bell },
  { name: 'profile', labelKey: 'nav_profile', icon: User },
];

// ─── Custom tab bar ───────────────────────────────────────────────────────────
function TabItem({ route, index, isFocused, badge, Icon, label, onPress, isDark, T, t }: any) {
  // Animation for bounce/swing like Web
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const rotateAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (isFocused) {
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.2, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      ]).start();
    }
  }, [isFocused]);

  const rotation = rotateAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-10deg', '10deg'],
  });

  return (
    <TouchableOpacity
      key={route.name}
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.tabItem}
    >
      {/* Active indicator line on top like Web */}
      {isFocused && (
        <Animated.View
          style={[
            styles.activeLine,
            {
              backgroundColor: '#22d47a',
              transform: [{ scaleX: scaleAnim }]
            }
          ]}
        />
      )}

      {/* Icon container */}
      <Animated.View style={[styles.iconWrap, { transform: [{ scale: scaleAnim }, { rotate: rotation }] }]}>
        <Icon
          size={22}
          strokeWidth={isFocused ? 2.5 : 1.8}
          color={isFocused ? '#22d47a' : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.4)')}
        />

        {/* Badge */}
        {badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </Animated.View>

      {/* Label */}
      <Text style={[
        styles.tabLabel,
        { color: isFocused ? '#22d47a' : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.4)') },
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Custom tab bar ───────────────────────────────────────────────────────────
function CustomTabBar({ state, navigation }: any) {
  const { T, t, theme } = useApp();
  const { activeOrders, totalUnread } = useRiderData();
  const insets = useSafeAreaInsets();
  const isDark = theme === 'dark';

  const pathname = usePathname();
  const viewMode = useUIStore(s => s.viewMode);
  const hideBottomNav = useUIStore(s => s.hideBottomNav);
  const isExecuting = useUIStore(s => s.isExecuting);

  // Strictly only show on these 5 main paths, and not when executing an order
  // If in map mode, only show if hideBottomNav is manually set to false
  const mainPaths = ['/', '/orders', '/wallet', '/notifications', '/profile'];
  const isMainTab = mainPaths.includes(pathname) && !isExecuting && (viewMode !== 'map' || !hideBottomNav);

  const slideAnim = React.useRef(new Animated.Value(isMainTab ? 0 : 150)).current;

  React.useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isMainTab ? 0 : 150,
      useNativeDriver: true,
      tension: 40,
      friction: 8
    }).start();
  }, [isMainTab]);

  const activeBadges: Record<string, number> = {
    orders: activeOrders.length,
    notifications: totalUnread,
  };

  return (
    <Animated.View 
      pointerEvents={isMainTab ? 'auto' : 'none'}
      style={[
        styles.navContainer, 
        { 
          bottom: Math.max(insets.bottom, 12),
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      {/* Ambient background glow matching web */}
      <View style={[
        styles.ambientGlow,
        { backgroundColor: isDark ? 'rgba(34,212,122,0.04)' : 'rgba(34,212,122,0.02)' }
      ]} />

      <View
        style={[
          styles.tabBar,
          {
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
            backgroundColor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)',
          },
        ]}
      >
        {state.routes.map((route: any, index: number) => {
          const tab = TABS.find(t => t.name === route.name);
          if (!tab) return null;

          const isFocused = state.index === index;
          const badge = activeBadges[route.name] || 0;
          const Icon = tab.icon;

          const onPress = () => {
            if (!isFocused) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TabItem
              key={route.name}
              route={route}
              index={index}
              isFocused={isFocused}
              badge={badge}
              Icon={Icon}
              label={t(tab.labelKey)}
              onPress={onPress}
              isDark={isDark}
              T={T}
              t={t}
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

// ─── Inner layout (needs RiderData context) ───────────────────────────────────
function AppTabsLayout() {
  const { T } = useApp();

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="orders" />
        <Tabs.Screen name="wallet" />
        <Tabs.Screen name="notifications" />
        <Tabs.Screen name="profile" />
        {/* Hidden screens — accessible via push navigation */}
        <Tabs.Screen name="order-execution" options={{ href: null }} />
        <Tabs.Screen name="delivery-confirmation" options={{ href: null }} />
        <Tabs.Screen name="chat/index" options={{ href: null }} />
        <Tabs.Screen name="chat/[orderId]" options={{ href: null }} />
        <Tabs.Screen name="attendance" options={{ href: null }} />
      </Tabs>

      {/* Global no-internet overlay */}
      <NoInternet />
    </View>
  );
}

// ─── Root (app) layout ────────────────────────────────────────────────────────
export default function AppLayout() {
  return (
    <RiderDataProvider>
      <AppTabsLayout />
    </RiderDataProvider>
  );
}

const styles = StyleSheet.create({
  navContainer: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 1000,
  },
  ambientGlow: {
    position: 'absolute',
    bottom: -10,
    left: '20%',
    right: '20%',
    height: 40,
    borderRadius: 40,
    opacity: 0.5,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 28,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  activeLine: {
    position: 'absolute',
    top: -10,
    width: 28,
    height: 3,
    borderRadius: 2,
    shadowColor: '#22d47a',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
    marginBottom: 4,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#f43f5e',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  badgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    lineHeight: 10,
  },
  tabLabel: {
    fontSize: 8,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
