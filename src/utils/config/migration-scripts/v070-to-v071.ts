/**
 * Migration script from v070 to v071
 * - Makes DeepLX URLs explicit because runtime no longer appends /translate or
 *   inserts API keys into URL paths.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */

const API_KEY_PLACEHOLDER = "{{apiKey}}"
const DEFAULT_DEEPLX_BASE_URL = "https://api.deeplx.org/{{apiKey}}/translate"

interface ParsedURL {
  origin: string
  pathname: string
  search: string
  hash: string
}

interface QueryParam {
  name: string
  value: string
  hasEquals: boolean
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function parseAbsoluteURL(value: string): ParsedURL | null {
  const schemeSeparatorIndex = value.indexOf("://")
  if (schemeSeparatorIndex <= 0) {
    return null
  }

  const scheme = value.slice(0, schemeSeparatorIndex)
  if (!/^[a-z][a-z0-9+.-]*$/i.test(scheme)) {
    return null
  }

  const authorityStartIndex = schemeSeparatorIndex + 3
  const pathStartIndex = findFirstIndex(value, ["/", "?", "#"], authorityStartIndex)
  const authorityEndIndex = pathStartIndex === -1 ? value.length : pathStartIndex
  if (authorityEndIndex === authorityStartIndex) {
    return null
  }

  const origin = value.slice(0, authorityEndIndex)
  const rest = pathStartIndex === -1 ? "" : value.slice(pathStartIndex)
  const hashIndex = rest.indexOf("#")
  const beforeHash = hashIndex === -1 ? rest : rest.slice(0, hashIndex)
  const hash = hashIndex === -1 ? "" : rest.slice(hashIndex)
  const searchIndex = beforeHash.indexOf("?")

  const pathname = searchIndex === -1
    ? beforeHash
    : beforeHash.slice(0, searchIndex)
  const search = searchIndex === -1 ? "" : beforeHash.slice(searchIndex)

  return {
    origin,
    pathname,
    search,
    hash,
  }
}

function findFirstIndex(value: string, needles: string[], fromIndex: number): number {
  let firstIndex = -1

  for (const needle of needles) {
    const index = value.indexOf(needle, fromIndex)
    if (index !== -1 && (firstIndex === -1 || index < firstIndex)) {
      firstIndex = index
    }
  }

  return firstIndex
}

function isValidLiteralHTTPURL(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.length > 0
  }
  catch {
    return false
  }
}

function getLiteralHostname(value: string): string | null {
  try {
    return new URL(value).hostname
  }
  catch {
    return null
  }
}

function buildURL(parsed: ParsedURL, pathname: string, search = parsed.search): string {
  return `${parsed.origin}${pathname}${search}${parsed.hash}`
}

function trimPathTrailingSlashes(pathname: string): string {
  return pathname.replace(/\/+$/, "")
}

function hasTranslatePath(pathname: string): boolean {
  return trimPathTrailingSlashes(pathname).endsWith("/translate")
}

function appendTranslatePath(pathname: string): string {
  const cleanPathname = trimPathTrailingSlashes(pathname)
  return `${cleanPathname || ""}/translate`
}

function appendAPIKeyPlaceholderAndTranslate(pathname: string): string {
  const cleanPathname = trimPathTrailingSlashes(pathname)
  return `${cleanPathname || ""}/${API_KEY_PLACEHOLDER}/translate`
}

function parseQuery(search: string): QueryParam[] {
  if (!search.startsWith("?") || search.length === 1) {
    return []
  }

  return search.slice(1).split("&").map((part) => {
    const equalsIndex = part.indexOf("=")
    if (equalsIndex === -1) {
      return {
        name: part,
        value: "",
        hasEquals: false,
      }
    }

    return {
      name: part.slice(0, equalsIndex),
      value: part.slice(equalsIndex + 1),
      hasEquals: true,
    }
  })
}

function decodeQueryValue(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "))
  }
  catch {
    return value
  }
}

function isTokenParam(param: QueryParam): boolean {
  return param.name === "token"
}

function getSingleTokenQueryValue(search: string): { status: "none" | "duplicate" | "empty" | "value", value?: string } {
  const tokenParams = parseQuery(search).filter(isTokenParam)

  if (tokenParams.length === 0) {
    return { status: "none" }
  }

  if (tokenParams.length > 1) {
    return { status: "duplicate" }
  }

  const rawToken = tokenParams[0].value
  if (!rawToken) {
    return { status: "empty" }
  }

  const decodedToken = decodeQueryValue(rawToken)
  const normalizedToken = rawToken.endsWith("/") && decodedToken.endsWith("/")
    ? decodedToken.slice(0, -1)
    : decodedToken

  return normalizedToken.length > 0
    ? { status: "value", value: normalizedToken }
    : { status: "empty" }
}

