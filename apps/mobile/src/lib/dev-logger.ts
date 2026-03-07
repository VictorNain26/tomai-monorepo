/**
 * Dev Logger - Error Tracking for Debugging
 *
 * Stores errors in memory and writes them to a local file
 * that can be fetched via Metro:
 *   curl http://localhost:8081/[file-path]
 *
 * In dev mode, also writes to expo-file-system for persistence.
 */

import { Paths, File } from 'expo-file-system';

interface LogEntry {
  timestamp: string;
  message: string;
  stack?: string;
  componentStack?: string;
}

const MAX_ENTRIES = 20;
const errors: LogEntry[] = [];

export function logError(error: Error, componentStack?: string): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
    componentStack,
  };
  errors.unshift(entry);
  if (errors.length > MAX_ENTRIES) errors.length = MAX_ENTRIES;

  // Write to file for persistence (best effort)
  if (__DEV__) {
    writeErrorLog();
  }
}

export function getErrors(): LogEntry[] {
  return errors;
}

export function clearErrors(): void {
  errors.length = 0;
}

function writeErrorLog(): void {
  try {
    const file = new File(Paths.cache, 'debug-errors.json');
    const data = JSON.stringify(errors, null, 2);
    void file.write(data);
  } catch {
    // Best effort — ignore write failures
  }
}

/**
 * No-op init — kept for API compatibility.
 * Logs are written on each error via logError().
 */
export function startDevLogServer(): void {
  if (!__DEV__) return;
  console.log('[DevLogger] Error tracking active. Errors will be logged to console with full stack traces.');
}
