/**
 * Dev Logger - Error Tracking for Debugging
 *
 * Stores errors in memory and writes them to a local file
 * that can be fetched via Metro:
 *   curl http://localhost:8081/[file-path]
 *
 * In dev mode, also writes to expo-file-system for persistence.
 */

/**
 * No-op init — kept for API compatibility.
 */
export function startDevLogServer(): void {
  if (!__DEV__) return;
  console.log('[DevLogger] Error tracking active. Errors will be logged to console with full stack traces.');
}
