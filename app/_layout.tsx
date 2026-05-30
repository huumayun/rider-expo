import '../global.css';
import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, BackHandler, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import {
  HindSiliguri_400Regular,
  HindSiliguri_500Medium,
  HindSiliguri_600SemiBold,
  HindSiliguri_700Bold,
} from '@expo-google-fonts/hind-siliguri';
import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import { auth, db, onAuthStateChanged, signOut, doc, onSnapshot, getDoc } from '../src/config/firebase';
import { useAuthStore } from '../src/store/authStore';
import { AppProvider, useApp } from '../src/context/AppContext';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { LocationProvider } from '../src/context/LocationContext';
import { AppSplashScreen } from '../src/components/SplashScreen';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { useNotifications } from '../src/hooks/useNotifications';
import NotificationToast from '../src/components/NotificationToast';

// ─── Keep native splash visible until we're ready ────────────────────────────
SplashScreen.preventAutoHideAsync();

// ─── Global notification handler ─────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Toast type ───────────────────────────────────────────────────────────────
export type ToastEntry = {
  id: number;
  title: string;
  body: string;
  type: string;
};

// ─── Route protection ─────────────────────────────────────────────────────────
function useProtectedRoute() {
  const { rider, isLoading } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === '(auth)';
    const loggedIn = !!rider;
    if (!loggedIn && !inAuth) router.replace('/(auth)/login');
    else if (loggedIn && inAuth) router.replace('/(app)');
  }, [rider, isLoading, segments]);
}

// ─── Android back handler ─────────────────────────────────────────────────────
function useBackHandler() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) {
        router.back();
      } else {
        // If we are at the root, exit the app
        BackHandler.exitApp();
      }
      return true;
    });
    return () => sub.remove();
  }, [router]);
}

// ─── Auth listener ────────────────────────────────────────────────────────────
function useAuthListener() {
  const { setRider, setLoading } = useAuthStore();

  useEffect(() => {
    let employeeUnsub: (() => void) | null = null;

    const authUnsub = onAuthStateChanged(auth, async (user: any) => {
      if (!user) {
        employeeUnsub?.();
        setRider(null);
        return;
      }

      try {
        // Verify role before granting access
        const snap = await getDoc(doc(db, 'employees', user.uid));
        const data = snap.data();
        const role = data?.role;

        if (role !== 'riders' && role !== 'rider_hub') {
          await signOut(auth);
          setRider(null);
          return;
        }

        // Real-time sync of rider profile
        employeeUnsub = onSnapshot(doc(db, 'employees', user.uid), (docSnap: any) => {
          if (docSnap.exists()) {
            const newData = docSnap.data();
            const currentRider = useAuthStore.getState().rider;
            
            // Optimization: Don't trigger a global re-render if only the location/timestamp changed
            // as this device is already updating its own location locally.
            if (currentRider) {
              const { currentLocation: _c, locationUpdatedAt: _t, ...restNew } = newData;
              const { currentLocation: _cc, locationUpdatedAt: _tt, ...restOld } = currentRider as any;
              
              if (JSON.stringify(restNew) === JSON.stringify(restOld)) {
                return;
              }
            }
            
            const resolvedPhoto = user.photoURL || newData.photoURL || newData.profilePic || newData.avatar || newData.photo;
            setRider({ uid: user.uid, photoURL: resolvedPhoto, ...newData } as any);
          } else {
            setRider(null);
          }
        });
      } catch (e) {
        console.error('[Auth] Error:', e);
        setRider(null);
      }
    });

    return () => { authUnsub(); employeeUnsub?.(); };
  }, [setRider]);
}

// ─── Inner app (needs router context) ────────────────────────────────────────
function InnerLayout({ onToast }: { onToast: (t: string, b: string, type?: string | null) => void }) {
  const { rider } = useAuthStore();
  const { T, theme, toastEnabled } = useApp();
  const router = useRouter();

  useProtectedRoute();
  useBackHandler();
  useAuthListener();
  useNotifications({
    uid: rider?.uid,
    onForeground: (title, body, type) => {
      if (toastEnabled) {
        onToast(title, body, type);
      }
    },
    onNotificationTap: (type, data) => {
      const t = type || data?.type;
      const targetId = data?.targetId || data?.chatId || data?.orderId;
      
      if (t === 'chat' || t === 'message') {
        if (targetId) router.push(`/chat/${targetId}`);
      } else if (t === 'new_order' || t === 'order_status' || t === 'order') {
        router.push(`/orders`);
      } else if (t === 'wallet') {
        router.push(`/wallet`);
      } else {
        router.push(`/(app)`);
      }
    }
  });

  const navTheme = theme === 'dark' ? DarkTheme : DefaultTheme;
  const customNavTheme = {
    ...navTheme,
    colors: {
      ...navTheme.colors,
      background: T.bg,
    },
  };

  return (
    <ThemeProvider value={customNavTheme}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} animated />
      <Stack screenOptions={{ 
        headerShown: false, 
        animation: 'fade',
        contentStyle: { backgroundColor: T.bg } 
      }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </ThemeProvider>
  );
}

// ─── Root layout ──────────────────────────────────────────────────────────────
export default function RootLayout() {
  const [showCustomSplash, setShowCustomSplash] = useState(true);
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const [fontsLoaded, fontError] = useFonts({
    HindSiliguri_400Regular,
    HindSiliguri_500Medium,
    HindSiliguri_600SemiBold,
    HindSiliguri_700Bold,
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  // Hide native splash once fonts are ready
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  const addToast = useCallback((title: string, body: string, type?: string | null) => {
    const lc = (title + body).toLowerCase();
    const resolved = type || (
      lc.includes('মেসেজ') || lc.includes('message') ? 'chat'
        : lc.includes('ওয়ালেট') || lc.includes('৳') ? 'wallet'
        : lc.includes('নতুন অর্ডার') || lc.includes('assigned') ? 'new_order'
        : 'order_status'
    );
    const entry: ToastEntry = { id: Date.now(), title, body, type: resolved };
    setToasts(prev => [...prev, entry]);
    // Auto-dismiss after 5s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== entry.id));
    }, 5000);
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <AppProvider globalToast={addToast}>
            <LocationProvider>
              {/* Custom animated splash overlay */}
              {showCustomSplash && (
                <AppSplashScreen onFinish={() => setShowCustomSplash(false)} />
              )}
              {!showCustomSplash && (
                <InnerLayout onToast={addToast} />
              )}
              <NotificationToast 
                toasts={toasts} 
                onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} 
              />
            </LocationProvider>
          </AppProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
