import { sha256 } from 'js-sha256'

/**
 * Generate a SHA256 hash of multiple text parameters
 * @param texts Variable number of text parameters
 * @returns SHA256 hexadecimal string
 *
 * @example
 * Sha256Hex('hello') // single parameter
 * Sha256Hex('hello', 'world') // multiple parameters joined with separator
 */
export function Sha256Hex(...texts: string[]): string {
  if (texts.length === 0) {
    throw new Error('At least one text parameter is required')
  }

  // prevent parameter boundary ambiguity, e.g. 'a|bc' and 'ab|c' are different
  const combined = texts.join('|')
  return sha256(combined)
}
