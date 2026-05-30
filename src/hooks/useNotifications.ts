import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

interface UseNotificationsOptions {
  uid: string | undefined;
  onForeground?: (title: string, body: string, type: string | null) => void;
  onNotificationTap?: (type: string | null, data: any) => void;
}

export function useNotifications({ uid, onForeground, onNotificationTap }: UseNotificationsOptions) {
  const listenerRef = useRef<Notifications.Subscription | null>(null);
  const responseRef = useRef<Notifications.Subscription | null>(null);

  // Register push token with Firestore
  useEffect(() => {
    if (!uid) return;

    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[Notifications] Permission not granted');
        return;
      }

      try {
        // Use device token for standalone builds (FCM), Expo token for Expo Go
        const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
        let token;

        if (isExpoGo) {
          const tokenData = await Notifications.getExpoPushTokenAsync();
          token = tokenData.data;
        } else {
          const deviceToken = await Notifications.getDevicePushTokenAsync();
          token = deviceToken.data;
        }

        if (!token) return;

        // Path must match Cloud Function: fcm_tokens/${uid}_android
        const platformKey = Platform.OS === 'android' ? 'android' : (Platform.OS === 'ios' ? 'ios' : 'expo');

        await setDoc(
          doc(db, 'fcm_tokens', `${uid}_${platformKey}`),
          {
            userId: uid,
            role: 'riders',
            token,
            platform: Platform.OS,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn('[Notifications] Token registration failed:', e);
      }
    })();
  }, [uid]);

  // Foreground notification listener
  useEffect(() => {
    listenerRef.current = Notifications.addNotificationReceivedListener((notification) => {
      if (!onForeground) return;
      const title = notification.request.content.title ?? 'নতুন আপডেট';
      const body = notification.request.content.body ?? '';
      const type = (notification.request.content.data?.type as string) ?? null;
      onForeground(title, body, type);
    });

    // Background tap → foreground handler
    responseRef.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const type = response.notification.request.content.data?.type as string ?? null;
      const data = response.notification.request.content.data ?? {};
      if (onNotificationTap) onNotificationTap(type, data);
    });

    return () => {
      listenerRef.current?.remove();
      responseRef.current?.remove();
    };
  }, [onForeground]);
}
