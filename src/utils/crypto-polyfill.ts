/**
 * Polyfill for crypto.randomUUID() in non-secure contexts (HTTP extensions)
 *
 * Background:
 * - crypto.randomUUID() is only available in secure contexts (HTTPS)
 * - crypto.getRandomValues() is available in ALL modern browsers (including HTTP)
 * - This polyfill uses getRandomValues() to implement randomUUID()
 */

// Ensure crypto.getRandomValues is available (required for this polyfill)
if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
  throw new TypeError(
    '[crypto-polyfill] crypto.getRandomValues is required but not available. '
    + 'This polyfill only works in browser environments.',
  )
}

// UUIDv4 implementation using crypto.getRandomValues (works in non-secure context)
export function generateUUIDv4(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6]! & 0x0F) | 0x40 // Version 4: set bits 12-15 to 0100
  bytes[8] = (bytes[8]! & 0x3F) | 0x80 // Variant 1: set bits 6-7 to 10

  const hex = Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')

  // Format: xxxxxxxx-xxxx-4xxx-Nxxx-xxxxxxxxxxxx (8-4-4-4-12)
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}

// Only polyfill if crypto.randomUUID is not available
if (typeof crypto.randomUUID !== 'function') {
  // @ts-expect-error - polyfill signature mismatch (our function returns string, native returns `${string}-...`)
  crypto.randomUUID = generateUUIDv4
}
