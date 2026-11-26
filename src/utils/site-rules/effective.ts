import type { ResolvedSiteRule } from "./resolve"
import type { Config } from "@/types/config/config"
import type { SiteRule } from "@/types/config/site-rules"
import { getActiveBuiltInSiteRules } from "./active"
import { resolveSiteRule } from "./resolve"

const cache = new WeakMap<
  Config,
  {
    url: string
    contentType: string | undefined
    builtInRules: SiteRule[]
    rule: ResolvedSiteRule
  }
>()

/**
 * Resolve the effective site rule for `url` under `config`, memoized on the
 * config object identity. Within one walk/translation batch the same config
 * object is threaded everywhere, so hot-path callers (per-element filters) get
 * an O(1) lookup; a fresh config fetch, an SPA navigation (new URL) or a
 * remote rules update (new built-in rules array) misses the cache and
 * re-resolves naturally.
 *
 * `contentType` is the document's MIME type, which rules declaring
 * `contentTypes` need. Callers without a document (the background, resolving a
 * tab or frame URL) leave it out, and those rules then never match there.
 * Content scripts go through `getDocumentSiteRule` instead.
 */
export function getEffectiveSiteRule(
  config: Config,
  url: string,
  contentType?: string,
): ResolvedSiteRule {
  const builtInRules = getActiveBuiltInSiteRules()
  const cached = cache.get(config)
  if (
    cached?.url === url &&
    cached.contentType === contentType &&
    cached.builtInRules === builtInRules
  ) {
    return cached.rule
  }

  // Defensive against configs written before the siteRules field existed
  // (upgrade window) and partial test fixtures.
  const rule = resolveSiteRule(
    url,
    builtInRules,
    config.siteRules?.userRules ?? [],
    config.siteRules?.disabledBuiltInRules ?? [],
    contentType,
  )
  cache.set(config, { url, contentType, builtInRules, rule })
  return rule
}

/**
 * The effective site rule for the document this script runs in. Every
 * content-side lookup goes through here so they all resolve with the same key:
 * the memo holds one entry per config, so a caller that left the content type
 * out would see a different rule (one without the content-type rules) and
 * evict the entry for everyone else on each alternation.
 */
export function getDocumentSiteRule(config: Config): ResolvedSiteRule {
  return getEffectiveSiteRule(config, window.location.href, document.contentType)
}
