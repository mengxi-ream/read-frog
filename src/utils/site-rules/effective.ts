import type { ResolvedSiteRule } from "./resolve"
import type { Config } from "@/types/config/config"
import { BUILT_IN_SITE_RULES } from "./built-in"
import { resolveSiteRule } from "./resolve"

const cache = new WeakMap<Config, { url: string; rule: ResolvedSiteRule }>()

/**
 * Resolve the effective site rule for `url` under `config`, memoized on the
 * config object identity. Within one walk/translation batch the same config
 * object is threaded everywhere, so hot-path callers (per-element filters) get
 * an O(1) lookup; a fresh config fetch or an SPA navigation (new URL) misses
 * the cache and re-resolves naturally.
 */
export function getEffectiveSiteRule(config: Config, url: string): ResolvedSiteRule {
  const cached = cache.get(config)
  if (cached?.url === url) {
    return cached.rule
  }

  // Defensive against configs written before the siteRules field existed
  // (upgrade window) and partial test fixtures.
  const rule = resolveSiteRule(
    url,
    BUILT_IN_SITE_RULES,
    config.siteRules?.userRules ?? [],
    config.siteRules?.disabledBuiltInRules ?? [],
  )
  cache.set(config, { url, rule })
  return rule
}
