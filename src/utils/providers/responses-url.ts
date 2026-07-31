export function resolveResponsesUrl(baseURL: string): string {
  const trimmedBaseURL = baseURL.trim()
  const suffixIndex = trimmedBaseURL.search(/[?#]/)
  const path = suffixIndex === -1 ? trimmedBaseURL : trimmedBaseURL.slice(0, suffixIndex)
  const suffix = suffixIndex === -1 ? "" : trimmedBaseURL.slice(suffixIndex)
  const normalizedPath = path.replace(/\/+$/, "")

  return `${normalizedPath}${normalizedPath.endsWith("/responses") ? "" : "/responses"}${suffix}`
}
