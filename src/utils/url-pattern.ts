import { MatchPattern } from "@webext-core/match-patterns"
import { logger } from "@/utils/logger"

/**
 * The one URL matcher in the extension.
 *
 * Every list of websites the product has — auto-translate, never-auto-translate,
 * the site-control black/whitelist, the floating button and selection toolbar
 * opt-outs, iframe injection, site rules, the glossary — resolves through here.
 * There used to be a second, hostname-only matcher (`matchDomainPattern`) behind
 * the user-facing lists, which meant two visually identical pattern tables could
 * match differently. It is gone; the one difference that mattered (a bare host
 * covering its subdomains) was applied once, by a config migration, to the
 * patterns that had been stored under those semantics.
 */

/**
 * Normalize a user/built-in rule pattern into a standard browser match pattern.
 *
 * Accepted shorthands (bare host expands to scheme "*" and path "/*"):
 * - "github.com"            exact host, any path
 * - "*.example.com"         apex + subdomains
 * - "www.amazon.*"          any TLD
 * - "github.com/settings"   path kept verbatim
 * - "https://example.com"   scheme kept; missing path expands to "/*"
 * - "[::1]"                 IPv6 literal, exact host
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
    scheme = schemeMatch[1]!.toLowerCase()
    rest = trimmed.slice(schemeMatch[0].length)
  }
  if (scheme !== "*" && scheme !== "http" && scheme !== "https") {
    return null
  }

  const slashIndex = rest.indexOf("/")
  const host = (slashIndex === -1 ? rest : rest.slice(0, slashIndex)).toLowerCase()
  const path = slashIndex === -1 ? "/*" : rest.slice(slashIndex)

  // Reject hosts with ports (neither matcher engine supports them) or empty
  // hosts. An IPv6 literal is the one host shape whose colons are part of the
  // address rather than a port, and `URL.hostname` keeps its brackets, so it
  // compares as an ordinary exact host.
  if (!host || (host.includes(":") && !isBracketedIpv6(host))) {
    return null
  }

  return `${scheme}://${host}${path}`
}

function isBracketedIpv6(host: string): boolean {
  return host.startsWith("[") && host.endsWith("]")
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
    this.scheme = match[1]!

    let hostSource = escapeForRegex(match[2]!).replaceAll("\\*", "[a-z0-9.-]*")
    if (hostSource.startsWith("[a-z0-9.-]*\\.")) {
      hostSource = `(?:[^.]+\\.)*${hostSource.slice("[a-z0-9.-]*\\.".length)}`
    }
    this.hostRegex = new RegExp(`^${hostSource}$`, "i")
    this.pathRegex = new RegExp(`^${escapeForRegex(match[3]!).replaceAll("\\*", ".*")}$`)
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

/**
 * Hosts `MatchPattern` cannot express: any wildcard beyond a single leading
 * "*.", and IPv6 literals — `MatchPattern` throws on any ":" in the host,
 * having no way to tell an address apart from a port.
 */
function needsWildcardHostPattern(normalized: string): boolean {
  const host = normalized.slice(normalized.indexOf("://") + 3).split("/", 1)[0]!
  if (isBracketedIpv6(host)) {
    return true
  }
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
    logger.warn(`[url-pattern] Unsupported URL pattern dropped: "${rawPattern}"`)
  } else {
    try {
      compiled = needsWildcardHostPattern(normalized)
        ? new WildcardHostPattern(normalized)
        : new MatchPattern(normalized)
    } catch (error) {
      logger.warn(`[url-pattern] Invalid URL pattern dropped: "${rawPattern}"`, error)
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

/**
 * The pattern to store when the EXTENSION picked a site on the user's behalf.
 *
 * The popup's per-site toggles ("always translate this site", "never translate
 * this site") hand us a hostname, not a pattern: the user pointed at the page
 * they were on, and what they mean by "this site" includes `www.` and whatever
 * else lives under it. So a bare host becomes `*.host`, whose leading `*.`
 * matches zero or more labels and therefore covers the apex too.
 *
 * This is NOT applied to a pattern someone typed. `example.com` is valid
 * match-pattern syntax with a meaning of its own — that exact host — and
 * silently widening it would be rewriting their input. The website tables store
 * what was typed; see `usePatternList`.
 *
 * The config migration carries a frozen copy of this transform, for the stored
 * patterns of the hostname-only matcher this module replaced.
 *
 * Anything already carrying a path, a wildcard or a colon is returned as-is. The
 * colon case is reachable: an IPv6 literal host is `[::1]`, and `*.[::1]` would
 * be nonsense.
 */
export function sitePatternForHost(hostname: string): string {
  const trimmed = hostname.trim()
  if (trimmed === "" || trimmed.includes("/") || trimmed.includes("*") || trimmed.includes(":")) {
    return trimmed
  }
  // Lowercased because a host is case-insensitive and this value is compared as
  // a string when deciding whether the site is already in the list.
  return `*.${trimmed.toLowerCase()}`
}

export type UserSitePatternError = "empty" | "gluedWildcard" | "unsupported"

/**
 * Whether a pattern typed into one of the website lists can be accepted.
 *
 * `gluedWildcard` is the sharp edge worth blocking: a `*` sharing a label with
 * other characters compiles to `[a-z0-9.-]*`, which does not stop at a label
 * boundary — `*example.com` matches `notexample.com`. Only a whole-label
 * wildcard (`*.example.com`, `example.*`, `*`) is allowed here.
 *
 * The site-rules JSON editor deliberately does NOT apply this: the built-in
 * rules use glued wildcards on purpose (`javdb*.com`, `affiliate.tiktok*.com`),
 * and its author is expected to know what they are writing.
 */
export function getUserSitePatternError(input: string): UserSitePatternError | null {
  const trimmed = input.trim()
  if (trimmed === "") {
    return "empty"
  }

  const afterScheme = trimmed.includes("://") ? trimmed.slice(trimmed.indexOf("://") + 3) : trimmed
  const host = afterScheme.split("/", 1)[0]!
  if (
    !isBracketedIpv6(host) &&
    host.split(".").some((label) => label !== "*" && label.includes("*"))
  ) {
    return "gluedWildcard"
  }

  return normalizeUrlPattern(trimmed) === null ? "unsupported" : null
}
