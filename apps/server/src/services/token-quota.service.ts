/**
 * Token Quota Service - Re-export facade
 * Implementation split into quota/quota-config.ts and quota/quota-functions.ts
 */

export {
  checkQuota,
  
  
  
  
  checkDeckQuota,
  incrementDeckUsage,
} from './quota/quota-functions.js';

;

;

import {
  checkQuota,
  incrementTokenUsage,
  getUsageStats,
  getHoursUntilReset,
  checkDeckQuota,
  incrementDeckUsage,
} from './quota/quota-functions.js';

import { QUOTA_CONFIG, SOFT_LIMITS } from './quota/quota-config.js';

export const tokenQuotaService = {
  checkQuota,
  incrementTokenUsage,
  getUsageStats,
  getHoursUntilReset,
  checkDeckQuota,
  incrementDeckUsage,
  QUOTA_CONFIG,
  SOFT_LIMITS,
};
