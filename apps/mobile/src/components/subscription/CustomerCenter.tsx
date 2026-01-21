/**
 * Customer Center Component
 *
 * Provides self-service subscription management UI.
 * Users can manage, cancel, or restore their subscriptions.
 *
 * @see https://www.revenuecat.com/docs/tools/customer-center/customer-center-react-native
 */

import RevenueCatUI from 'react-native-purchases-ui';
import type { CustomerInfo } from 'react-native-purchases';

interface CustomerCenterCallbacks {
  /** Called when user completes a feedback survey */
  onFeedbackSurveyCompleted?: () => void;
  /** Called when restore is successful */
  onRestoreCompleted?: (customerInfo: CustomerInfo) => void;
  /** Called when user selects a management option */
  onManagementOptionSelected?: (option: string) => void;
}

/**
 * Present Customer Center modally.
 *
 * Customer Center allows users to:
 * - Cancel subscription
 * - Restore purchases
 * - Request refund (iOS only)
 * - Change plan (iOS only)
 *
 * @example
 * ```tsx
 * // In settings screen
 * <Button onPress={presentCustomerCenter}>
 *   Gérer mon abonnement
 * </Button>
 * ```
 */
export async function presentCustomerCenter(
  callbacks?: CustomerCenterCallbacks
): Promise<void> {
  try {
    await RevenueCatUI.presentCustomerCenter({
      callbacks: {
        onFeedbackSurveyCompleted: () => {
          console.log('[CustomerCenter] Feedback survey completed');
          callbacks?.onFeedbackSurveyCompleted?.();
        },
        onRestoreCompleted: (param: { customerInfo: CustomerInfo }) => {
          console.log('[CustomerCenter] Restore completed');
          callbacks?.onRestoreCompleted?.(param.customerInfo);
        },
        onManagementOptionSelected: (param: { option: string }) => {
          console.log('[CustomerCenter] Management option selected:', param.option);
          callbacks?.onManagementOptionSelected?.(param.option);
        },
      },
    });
  } catch (error) {
    console.error('[CustomerCenter] Error presenting:', error);
    throw error;
  }
}
