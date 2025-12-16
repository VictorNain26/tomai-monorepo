/**
 * UUID Utilities - Helper functions for UUID validation and generation
 * Ensures data consistency with PostgreSQL UUID fields
 */

/**
 * Validate if string is a valid UUID v4 format
 */
function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Safe UUID conversion - returns null if invalid instead of throwing
 */
export function safeUUID(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  return isValidUUID(value) ? value : null;
}
