/**
 * useSubscription / useIsPro Hook Tests
 *
 * Covers the payment-critical paths: purchase success/cancel/throw,
 * restore success/empty/throw, and isPro derivation from CustomerInfo.
 *
 * ISOLATION: The hook keeps module-level caches (cachedCustomerInfo,
 * bootstrapStatus). bootstrapStatus stays 'done' after the first test runs.
 * purchase/restore actions work on their own return values, so cache state
 * does not affect results for those tests. useIsPro tests force a cache
 * refresh via useSubscription.refresh() which calls getCustomerInfo() and
 * pushes the new value into the shared external store.
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('@/lib/revenuecat', () => ({
  ENTITLEMENT_ID: 'TomIA Pro',
  getCustomerInfo: jest.fn(),
  getCurrentOffering: jest.fn(),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
  addCustomerInfoUpdateListener: jest.fn(() => jest.fn()),
}));

jest.mock('@/components/ui/confirm-dialog', () => ({
  __esModule: true,
  default: jest.fn(),
  useConfirm: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Typed references to the mocked functions
// ---------------------------------------------------------------------------

import * as rc from '@/lib/revenuecat';
import { useConfirm } from '@/components/ui/confirm-dialog';

const mockGetCustomerInfo = jest.mocked(rc.getCustomerInfo);
const mockGetCurrentOffering = jest.mocked(rc.getCurrentOffering);
const mockPurchasePackage = jest.mocked(rc.purchasePackage);
const mockRestorePurchases = jest.mocked(rc.restorePurchases);
const mockAddCustomerInfoUpdateListener = jest.mocked(rc.addCustomerInfoUpdateListener);
const mockUseConfirm = jest.mocked(useConfirm);

const mockShowInfo = jest.fn();

// ---------------------------------------------------------------------------
// SUT import — must come after jest.mock() calls
// ---------------------------------------------------------------------------

import { useSubscription, useIsPro } from '../../src/hooks/useSubscription';

// ---------------------------------------------------------------------------
// Silence __DEV__ console.error from hook catch blocks
// ---------------------------------------------------------------------------

const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

afterAll(() => {
  consoleSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProCustomerInfo(): CustomerInfo {
  return {
    originalAppUserId: 'user-1',
    entitlements: {
      active: {
        'TomIA Pro': {
          identifier: 'TomIA Pro',
          isActive: true,
          willRenew: true,
          periodType: 'NORMAL',
          latestPurchaseDate: '2026-01-01T00:00:00Z',
          latestPurchaseDateMillis: 1735689600000,
          originalPurchaseDate: '2026-01-01T00:00:00Z',
          originalPurchaseDateMillis: 1735689600000,
          expirationDate: '2027-01-01T00:00:00Z',
          expirationDateMillis: 1767225600000,
          store: 'PLAY_STORE',
          productIdentifier: 'tomia_family_1',
          productPlanIdentifier: null,
          isSandbox: false,
          unsubscribeDetectedAt: null,
          unsubscribeDetectedAtMillis: null,
          billingIssueDetectedAt: null,
          billingIssueDetectedAtMillis: null,
          ownershipType: 'PURCHASED',
          verification: 'NOT_REQUESTED',
        },
      },
      all: {},
      verification: 'NOT_REQUESTED',
    },
    activeSubscriptions: ['tomia_family_1'],
    allPurchasedProductIdentifiers: ['tomia_family_1'],
    nonSubscriptionTransactions: [],
    allExpirationDates: {},
    allPurchaseDates: {},
    firstSeen: '2026-01-01T00:00:00Z',
    firstSeenMillis: 1735689600000,
    latestExpirationDate: '2027-01-01T00:00:00Z',
    latestExpirationDateMillis: 1767225600000,
    requestDate: '2026-06-13T00:00:00Z',
    requestDateMillis: 1749772800000,
    originalApplicationVersion: null,
    originalPurchaseDate: null,
    originalPurchaseDateMillis: null,
    managementURL: null,
  } as unknown as CustomerInfo;
}

function makeBasicCustomerInfo(): CustomerInfo {
  return {
    originalAppUserId: 'user-1',
    entitlements: { active: {}, all: {}, verification: 'NOT_REQUESTED' },
    activeSubscriptions: [],
    allPurchasedProductIdentifiers: [],
    nonSubscriptionTransactions: [],
    allExpirationDates: {},
    allPurchaseDates: {},
    firstSeen: '2026-01-01T00:00:00Z',
    firstSeenMillis: 1735689600000,
    latestExpirationDate: null,
    latestExpirationDateMillis: null,
    requestDate: '2026-06-13T00:00:00Z',
    requestDateMillis: 1749772800000,
    originalApplicationVersion: null,
    originalPurchaseDate: null,
    originalPurchaseDateMillis: null,
    managementURL: null,
  } as unknown as CustomerInfo;
}

const fakePkg = { identifier: 'tomia_family_1' } as unknown as PurchasesPackage;

// ---------------------------------------------------------------------------
// Shared beforeEach
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCustomerInfo.mockResolvedValue(makeBasicCustomerInfo());
  mockGetCurrentOffering.mockResolvedValue(null);
  mockAddCustomerInfoUpdateListener.mockReturnValue(jest.fn());
  mockUseConfirm.mockReturnValue({ confirm: jest.fn(), info: mockShowInfo });
});

// ---------------------------------------------------------------------------
// purchase() — invariant 1: success
// ---------------------------------------------------------------------------

describe('purchase() — success path', () => {
  it('returns true when purchasePackage resolves a Pro CustomerInfo', async () => {
    mockPurchasePackage.mockResolvedValueOnce(makeProCustomerInfo());

    const { result } = renderHook(() => useSubscription());

    await act(async () => {
      await Promise.resolve();
    });

    let purchaseResult: boolean | undefined;
    await act(async () => {
      purchaseResult = await result.current.purchase(fakePkg);
    });

    expect(purchaseResult).toBe(true);
    expect(mockPurchasePackage).toHaveBeenCalledWith(fakePkg);
  });
});

// ---------------------------------------------------------------------------
// purchase() — invariant 2: cancellation (null → false, no error dialog)
// ---------------------------------------------------------------------------

describe('purchase() — cancellation path', () => {
  it('returns false and does NOT call showInfo("Erreur") when purchasePackage resolves null', async () => {
    mockPurchasePackage.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useSubscription());

    await act(async () => {
      await Promise.resolve();
    });

    let purchaseResult: boolean | undefined;
    await act(async () => {
      purchaseResult = await result.current.purchase(fakePkg);
    });

    expect(purchaseResult).toBe(false);
    const errorCalls = mockShowInfo.mock.calls.filter((call) => call[0] === 'Erreur');
    expect(errorCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// purchase() — invariant 3: throw → false + error dialog
// ---------------------------------------------------------------------------

describe('purchase() — throw path', () => {
  it('returns false and calls showInfo("Erreur", …) when purchasePackage throws', async () => {
    mockPurchasePackage.mockRejectedValueOnce(new Error('network failure'));

    const { result } = renderHook(() => useSubscription());

    await act(async () => {
      await Promise.resolve();
    });

    let purchaseResult: boolean | undefined;
    await act(async () => {
      purchaseResult = await result.current.purchase(fakePkg);
    });

    expect(purchaseResult).toBe(false);
    expect(mockShowInfo).toHaveBeenCalledWith('Erreur', expect.any(String));
  });
});

// ---------------------------------------------------------------------------
// restore() — invariant 4: with Pro entitlement → true + success dialog
// ---------------------------------------------------------------------------

describe('restore() — success path', () => {
  it('returns true and calls showInfo("Succès", …)', async () => {
    mockRestorePurchases.mockResolvedValueOnce(makeProCustomerInfo());

    const { result } = renderHook(() => useSubscription());

    await act(async () => {
      await Promise.resolve();
    });

    let restoreResult: boolean | undefined;
    await act(async () => {
      restoreResult = await result.current.restore();
    });

    expect(restoreResult).toBe(true);
    expect(mockShowInfo).toHaveBeenCalledWith('Succès', expect.any(String));
  });
});

// ---------------------------------------------------------------------------
// restore() — invariant 5: no entitlement → false + info dialog
// ---------------------------------------------------------------------------

describe('restore() — no purchases path', () => {
  it('returns false and calls showInfo("Info", "Aucun achat…")', async () => {
    mockRestorePurchases.mockResolvedValueOnce(makeBasicCustomerInfo());

    const { result } = renderHook(() => useSubscription());

    await act(async () => {
      await Promise.resolve();
    });

    let restoreResult: boolean | undefined;
    await act(async () => {
      restoreResult = await result.current.restore();
    });

    expect(restoreResult).toBe(false);
    expect(mockShowInfo).toHaveBeenCalledWith('Info', expect.stringContaining('Aucun achat'));
  });
});

// ---------------------------------------------------------------------------
// restore() — invariant 6: throw → false + error dialog
// ---------------------------------------------------------------------------

describe('restore() — throw path', () => {
  it('returns false and calls showInfo("Erreur", …) when restorePurchases throws', async () => {
    mockRestorePurchases.mockRejectedValueOnce(new Error('store error'));

    const { result } = renderHook(() => useSubscription());

    await act(async () => {
      await Promise.resolve();
    });

    let restoreResult: boolean | undefined;
    await act(async () => {
      restoreResult = await result.current.restore();
    });

    expect(restoreResult).toBe(false);
    expect(mockShowInfo).toHaveBeenCalledWith('Erreur', expect.any(String));
  });
});

// ---------------------------------------------------------------------------
// useIsPro() — invariant 7: isPro derived from active entitlement
//
// bootstrapStatus is 'done' after earlier tests ran, so ensureBootstrap()
// is a no-op. We force a cache update via useSubscription.refresh() which
// calls getCustomerInfo() and pushes the result into the shared store,
// causing useIsPro consumers to re-render with the new value.
// ---------------------------------------------------------------------------

describe('useIsPro()', () => {
  it('returns isPro=true when getCustomerInfo resolves a Pro CustomerInfo', async () => {
    mockGetCustomerInfo.mockResolvedValue(makeProCustomerInfo());

    const { result: subResult } = renderHook(() => useSubscription());
    const { result: isProResult } = renderHook(() => useIsPro());

    await act(async () => {
      await subResult.current.refresh();
    });

    await waitFor(() => {
      expect(isProResult.current.isPro).toBe(true);
    });
  });

  it('returns isPro=false when getCustomerInfo resolves a basic CustomerInfo', async () => {
    mockGetCustomerInfo.mockResolvedValue(makeBasicCustomerInfo());

    const { result: subResult } = renderHook(() => useSubscription());
    const { result: isProResult } = renderHook(() => useIsPro());

    await act(async () => {
      await subResult.current.refresh();
    });

    await waitFor(() => {
      expect(isProResult.current.isLoading).toBe(false);
    });

    expect(isProResult.current.isPro).toBe(false);
  });
});
