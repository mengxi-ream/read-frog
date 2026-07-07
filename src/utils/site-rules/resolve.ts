import type { SiteRule } from "@/types/config/site-rules"
import { logger } from "@/utils/logger"
import { urlMatchesRule } from "./match"

/**
 * The merged outcome of every site rule matching one URL. Selector lists are
 * validated per entry, deduped, and pre-joined so hot-path consumers can pass
 * them straight to `element.matches()` / `element.closest()`.
 */
export interface ResolvedSiteRule {
  matchedRuleIds: string[]
  excludeSelector: string | null
  includeSelector: string | null
  forceBlockSelector: string | null
  forceInlineSelector: string | null
  minCharacters: number | null
  minWords: number | null
  injectedCss: string | null
}

export const EMPTY_RESOLVED_SITE_RULE: ResolvedSiteRule = {
  matchedRuleIds: [],
  excludeSelector: null,
  includeSelector: null,
  forceBlockSelector: null,
  forceInlineSelector: null,
  minCharacters: null,
  minWords: null,
  injectedCss: null,
}

const selectorValidity = new Map<string, boolean>()

/**
 * A single malformed selector would make the whole joined selector throw in
 * `element.matches()`, so each entry is probed individually and invalid ones
 * are dropped with a warning.
 */
function isValidSelector(selector: string): boolean {
  if (typeof document === "undefined") {
    // Non-DOM environment (pure unit tests): trust the selector.
    return true
  }
  let valid = selectorValidity.get(selector)
  if (valid === undefined) {
    try {
      document.createDocumentFragment().querySelector(selector)
      valid = true
    }
    catch {
      logger.warn(`[site-rules] Invalid CSS selector dropped: "${selector}"`)
      valid = false
    }
    selectorValidity.set(selector, valid)
  }
  return valid
}

function mergeSelectors(lists: (string[] | undefined)[]): string | null {
  const merged = new Set<string>()
  for (const list of lists) {
    for (const selector of list ?? []) {
      const trimmed = selector.trim()
      if (trimmed && isValidSelector(trimmed)) {
        merged.add(trimmed)
      }
    }
  }
  return merged.size > 0 ? [...merged].join(",") : null
}

/**
 * Merge all rules matching `url` into one effective rule.
 *
 * Ordering: built-in rules (array order) first, then user rules (array order).
 * - Selector arrays are unioned across all matching rules.
 * - `injectedCss` is concatenated (later rules append; disabling the built-in
 *   rule is the way to replace its CSS entirely).
 * - Remaining scalars are last-wins, so user rules override built-in ones.
 */
export function resolveSiteRule(
  url: string,
  builtInRules: SiteRule[],
  userRules: SiteRule[],
  disabledBuiltInRuleIds: string[],
): ResolvedSiteRule {
  const disabled = new Set(disabledBuiltInRuleIds)
  const candidates = [
    ...builtInRules.filter(rule => !disabled.has(rule.id)),
    ...userRules.filter(rule => rule.enabled !== false),
  ]

  const matched = candidates.filter(rule => urlMatchesRule(url, rule))
  if (matched.length === 0) {
    return EMPTY_RESOLVED_SITE_RULE
  }

  let minCharacters: number | null = null
  let minWords: number | null = null
  const cssParts: string[] = []
  for (const rule of matched) {
    if (rule.minCharacters !== undefined) {
      minCharacters = rule.minCharacters
    }
    if (rule.minWords !== undefined) {
      minWords = rule.minWords
    }
    if (rule.injectedCss !== undefined && rule.injectedCss.trim()) {
      cssParts.push(rule.injectedCss)
    }
  }

  return {
    matchedRuleIds: matched.map(rule => rule.id),
    excludeSelector: mergeSelectors(matched.map(rule => rule.excludeSelectors)),
    includeSelector: mergeSelectors(matched.map(rule => rule.includeSelectors)),
    forceBlockSelector: mergeSelectors(matched.map(rule => rule.forceBlockSelectors)),
    forceInlineSelector: mergeSelectors(matched.map(rule => rule.forceInlineSelectors)),
    minCharacters,
    minWords,
    injectedCss: cssParts.length > 0 ? cssParts.join("\n") : null,
  }
}
