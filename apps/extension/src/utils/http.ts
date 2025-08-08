export function normalizeHeaders(headersInit?: HeadersInit): [string, string][] {
  if (!headersInit)
    return []
  if (headersInit instanceof Headers)
    return Array.from(headersInit.entries())
  if (Array.isArray(headersInit))
    return headersInit.map(([k, v]) => [k, String(v)])
  // plain object shape
  const entries: [string, string][] = []
  for (const key of Object.keys(headersInit)) {
    const value = (headersInit as Record<string, unknown>)[key]
    entries.push([key, String(value)])
  }
  return entries
}