function replaceSingleTokenQueryValue(search: string): string {
  const params = parseQuery(search)
  const updatedParams = params.map((param) => {
    if (!isTokenParam(param)) {
      return param.hasEquals ? `${param.name}=${param.value}` : param.name
    }

    return `${param.name}=${API_KEY_PLACEHOLDER}`
  })

  return `?${updatedParams.join("&")}`
}

function decodePathSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment)
  }
  catch {
    return null
  }
}

function migratePathTokenProvider(provider: any, parsed: ParsedURL, apiKey: string | undefined, hostname: string | null): any | null {
  const cleanPathname = trimPathTrailingSlashes(parsed.pathname)
  if (!cleanPathname.endsWith("/translate")) {
    return null
  }

  const pathBeforeTranslate = cleanPathname.slice(0, -"/translate".length)
  const segments = pathBeforeTranslate.split("/").filter(Boolean)
  if (segments.length === 0) {
    return null
  }

  const tokenSegment = segments[segments.length - 1]
  const decodedToken = decodePathSegment(tokenSegment)
  if (!decodedToken || decodedToken.includes("/") || decodedToken === API_KEY_PLACEHOLDER) {
    return null
  }

  const isKnownDeepLXOrgToken = hostname === "api.deeplx.org" && segments.length === 1
  const isConfirmedByExistingAPIKey = apiKey === decodedToken

  if (!isKnownDeepLXOrgToken && !isConfirmedByExistingAPIKey) {
    return null
  }

  if (apiKey && apiKey !== decodedToken) {
    return provider
  }

  const tokenPathPrefix = pathBeforeTranslate.slice(0, pathBeforeTranslate.length - tokenSegment.length)
  const placeholderPathname = `${tokenPathPrefix}${API_KEY_PLACEHOLDER}/translate`

  return {
    ...provider,
    apiKey: decodedToken,
    baseURL: buildURL(parsed, placeholderPathname),
  }
}

function migratePlaceholderURL(provider: any, parsed: ParsedURL): any {
  if (hasTranslatePath(parsed.pathname)) {
    return provider
  }

  return {
    ...provider,
    baseURL: buildURL(parsed, appendTranslatePath(parsed.pathname)),
  }
}

function migrateQueryTokenURL(provider: any, parsed: ParsedURL, apiKey: string | undefined, token: string): any {
  if (apiKey && apiKey !== token) {
    return provider
  }

  return {
    ...provider,
    apiKey: token,
    baseURL: buildURL(
      parsed,
      hasTranslatePath(parsed.pathname) ? parsed.pathname : appendTranslatePath(parsed.pathname),
      replaceSingleTokenQueryValue(parsed.search),
    ),
  }
}

function migrateProvider(provider: any): any {
  if (!isRecord(provider) || provider.provider !== "deeplx") {
    return provider
  }

  const rawBaseURL = provider.baseURL
  const apiKey = getTrimmedString(provider.apiKey)

  if (rawBaseURL !== undefined && typeof rawBaseURL !== "string") {
    return provider
  }

  const baseURL = getTrimmedString(rawBaseURL)

  if (!baseURL) {
    return {
      ...provider,
      baseURL: DEFAULT_DEEPLX_BASE_URL,
    }
  }

  const parsed = parseAbsoluteURL(baseURL)
  if (!parsed) {
    return provider
  }

  const tokenQuery = getSingleTokenQueryValue(parsed.search)
  if (tokenQuery.status === "duplicate" || tokenQuery.status === "empty") {
    return provider
  }

  if (baseURL.includes(API_KEY_PLACEHOLDER)) {
    return migratePlaceholderURL(provider, parsed)
  }

  if (!isValidLiteralHTTPURL(baseURL)) {
    return provider
  }

  if (tokenQuery.status === "value") {
    return migrateQueryTokenURL(provider, parsed, apiKey, tokenQuery.value!)
  }

  const hostname = getLiteralHostname(baseURL)
  const pathTokenProvider = migratePathTokenProvider(provider, parsed, apiKey, hostname)
  if (pathTokenProvider) {
    return pathTokenProvider
  }

  const isDefaultDeepLXOrgBaseURL = hostname === "api.deeplx.org" && trimPathTrailingSlashes(parsed.pathname) === ""
  if (isDefaultDeepLXOrgBaseURL) {
    return {
      ...provider,
      baseURL: DEFAULT_DEEPLX_BASE_URL,
    }
  }

  if (hasTranslatePath(parsed.pathname)) {
    return provider
  }

  return {
    ...provider,
    baseURL: buildURL(
      parsed,
      apiKey
        ? appendAPIKeyPlaceholderAndTranslate(parsed.pathname)
        : appendTranslatePath(parsed.pathname),
    ),
  }
}

export function migrate(oldConfig: any): any {
  if (!Array.isArray(oldConfig?.providersConfig)) {
    return oldConfig
  }

  return {
    ...oldConfig,
    providersConfig: oldConfig.providersConfig.map(migrateProvider),
  }
}
