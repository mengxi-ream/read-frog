import type { SiteRule } from "@/types/config/site-rules"
import { MatchPattern } from "@webext-core/match-patterns"
import { logger } from "@/utils/logger"

/**
 * Normalize a user/built-in rule pattern into a standard browser match pattern.
 *
 * Accepted shorthands (bare host expands to scheme "*" and path "/*"):
 * - "github.com"            exact host, any path
 * - "*.example.com"         apex + subdomains
 * - "www.amazon.*"          any TLD
 * - "github.com/settings"   path kept verbatim
 * - "https://example.com"   scheme kept; missing path expands to "/*"
 *
 * Returns `null` for patterns we cannot support (non-http(s) schemes, ports,
 * empty input). Callers drop null patterns with a warning instead of failing
 * hard.
 */
export function normalizeUrlPattern(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }

  let scheme = "*"
  let rest = trimmed
  const schemeMatch = trimmed.match(/^([a-z][a-z0-9+.-]*|\*):\/\//i)
  if (schemeMatch) {
    scheme = schemeMatch[1].toLowerCase()
    rest = trimmed.slice(schemeMatch[0].length)
  }
  if (scheme !== "*" && scheme !== "http" && scheme !== "https") {
    return null
  }

  const slashIndex = rest.indexOf("/")
  const host = (slashIndex === -1 ? rest : rest.slice(0, slashIndex)).toLowerCase()
  const path = slashIndex === -1 ? "/*" : rest.slice(slashIndex)

  // Reject hosts with ports (neither matcher engine supports them) or empty hosts.
  if (!host || host.includes(":")) {
    return null
  }

  return `${scheme}://${host}${path}`
}

interface CompiledPattern {
  includes: (url: string | URL | Location) => boolean
}

/**
 * `MatchPattern` only allows a host wildcard as a leading "*.", but built-in
 * and user rules also use TLD/mid-host wildcards like "www.amazon.*" or
 * "javdb*.com". Those compile here instead: a leading "*." matches zero or
 * more subdomain labels (so the apex is included, mirroring MatchPattern),
 * every other "*" matches any host characters, and path wildcards behave like
 * MatchPattern's (query string ignored).
 */
class WildcardHostPattern implements CompiledPattern {
  private readonly scheme: string
  private readonly hostRegex: RegExp
  private readonly pathRegex: RegExp

  constructor(normalized: string) {
    const match = normalized.match(/^([a-z*]+):\/\/([^/]+)(\/.*)$/)
    if (!match) {
      throw new Error(`Not a normalized pattern: "${normalized}"`)
    }
    this.scheme = match[1]

    let hostSource = escapeForRegex(match[2]).replaceAll("\\*", "[a-z0-9.-]*")
    if (hostSource.startsWith("[a-z0-9.-]*\\.")) {
      hostSource = `(?:[^.]+\\.)*${hostSource.slice("[a-z0-9.-]*\\.".length)}`
    }
    this.hostRegex = new RegExp(`^${hostSource}$`, "i")
    this.pathRegex = new RegExp(`^${escapeForRegex(match[3]).replaceAll("\\*", ".*")}$`)
  }

  includes(url: string | URL | Location): boolean {
    let parsed: URL
    try {
      parsed = new URL(url.toString())
    } catch {
      return false
    }
    const protocol = parsed.protocol.slice(0, -1)
    if (
      this.scheme === "*" ? protocol !== "http" && protocol !== "https" : protocol !== this.scheme
    ) {
      return false
    }
    return this.hostRegex.test(parsed.hostname) && this.pathRegex.test(parsed.pathname)
  }
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Wildcards MatchPattern cannot express: anything beyond a single leading "*.". */
function needsWildcardHostPattern(normalized: string): boolean {
  const host = normalized.slice(normalized.indexOf("://") + 3).split("/", 1)[0]
  if (host === "*" || !host.includes("*")) {
    return false
  }
  return !(host.startsWith("*.") && !host.slice(2).includes("*"))
}

const patternCache = new Map<string, CompiledPattern | null>()

function getCompiledPattern(rawPattern: string): CompiledPattern | null {
  if (patternCache.has(rawPattern)) {
    return patternCache.get(rawPattern) ?? null
  }

  let compiled: CompiledPattern | null = null
  const normalized = normalizeUrlPattern(rawPattern)
  if (normalized === null) {
    logger.warn(`[site-rules] Unsupported URL pattern dropped: "${rawPattern}"`)
  } else {
    try {
      compiled = needsWildcardHostPattern(normalized)
        ? new WildcardHostPattern(normalized)
        : new MatchPattern(normalized)
    } catch (error) {
      logger.warn(`[site-rules] Invalid URL pattern dropped: "${rawPattern}"`, error)
    }
  }

  patternCache.set(rawPattern, compiled)
  return compiled
}

export function urlMatchesPattern(url: string, rawPattern: string): boolean {
  const pattern = getCompiledPattern(rawPattern)
  if (!pattern) {
    return false
  }
  try {
    return pattern.includes(url)
  } catch {
    // MatchPattern.includes throws for URLs with unimplemented protocols.
    return false
  }
}

export function urlMatchesRule(
  url: string,
  rule: Pick<SiteRule, "matches" | "excludeMatches">,
): boolean {
  const matches = Array.isArray(rule.matches) ? rule.matches : [rule.matches]
  if (!matches.some((pattern) => urlMatchesPattern(url, pattern))) {
    return false
  }
  return !(rule.excludeMatches ?? []).some((pattern) => urlMatchesPattern(url, pattern))
}
