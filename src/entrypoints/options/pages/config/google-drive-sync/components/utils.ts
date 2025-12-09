/**
 * Check if a string is a meaningful field name (not an array index).
 * Used to decide whether to display the field key label in conflict UI.
 *
 * @example
 * isMeaningfulFieldKey("theme")  // true - object property name
 * isMeaningfulFieldKey("0")      // false - array index
 */
export function isMeaningfulFieldKey(key: string): boolean {
  return Number.isNaN(Number(key))
}

export function formatValue(val: unknown): string {
  if (val === null)
    return 'null'
  if (val === undefined)
    return 'undefined'
  if (typeof val === 'string')
    return `"${val}"`
  if (typeof val === 'boolean')
    return val ? 'true' : 'false'
  if (typeof val === 'object')
    return JSON.stringify(val, null, 2)
  return String(val)
}
