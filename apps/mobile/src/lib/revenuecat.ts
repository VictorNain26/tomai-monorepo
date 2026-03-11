/**
 * RevenueCat Configuration
 *
 * Initializes RevenueCat SDK for in-app purchases.
 * Handles iOS App Store and Google Play subscriptions.
 *
 * IMPORTANT: Requires a development build (not Expo Go).
 *
 * @see https://www.revenuecat.com/docs/getting-started/installation/expo
 */

import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
  type PurchasesOffering,
} from 'react-native-purchases';

// ============================================================================
// CONFIGURATION
// ============================================================================

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? (() => {
  throw new Error('[RevenueCat] EXPO_PUBLIC_REVENUECAT_API_KEY is missing. Add it to your .env file.');
})();

export const ENTITLEMENT_ID = 'TomIA Pro';

export const PRODUCT_IDS = {
  FAMILY_1: 'tomia_family_1', // 14,99€/mois - 1 enfant
  FAMILY_2: 'tomia_family_2', // 19,99€/mois - 2 enfants
  FAMILY_3: 'tomia_family_3', // 24,99€/mois - 3 enfants
  FAMILY_5: 'tomia_family_5', // 29,99€/mois - 5 enfants max
  YEARLY: 'tomia_yearly', // 149,99€/an - tous enfants
} as const;

export const PRODUCT_MAX_CHILDREN: Record<string, number> = {
  [PRODUCT_IDS.FAMILY_1]: 1,
  [PRODUCT_IDS.FAMILY_2]: 2,
  [PRODUCT_IDS.FAMILY_3]: 3,
  [PRODUCT_IDS.FAMILY_5]: 5,
  [PRODUCT_IDS.YEARLY]: 10,
};

// ============================================================================
// INITIALIZATION
// ============================================================================

let isInitialized = false;

export async function initializeRevenueCat(): Promise<void> {
  if (isInitialized) return;

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
  isInitialized = true;

  if (__DEV__) {
    const customerInfo = await Purchases.getCustomerInfo();
    console.log('[RevenueCat] Initialized. Customer ID:', customerInfo.originalAppUserId);
  }
}

// ============================================================================
// USER IDENTIFICATION
// ============================================================================

export async function loginUser(appUserID: string): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.logIn(appUserID);
  return customerInfo;
}

export async function logoutUser(): Promise<CustomerInfo | null> {
  if (await Purchases.isAnonymous()) return null;
  return Purchases.logOut();
}

// ============================================================================
// CUSTOMER INFO
// ============================================================================

export async function getCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}

export async function hasProEntitlement(): Promise<boolean> {
  const customerInfo = await Purchases.getCustomerInfo();
  return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
}

export async function getSubscriptionExpirationDate(): Promise<Date | null> {
  const customerInfo = await Purchases.getCustomerInfo();
  const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
  if (!entitlement?.expirationDate) return null;
  return new Date(entitlement.expirationDate);
}

// ============================================================================
// OFFERINGS & PRODUCTS
// ============================================================================

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

export async function getAvailablePackages(): Promise<PurchasesPackage[]> {
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export async function getPackage(
  identifier: (typeof PRODUCT_IDS)[keyof typeof PRODUCT_IDS],
): Promise<PurchasesPackage | undefined> {
  const packages = await getAvailablePackages();
  return packages.find((pkg) => pkg.identifier === identifier);
}

// ============================================================================
// PURCHASES
// ============================================================================

export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<CustomerInfo | null> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'userCancelled' in error) {
      if ((error as { userCancelled: boolean }).userCancelled) {
        return null;
      }
    }
    throw error;
  }
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

// ============================================================================
// LISTENERS
// ============================================================================

export function addCustomerInfoUpdateListener(
  callback: (customerInfo: CustomerInfo) => void,
): () => void {
  Purchases.addCustomerInfoUpdateListener(callback);
  return () => Purchases.removeCustomerInfoUpdateListener(callback);
}

// ============================================================================
// SUBSCRIBER ATTRIBUTES
// ============================================================================

export async function setChildrenAttributes(childrenIds: string[]): Promise<void> {
  await Purchases.setAttributes({
    children_count: childrenIds.length.toString(),
    children_ids: JSON.stringify(childrenIds),
  });
}

// ============================================================================
// HELPERS
// ============================================================================

export function formatPrice(pkg: { product: { priceString: string } }): string {
  return pkg.product.priceString;
}

export function getSubscriptionPeriod(pkg: { packageType: string }): string {
  switch (pkg.packageType) {
    case 'MONTHLY':
      return 'par mois';
    case 'ANNUAL':
      return 'par an';
    default:
      return '';
  }
}

export function getRecommendedProductId(childrenCount: number): string {
  if (childrenCount <= 1) return PRODUCT_IDS.FAMILY_1;
  if (childrenCount === 2) return PRODUCT_IDS.FAMILY_2;
  if (childrenCount === 3) return PRODUCT_IDS.FAMILY_3;
  return PRODUCT_IDS.FAMILY_5;
}

// Re-export types for consumers
export type { CustomerInfo, PurchasesPackage, PurchasesOffering };
