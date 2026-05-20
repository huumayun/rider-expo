import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const notificationService = {
  registerForPushNotificationsAsync: async (uid: string) => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#22d47a',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    try {
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

      const platform = Platform.OS;
      const platformKey = platform === 'android' ? 'android' : (platform === 'ios' ? 'ios' : 'expo');
      
      await setDoc(doc(db, 'fcm_tokens', `${uid}_${platformKey}`), {
        token,
        uid,
        platform,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      return token;
    } catch (error) {
      console.error("Failed to get push token", error);
    }
  }
};
