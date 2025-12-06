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
