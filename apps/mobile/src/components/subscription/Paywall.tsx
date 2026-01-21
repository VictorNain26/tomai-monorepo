/**
 * Paywall Component
 *
 * Displays RevenueCat paywall for subscription purchase.
 * Uses RevenueCatUI for native paywall presentation.
 *
 * @see https://www.revenuecat.com/docs/tools/paywalls/displaying-paywalls
 */

import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { Text } from '@/components/ui/text';
import { ENTITLEMENT_ID } from '@/lib/revenuecat';

interface PaywallProps {
  /** Called when paywall is dismissed */
  onDismiss?: () => void;
  /** Called when purchase is successful */
  onPurchaseSuccess?: () => void;
  /** Called when restore is successful */
  onRestoreSuccess?: () => void;
}

/**
 * Full-screen paywall component.
 * Renders RevenueCatUI.Paywall with event handlers.
 */
export function Paywall({ onDismiss, onPurchaseSuccess, onRestoreSuccess }: PaywallProps) {
  return (
    <View style={{ flex: 1 }}>
      <RevenueCatUI.Paywall
        onDismiss={onDismiss}
        onPurchaseCompleted={() => {
          console.log('[Paywall] Purchase completed');
          onPurchaseSuccess?.();
        }}
        onRestoreCompleted={({ customerInfo }) => {
          console.log('[Paywall] Restore completed');
          if (customerInfo.entitlements.active[ENTITLEMENT_ID]) {
            onRestoreSuccess?.();
          }
        }}
        onPurchaseError={(error) => {
          console.error('[Paywall] Purchase error:', error);
        }}
        onRestoreError={(error) => {
          console.error('[Paywall] Restore error:', error);
        }}
      />
    </View>
  );
}

/**
 * Present paywall modally.
 * Returns true if user purchased or restored successfully.
 *
 * @example
 * ```tsx
 * const success = await presentPaywall();
 * if (success) {
 *   // User now has access
 * }
 * ```
 */
export async function presentPaywall(): Promise<boolean> {
  try {
    const result = await RevenueCatUI.presentPaywall();

    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        return true;
      case PAYWALL_RESULT.NOT_PRESENTED:
      case PAYWALL_RESULT.ERROR:
      case PAYWALL_RESULT.CANCELLED:
      default:
        return false;
    }
  } catch (error) {
    console.error('[Paywall] Present error:', error);
    return false;
  }
}

/**
 * Present paywall only if user doesn't have the entitlement.
 * Skips paywall if user already has access.
 *
 * @example
 * ```tsx
 * const result = await presentPaywallIfNeeded();
 * // User either already had access or just purchased
 * ```
 */
export async function presentPaywallIfNeeded(): Promise<boolean> {
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: ENTITLEMENT_ID,
    });

    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        return true;
      case PAYWALL_RESULT.NOT_PRESENTED:
        // User already has access
        return true;
      case PAYWALL_RESULT.ERROR:
      case PAYWALL_RESULT.CANCELLED:
      default:
        return false;
    }
  } catch (error) {
    console.error('[Paywall] Present error:', error);
    return false;
  }
}

/**
 * Loading placeholder for paywall.
 */
export function PaywallLoading() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" />
      <Text className="mt-4 text-muted-foreground">
        Chargement des offres...
      </Text>
    </View>
  );
}
