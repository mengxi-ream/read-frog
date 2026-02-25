/**
 * TypeScript type resets from @total-typescript/ts-reset
 * Improves TypeScript's built-in types for better ergonomics
 *
 * @see https://github.com/total-typescript/ts-reset
 */

// Fix array.includes() to accept wider types (e.g., union types)
// This eliminates the need for type casts when checking if a value exists in an array
import "@total-typescript/ts-reset/array-includes"
