/**
 * RevenueCat Configuration
 *
 * Initializes RevenueCat SDK for in-app purchases.
 * Handles iOS App Store and Google Play subscriptions.
 *
 * IMPORTANT: RevenueCat requires a development build.
 * In Expo Go, this module provides mock functions to avoid crashes.
 *
 * @see https://www.revenuecat.com/docs/getting-started/installation/expo
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';

// ============================================================================
// EXPO GO DETECTION
// ============================================================================

/**
 * Detect if running in Expo Go (storeClient).
 * RevenueCat native modules aren't available in Expo Go.
 */
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// ============================================================================
// CONFIGURATION
// ============================================================================

// RevenueCat API key from environment variable
const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || '';

// Entitlement identifier configured in RevenueCat dashboard
export const ENTITLEMENT_ID = 'TomIA Pro';

// Product identifiers (family-based pricing)
export const PRODUCT_IDS = {
  FAMILY_1: 'tomia_family_1', // 14,99€/mois - 1 enfant
  FAMILY_2: 'tomia_family_2', // 19,99€/mois - 2 enfants
  FAMILY_3: 'tomia_family_3', // 24,99€/mois - 3 enfants
  FAMILY_5: 'tomia_family_5', // 29,99€/mois - 5 enfants max
  YEARLY: 'tomia_yearly', // 149,99€/an - tous enfants
} as const;

// Max children per product
export const PRODUCT_MAX_CHILDREN: Record<string, number> = {
  [PRODUCT_IDS.FAMILY_1]: 1,
  [PRODUCT_IDS.FAMILY_2]: 2,
  [PRODUCT_IDS.FAMILY_3]: 3,
  [PRODUCT_IDS.FAMILY_5]: 5,
  [PRODUCT_IDS.YEARLY]: 10,
};

// ============================================================================
// TYPES (for mock implementations)
// ============================================================================

interface MockCustomerInfo {
  originalAppUserId: string;
  entitlements: {
    active: Record<string, { expirationDate?: string }>;
  };
}

interface MockPackage {
  identifier: string;
  packageType: string;
  product: {
    priceString: string;
  };
}

// ============================================================================
// INITIALIZATION
// ============================================================================

let isInitialized = false;
let Purchases: typeof import('react-native-purchases').default | null = null;

/**
 * Initialize RevenueCat SDK.
 * In Expo Go, this is a no-op since native modules aren't available.
 */
export async function initializeRevenueCat(appUserID?: string): Promise<void> {
  if (isInitialized) {
    return;
  }

  // Skip initialization in Expo Go
  if (isExpoGo) {
    if (__DEV__) {
      console.log('[RevenueCat] Running in Expo Go - using mock mode');
    }
    isInitialized = true;
    return;
  }

  // Dynamic import to avoid crash in Expo Go
  try {
    const PurchasesModule = await import('react-native-purchases');
    Purchases = PurchasesModule.default;

    if (__DEV__) {
      Purchases.setLogLevel(PurchasesModule.LOG_LEVEL.DEBUG);
    }

    await Purchases.configure({
      apiKey: REVENUECAT_API_KEY,
      appUserID: appUserID ?? undefined,
    });

    isInitialized = true;

    if (__DEV__) {
      const customerInfo = await Purchases.getCustomerInfo();
      console.log('[RevenueCat] Initialized. Customer ID:', customerInfo.originalAppUserId);
    }
  } catch (error) {
    if (__DEV__) {
      console.error('[RevenueCat] Initialization failed:', error);
    }
    // Mark as initialized to not block the app
    isInitialized = true;
  }
}

// ============================================================================
// USER IDENTIFICATION
// ============================================================================

export async function loginUser(appUserID: string): Promise<MockCustomerInfo> {
  if (isExpoGo || !Purchases) {
    return createMockCustomerInfo(appUserID);
  }

  const { customerInfo } = await Purchases.logIn(appUserID);
  return customerInfo as unknown as MockCustomerInfo;
}

export async function logoutUser(): Promise<MockCustomerInfo> {
  if (isExpoGo || !Purchases) {
    return createMockCustomerInfo('anonymous');
  }

  const customerInfo = await Purchases.logOut();
  return customerInfo as unknown as MockCustomerInfo;
}

// ============================================================================
// CUSTOMER INFO
// ============================================================================

