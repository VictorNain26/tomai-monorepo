/**
 * RevenueCat Helpers Tests
 *
 * Tests for product recommendation, price formatting, and subscription period.
 * Only tests pure helper functions — no SDK interaction.
 */

import {
  formatPrice,
  getRecommendedProductId,
  getSubscriptionPeriod,
  PRODUCT_IDS,
} from '@/lib/revenuecat';

// ============================================================================
// getRecommendedProductId
// ============================================================================

describe('getRecommendedProductId', () => {
  it('should return FAMILY_1 for 0 children', () => {
    expect(getRecommendedProductId(0)).toBe(PRODUCT_IDS.FAMILY_1);
  });

  it('should return FAMILY_1 for 1 child', () => {
    expect(getRecommendedProductId(1)).toBe(PRODUCT_IDS.FAMILY_1);
  });

  it('should return FAMILY_2 for 2 children', () => {
    expect(getRecommendedProductId(2)).toBe(PRODUCT_IDS.FAMILY_2);
  });

  it('should return FAMILY_3 for 3 children', () => {
    expect(getRecommendedProductId(3)).toBe(PRODUCT_IDS.FAMILY_3);
  });

  it('should return FAMILY_5 for 4+ children', () => {
    expect(getRecommendedProductId(4)).toBe(PRODUCT_IDS.FAMILY_5);
    expect(getRecommendedProductId(10)).toBe(PRODUCT_IDS.FAMILY_5);
  });
});

// ============================================================================
// formatPrice
// ============================================================================

describe('formatPrice', () => {
  it('should return the product priceString', () => {
    const pkg = { identifier: 'test', packageType: 'MONTHLY', product: { priceString: '14,99 €' } };
    expect(formatPrice(pkg)).toBe('14,99 €');
  });

  it('should return priceString for a different price', () => {
    const pkg = { identifier: 'test', packageType: 'ANNUAL', product: { priceString: '149,99 €' } };
    expect(formatPrice(pkg)).toBe('149,99 €');
  });
});

// ============================================================================
// getSubscriptionPeriod
// ============================================================================

describe('getSubscriptionPeriod', () => {
  it('should return "par mois" for MONTHLY', () => {
    const pkg = { identifier: 'test', packageType: 'MONTHLY', product: { priceString: '14,99 €' } };
    expect(getSubscriptionPeriod(pkg)).toBe('par mois');
  });

  it('should return "par an" for ANNUAL', () => {
    const pkg = { identifier: 'test', packageType: 'ANNUAL', product: { priceString: '149,99 €' } };
    expect(getSubscriptionPeriod(pkg)).toBe('par an');
  });

  it('should return empty string for unknown type', () => {
    const pkg = { identifier: 'test', packageType: 'WEEKLY', product: { priceString: '3,99 €' } };
    expect(getSubscriptionPeriod(pkg)).toBe('');
  });
});
