/**
 * Haptic Feedback Utility - TomAI 2026 Best Practices
 *
 * Centralized haptic feedback patterns following iOS Human Interface Guidelines
 * and Material Design haptic specifications.
 *
 * Usage:
 *   import { haptics } from '@/lib/haptics';
 *   haptics.light();        // Light tap (button press)
 *   haptics.success();      // Success notification
 *   haptics.error();        // Error notification
 *   haptics.warning();      // Warning notification
 *
 * @see https://docs.expo.dev/versions/latest/sdk/haptics/
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Check if haptics are available (iOS always, Android varies by device)
 */
const isHapticsAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Safely trigger haptic feedback with error handling
 */
async function safeHaptic(
  fn: () => Promise<void>,
  fallback?: () => Promise<void>
): Promise<void> {
  if (!isHapticsAvailable) return;

  try {
    await fn();
  } catch {
    // Haptics may fail on some Android devices or emulators
    // Silently ignore - haptics are optional enhancement
    if (fallback) {
      try {
        await fallback();
      } catch {
        // Ignore fallback errors too
      }
    }
  }
}

/**
 * Impact feedback - for button presses and interactions
 */
const impact = {
  /** Light impact - standard button press */
  light: () =>
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),

  /** Medium impact - more prominent actions */
  medium: () =>
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),

  /** Heavy impact - significant actions (delete, submit) */
  heavy: () =>
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),

  /** Soft impact - subtle feedback (iOS 13+) */
  soft: () =>
    safeHaptic(
      () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft),
      () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    ),

  /** Rigid impact - crisp feedback (iOS 13+) */
  rigid: () =>
    safeHaptic(
      () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid),
      () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    ),
};

/**
 * Notification feedback - for success/error/warning states
 */
const notification = {
  /** Success - task completed, action successful */
  success: () =>
    safeHaptic(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    ),

  /** Error - action failed, invalid input */
  error: () =>
    safeHaptic(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    ),

  /** Warning - attention needed, caution */
  warning: () =>
    safeHaptic(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    ),
};

/**
 * Selection feedback - for picker/selection changes
 */
const selection = () =>
  safeHaptic(() => Haptics.selectionAsync());

/**
 * Convenient aliases for common patterns
 */
export const haptics = {
  // Impact patterns
  light: impact.light,
  medium: impact.medium,
  heavy: impact.heavy,
  soft: impact.soft,
  rigid: impact.rigid,

  // Notification patterns
  success: notification.success,
  error: notification.error,
  warning: notification.warning,

  // Selection (for pickers, toggles)
  selection,

  // Semantic aliases
  /** Standard button press */
  tap: impact.light,
  /** Destructive action confirmation */
  destructive: impact.heavy,
  /** Form submission */
  submit: impact.medium,
  /** Toggle switch */
  toggle: selection,
  /** Pull-to-refresh release */
  refresh: impact.medium,
  /** Swipe action */
  swipe: impact.light,
};