export async function getCustomerInfo(): Promise<MockCustomerInfo> {
  if (isExpoGo || !Purchases) {
    return createMockCustomerInfo('expo-go-user');
  }

  const customerInfo = await Purchases.getCustomerInfo();
  return customerInfo as unknown as MockCustomerInfo;
}

export async function hasProEntitlement(): Promise<boolean> {
  if (isExpoGo || !Purchases) {
    // Return false in Expo Go - no active subscription
    return false;
  }

  const customerInfo = await Purchases.getCustomerInfo();
  return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
}

export async function getSubscriptionExpirationDate(): Promise<Date | null> {
  if (isExpoGo || !Purchases) {
    return null;
  }

  const customerInfo = await Purchases.getCustomerInfo();
  const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];

  if (!entitlement?.expirationDate) {
    return null;
  }

  return new Date(entitlement.expirationDate);
}

// ============================================================================
// OFFERINGS & PRODUCTS
// ============================================================================

export async function getCurrentOffering(): Promise<null> {
  if (isExpoGo || !Purchases) {
    return null;
  }

  const offerings = await Purchases.getOfferings();
  return offerings.current as unknown as null;
}

export async function getAvailablePackages(): Promise<MockPackage[]> {
  if (isExpoGo || !Purchases) {
    return [];
  }

  const offerings = await Purchases.getOfferings();
  return (offerings.current?.availablePackages ?? []) as unknown as MockPackage[];
}

export async function getPackage(
  identifier: (typeof PRODUCT_IDS)[keyof typeof PRODUCT_IDS]
): Promise<MockPackage | undefined> {
  const packages = await getAvailablePackages();
  return packages.find((pkg) => pkg.identifier === identifier);
}

// ============================================================================
// PURCHASES
// ============================================================================

export async function purchasePackage(
  pkg: MockPackage
): Promise<MockCustomerInfo | null> {
  if (isExpoGo || !Purchases) {
    if (__DEV__) {
      console.log('[RevenueCat] Purchase not available in Expo Go');
    }
    return null;
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage(
      pkg as unknown as import('react-native-purchases').PurchasesPackage
    );
    return customerInfo as unknown as MockCustomerInfo;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'userCancelled' in error) {
      if ((error as { userCancelled: boolean }).userCancelled) {
        return null;
      }
    }
    throw error;
  }
}

export async function restorePurchases(): Promise<MockCustomerInfo> {
  if (isExpoGo || !Purchases) {
    return createMockCustomerInfo('expo-go-user');
  }

  const customerInfo = await Purchases.restorePurchases();
  return customerInfo as unknown as MockCustomerInfo;
}

// ============================================================================
// LISTENERS
// ============================================================================

export function addCustomerInfoUpdateListener(
  callback: (customerInfo: MockCustomerInfo) => void
): () => void {
  if (isExpoGo || !Purchases) {
    // No-op in Expo Go
    return () => {};
  }

  Purchases.addCustomerInfoUpdateListener(
    callback as unknown as (info: import('react-native-purchases').CustomerInfo) => void
  );
  return () => {
    Purchases?.removeCustomerInfoUpdateListener(
      callback as unknown as (info: import('react-native-purchases').CustomerInfo) => void
    );
  };
}

// ============================================================================
// SUBSCRIBER ATTRIBUTES
// ============================================================================

export async function setChildrenAttributes(childrenIds: string[]): Promise<void> {
  if (isExpoGo || !Purchases) {
    return;
  }

  await Purchases.setAttributes({
    children_count: childrenIds.length.toString(),
    children_ids: JSON.stringify(childrenIds),
  });
}

// ============================================================================
// HELPERS
// ============================================================================

function createMockCustomerInfo(userId: string): MockCustomerInfo {
  return {
    originalAppUserId: userId,
    entitlements: { active: {} },
  };
}

export function formatPrice(pkg: MockPackage): string {
  return pkg.product.priceString;
}

export function getSubscriptionPeriod(pkg: MockPackage): string {
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

/**
 * Check if RevenueCat is available (not in Expo Go).
 */
export function isRevenueCatAvailable(): boolean {
  return !isExpoGo && Purchases !== null;
}

/**
 * Check if running in Expo Go.
 */
export function isRunningInExpoGo(): boolean {
  return isExpoGo;
}
