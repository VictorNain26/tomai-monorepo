/**
 * Push Notifications Service
 *
 * Handles Expo Push Notifications registration and token sync.
 *
 * ARCHITECTURE: expo-notifications is loaded via dynamic import() AFTER the
 * Expo Go guard. This prevents the native module from loading in Expo Go,
 * which avoids the WARN + ERROR that appear since SDK 53 removed push
 * notification support from Expo Go on Android.
 *
 * @see https://docs.expo.dev/push-notifications/overview/
 */

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { getTreaty, unwrap } from '@repo/api';

/**
 * Setup Android notification channels.
 * On Android 13+, channels MUST be created BEFORE getting push token.
 */
async function setupAndroidChannels(
  Notifications: typeof import('expo-notifications')
): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Notifications générales',
    description: 'Notifications générales de TomIA',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4f46e5',
    sound: 'default',
    enableVibrate: true,
    enableLights: true,
  });

  await Notifications.setNotificationChannelAsync('homework', {
    name: 'Rappels devoirs',
    description: 'Rappels pour les devoirs à rendre',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: true,
  });

  await Notifications.setNotificationChannelAsync('streaks', {
    name: 'Séries d\'étude',
    description: 'Notifications pour maintenir ta série d\'étude',
    importance: Notifications.AndroidImportance.DEFAULT,
    enableVibrate: false,
  });

  await Notifications.setNotificationChannelAsync('parent', {
    name: 'Messages parents',
    description: 'Messages de tes parents',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: true,
  });

  console.log('[Notifications] Android channels configured');
}

/**
 * Register for push notifications and get Expo push token.
 */
async function registerForPushNotifications(
  Notifications: typeof import('expo-notifications')
): Promise<{ token: string | null; error: string | null }> {
  if (!Device.isDevice) {
    console.log('[Notifications] Not a physical device, skipping registration');
    return { token: null, error: 'Appareil physique requis' };
  }

  try {
    await setupAndroidChannels(Notifications);

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission not granted');
      return { token: null, error: 'Permission refusée' };
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.error('[Notifications] EAS project ID not found');
      return { token: null, error: 'Configuration EAS manquante (projectId)' };
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('[Notifications] Push token obtained:', tokenData.data.slice(0, 20) + '...');
    return { token: tokenData.data, error: null };
  } catch (error) {
    console.error('[Notifications] Registration error:', error);
    return {
      token: null,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    };
  }
}

/**
 * Send push token to backend for storage.
 */
async function savePushTokenToBackend(token: string): Promise<boolean> {
  try {
    unwrap(
      await getTreaty().api.users['push-token'].post({
        token,
        platform: Platform.OS as 'ios' | 'android',
        deviceName: Device.deviceName ?? 'Unknown',
      })
    );
    console.log('[Notifications] Token saved to backend');
    return true;
  } catch (error) {
    console.error('[Notifications] Failed to save token:', error);
    return false;
  }
}

/**
 * Full push notification setup: configure handler, register, save token.
 *
 * expo-notifications is dynamically imported here, AFTER the Expo Go guard,
 * so the native module never loads in Expo Go (no WARN/ERROR).
 */
export async function setupPushNotifications(): Promise<boolean> {
  if (Constants.appOwnership === 'expo') {
    console.log('[Notifications] Skipping push setup in Expo Go');
    return false;
  }

  const Notifications = await import('expo-notifications');

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  });

  const result = await registerForPushNotifications(Notifications);

  if (!result.token) {
    console.warn('[Notifications] Setup failed:', result.error);
    return false;
  }

  return savePushTokenToBackend(result.token);
}
