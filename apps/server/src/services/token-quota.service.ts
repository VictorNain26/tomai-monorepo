/**
 * Token Quota Service - Re-export facade
 * Implementation split into quota/quota-config.ts and quota/quota-functions.ts
 */

export {
  checkQuota,
  incrementTokenUsage,
  getUsageStats,
  resetAllDailyTokens,
  getHoursUntilReset,
  checkDeckQuota,
  incrementDeckUsage,
} from './quota/quota-functions.js';

export { QUOTA_CONFIG, SOFT_LIMITS } from './quota/quota-config.js';

export type {
  QuotaCheckResult,
  TokenUsageResult,
  UsageStats,
  DeckQuotaResult,
  DeckUsageResult,
  QuotaMode,
} from './quota/quota-config.js';

import {
  checkQuota,
  incrementTokenUsage,
  getUsageStats,
  resetAllDailyTokens,
  getHoursUntilReset,
  checkDeckQuota,
  incrementDeckUsage,
} from './quota/quota-functions.js';

import { QUOTA_CONFIG, SOFT_LIMITS } from './quota/quota-config.js';

export const tokenQuotaService = {
  checkQuota,
  incrementTokenUsage,
  getUsageStats,
  resetAllDailyTokens,
  getHoursUntilReset,
  checkDeckQuota,
  incrementDeckUsage,
  QUOTA_CONFIG,
  SOFT_LIMITS,
};
