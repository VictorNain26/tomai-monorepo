/**
 * Push Notifications Service
 *
 * Handles Expo Push Notifications registration and handling.
 *
 * Best Practice 2026: expo-notifications with proper permission handling.
 * @see https://docs.expo.dev/push-notifications/overview/
 *
 * IMPORTANT: Push notifications require a development build (not Expo Go on Android SDK 53+)
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { apiClient } from '@repo/api';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Configure notification handling behavior.
 * This determines how notifications are displayed when app is in foreground.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

// ============================================================================
// TYPES
// ============================================================================

export interface NotificationData {
  type: 'homework_reminder' | 'study_streak' | 'parent_message' | 'system';
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

export interface PushTokenResult {
  token: string | null;
  error: string | null;
}

// ============================================================================
// ANDROID CHANNELS
// ============================================================================

/**
 * Setup Android notification channels.
 * IMPORTANT: On Android 13+, channels MUST be created BEFORE getting push token,
 * as the permission prompt won't appear until at least one channel exists.
 */
async function setupAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  // Default channel for general notifications
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

  // Homework reminders channel
  await Notifications.setNotificationChannelAsync('homework', {
    name: 'Rappels devoirs',
    description: 'Rappels pour les devoirs à rendre',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: true,
  });

  // Study streaks channel
  await Notifications.setNotificationChannelAsync('streaks', {
    name: 'Séries d\'étude',
    description: 'Notifications pour maintenir ta série d\'étude',
    importance: Notifications.AndroidImportance.DEFAULT,
    enableVibrate: false,
  });

  // Parent messages channel
  await Notifications.setNotificationChannelAsync('parent', {
    name: 'Messages parents',
    description: 'Messages de tes parents',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: true,
  });

  console.log('[Notifications] Android channels configured');
}

// ============================================================================
// REGISTRATION
// ============================================================================

/**
 * Register for push notifications and get Expo push token.
 * Returns null if notifications are not available or permission denied.
 *
 * IMPORTANT: This won't work in Expo Go on Android (SDK 53+).
 * A development build is required.
 */
export async function registerForPushNotifications(): Promise<PushTokenResult> {
  // Check if running on physical device
  if (!Device.isDevice) {
    console.log('[Notifications] Not a physical device, skipping registration');
    return {
      token: null,
      error: 'Les notifications push nécessitent un appareil physique',
    };
  }

  try {
    // IMPORTANT: Setup Android channels BEFORE requesting permissions
    // On Android 13+, the permission prompt won't appear until a channel exists
    await setupAndroidChannels();

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission not granted');
      return {
        token: null,
        error: 'Permission refusée pour les notifications',
      };
    }

    // Get project ID from Expo config
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.error('[Notifications] EAS project ID not found');
      return {
        token: null,
        error: 'Configuration EAS manquante (projectId)',
      };
    }

    // Get Expo push token with retry logic for offline scenarios
    let token: string;
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      token = tokenData.data;
    } catch (tokenError) {
      console.error('[Notifications] Error getting push token:', tokenError);
      return {
        token: null,
        error: 'Impossible d\'obtenir le token push. Vérifiez votre connexion.',
      };
    }

    console.log('[Notifications] Push token obtained:', token.slice(0, 20) + '...');

    return { token, error: null };
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
export async function savePushTokenToBackend(token: string): Promise<boolean> {
  try {
    await apiClient.post('/api/users/push-token', {
      token,
      platform: Platform.OS,
      deviceName: Device.deviceName ?? 'Unknown',
    });
    console.log('[Notifications] Token saved to backend');
    return true;
  } catch (error) {
    console.error('[Notifications] Failed to save token:', error);
    return false;
  }
}

/**
 * Full registration flow: setup channels, get token, and save to backend.
 */
export async function setupPushNotifications(): Promise<boolean> {
  const result = await registerForPushNotifications();

  if (!result.token) {
    console.warn('[Notifications] Setup failed:', result.error);
    return false;
  }

  return savePushTokenToBackend(result.token);
}

// ============================================================================
// NOTIFICATION HANDLING
// ============================================================================

/**
 * Add listener for received notifications (app in foreground).
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add listener for notification interactions (tap).
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Get last notification response (if app opened from notification).
 */
export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  return Notifications.getLastNotificationResponseAsync();
}

// ============================================================================
// LOCAL NOTIFICATIONS
// ============================================================================

/**
 * Schedule a local notification.
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  trigger: Notifications.NotificationTriggerInput,
  data?: NotificationData,
  channelId: string = 'default'
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data as Record<string, unknown>,
      sound: 'default',
      ...(Platform.OS === 'android' && { channelId }),
    },
    trigger,
  });
}

/**
 * Schedule a homework reminder.
 */
export async function scheduleHomeworkReminder(
  homeworkTitle: string,
  dueDate: Date,
  hoursBeforeDue: number = 24
): Promise<string> {
  const reminderDate = new Date(dueDate.getTime() - hoursBeforeDue * 60 * 60 * 1000);

  // Don't schedule if reminder date is in the past
  if (reminderDate <= new Date()) {
    return '';
  }

  return scheduleLocalNotification(
    'Rappel devoir',
    `N'oublie pas : ${homeworkTitle}`,
    { date: reminderDate },
    {
      type: 'homework_reminder',
      data: { homeworkTitle, dueDate: dueDate.toISOString() },
    },
    'homework'
  );
}

/**
 * Schedule a study streak reminder.
 */
export async function scheduleStreakReminder(
  currentStreak: number
): Promise<string> {
  // Schedule for 6 PM local time
  const now = new Date();
  const reminderTime = new Date(now);
  reminderTime.setHours(18, 0, 0, 0);

  // If 6 PM has passed, schedule for tomorrow
  if (reminderTime <= now) {
    reminderTime.setDate(reminderTime.getDate() + 1);
  }

  return scheduleLocalNotification(
    'Continue ta série !',
    `Tu as une série de ${currentStreak} jours. Révise maintenant pour ne pas la perdre !`,
    { date: reminderTime },
    {
      type: 'study_streak',
      data: { currentStreak },
    },
    'streaks'
  );
}

/**
 * Cancel a scheduled notification.
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

/**
 * Cancel all scheduled notifications.
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get all scheduled notifications.
 */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return Notifications.getAllScheduledNotificationsAsync();
}

// ============================================================================
// BADGE MANAGEMENT
// ============================================================================

/**
 * Set app badge count.
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Get current badge count.
 */
export async function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync();
}

/**
 * Clear badge count.
 */
export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}

// ============================================================================
// PERMISSION CHECK
// ============================================================================

/**
 * Check if notifications are enabled.
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}
