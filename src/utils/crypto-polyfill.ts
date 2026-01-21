// Simple implement of UUIDv4 by crypto.getRandomValues (which works in non-secure context)
export function generateUUIDv4(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6]! & 0x0F) | 0x40 // Version 4
  bytes[8] = (bytes[8]! & 0x3F) | 0x80 // Variant 1

  const hex = Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}

// Polyfill for crypto.randomUUID() in non-secure contexts (http extensions)
if (typeof crypto === 'undefined') {
  // @ts-expect-error - polyfill
  globalThis.crypto = {}
}

if (!crypto.randomUUID) {
  // @ts-expect-error - polyfill signature mismatch
  crypto.randomUUID = generateUUIDv4
}
