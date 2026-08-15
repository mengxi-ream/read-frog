import type { SiteRule } from "@/types/config/site-rules"
import { DEFAULT_TAG_SETS } from "@/utils/constants/dom-rules"
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
  forceBlockNodeSelector: string | null
  forceBlockStyleSelector: string | null
  forceInlineNodeSelector: string | null
  forceInlineStyleSelector: string | null
  preserveTextSelector: string | null
  /**
   * Tag-set families: `null` means no matched rule touched the family, so
   * consumers fall back to the shipped constant Set (hot path unchanged).
   * Non-null is the fully materialized effective set — defaults seeded in
   * code, rule `.add`/`.remove` deltas applied.
   */
  dontWalkTags: ReadonlySet<string> | null
  /**
   * The tag names a matched rule named in `dontWalkTags.add` (minus any a later
   * rule removed), kept apart from the merged set so consumers can tell an
   * explicit authoring choice from a shipped default. Read by the plain-text
   * `<pre>` exemption in `utils/host/dom/filter`: the exemption un-blocks a tag
   * the defaults block, so a rule that names it explicitly must still win.
   */
  dontWalkTagsExplicitAdds: ReadonlySet<string> | null
  dontWalkButTranslateTags: ReadonlySet<string> | null
  mainContentIgnoreTags: ReadonlySet<string> | null
  forceBlockTags: ReadonlySet<string> | null
  forceInlineTranslationTags: ReadonlySet<string> | null
  minCharacters: number | null
  minWords: number | null
  injectedCss: string | null
}

export const EMPTY_RESOLVED_SITE_RULE: ResolvedSiteRule = {
  matchedRuleIds: [],
  excludeSelector: null,
  includeSelector: null,
  forceBlockNodeSelector: null,
  forceBlockStyleSelector: null,
  forceInlineNodeSelector: null,
  forceInlineStyleSelector: null,
  preserveTextSelector: null,
  dontWalkTags: null,
  dontWalkTagsExplicitAdds: null,
  dontWalkButTranslateTags: null,
  mainContentIgnoreTags: null,
  forceBlockTags: null,
  forceInlineTranslationTags: null,
  minCharacters: null,
  minWords: null,
  injectedCss: null,
}

/**
 * Tags whose removal from `dontWalkTags` would be catastrophic (script/style
 * text injected into translations, head metadata walked). Removal attempts are
 * skipped with a warning. PRE is deliberately absent — un-blocking it is a
 * legitimate per-site choice.
 */
export const PROTECTED_DONT_WALK_TAGS: ReadonlySet<string> = new Set([
  "HEAD",
  "TITLE",
  "META",
  "SCRIPT",
  "NOSCRIPT",
  "STYLE",
  "LINK",
])

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
    } catch {
      logger.warn(`[site-rules] Invalid CSS selector dropped: "${selector}"`)
      valid = false
    }
    selectorValidity.set(selector, valid)
  }
  return valid
}

function joinSelectors(selectors: Iterable<string>): string | null {
  const merged = new Set<string>()
  for (const selector of selectors) {
    const trimmed = selector.trim()
    if (trimmed && isValidSelector(trimmed)) {
      merged.add(trimmed)
    }
  }
  return merged.size > 0 ? [...merged].join(",") : null
}

function mergeSelectorDelta(
  matched: SiteRule[],
  baseKey: keyof SiteRule,
  addKey: keyof SiteRule,
  removeKey: keyof SiteRule,
): string | null {
  const merged = new Set<string>()

  const addSelectors = (selectors: unknown) => {
    for (const selector of Array.isArray(selectors) ? selectors : []) {
      const trimmed = typeof selector === "string" ? selector.trim() : ""
      if (trimmed && isValidSelector(trimmed)) {
        merged.add(trimmed)
      }
    }
  }

  const removeSelectors = (selectors: unknown) => {
    for (const selector of Array.isArray(selectors) ? selectors : []) {
      const trimmed = typeof selector === "string" ? selector.trim() : ""
      if (trimmed && isValidSelector(trimmed)) {
        merged.delete(trimmed)
      }
    }
  }

  for (const rule of matched) {
    addSelectors(rule[baseKey])
    addSelectors(rule[addKey])
    removeSelectors(rule[removeKey])
  }

  return joinSelectors(merged)
}

const TAG_NAME_RE = /^[a-z][a-z0-9-]*$/i

/**
 * Tag-set families are seeded from the shipped default Set and patched with
 * `.add`/`.remove` tag-name entries. Not routed through `mergeSelectorDelta`:
 * its `querySelector` probe would happily accept class/descendant selectors
 * that a `Set.has(tagName)` consumer can never match, silencing the mistake.
 * Returns `null` when no matched rule references the family, so hot-path
 * consumers keep using the constant Set untouched.
 *
 * Case handling: `tagName` is uppercase for HTML elements but case-preserving
 * for SVG/MathML (e.g. "svg", "foreignObject"), so adds insert the raw,
 * uppercase, and lowercase forms while removes delete all three. camelCase
 * foreign tags therefore need the same casing in `.add` and `.remove`.
 */
function mergeTagSetDelta(
  matched: SiteRule[],
  addKey: keyof SiteRule,
  removeKey: keyof SiteRule,
  defaults: ReadonlySet<string>,
  protectedTags?: ReadonlySet<string>,
  /** Filled with the tag names `addKey` named, in the same three casings. */
  explicitAddsTarget?: Set<string>,
): ReadonlySet<string> | null {
  if (!matched.some((rule) => rule[addKey] !== undefined || rule[removeKey] !== undefined)) {
    return null
  }

  const merged = new Set(defaults)

  const validTagNames = (entries: unknown): string[] => {
    const tagNames: string[] = []
    for (const entry of Array.isArray(entries) ? entries : []) {
      const trimmed = typeof entry === "string" ? entry.trim() : ""
      if (TAG_NAME_RE.test(trimmed)) {
        tagNames.push(trimmed)
      } else {
        logger.warn(`[site-rules] Invalid tag name dropped: "${String(entry)}"`)
      }
    }
    return tagNames
  }

  for (const rule of matched) {
    for (const tagName of validTagNames(rule[addKey])) {
      merged.add(tagName)
      merged.add(tagName.toUpperCase())
      merged.add(tagName.toLowerCase())
      explicitAddsTarget?.add(tagName)
      explicitAddsTarget?.add(tagName.toUpperCase())
      explicitAddsTarget?.add(tagName.toLowerCase())
    }
    for (const tagName of validTagNames(rule[removeKey])) {
      if (protectedTags?.has(tagName.toUpperCase())) {
        logger.warn(`[site-rules] Protected tag cannot be removed: "${tagName}"`)
        continue
      }
      merged.delete(tagName)
      merged.delete(tagName.toUpperCase())
      merged.delete(tagName.toLowerCase())
      // A later rule removing what an earlier one added cancels the explicit
      // choice too, so the last word decides.
      explicitAddsTarget?.delete(tagName)
      explicitAddsTarget?.delete(tagName.toUpperCase())
      explicitAddsTarget?.delete(tagName.toLowerCase())
    }
  }

  return merged
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
    ...builtInRules.filter((rule) => !disabled.has(rule.id)),
    ...userRules.filter((rule) => rule.enabled !== false),
  ]

  const matched = candidates.filter((rule) => urlMatchesRule(url, rule))
  if (matched.length === 0) {
    return EMPTY_RESOLVED_SITE_RULE
  }

  let minCharacters: number | null = null
  let minWords: number | null = null
  const dontWalkTagsExplicitAdds = new Set<string>()
  const cssParts: string[] = []
  for (const rule of matched) {
    if (rule.minCharacters !== undefined) {
      minCharacters = rule.minCharacters
    }
    if (rule.minWords !== undefined) {
      minWords = rule.minWords
    }
    const injectedCssParts = [rule.injectedCss, ...(rule["injectedCss.add"] ?? [])]
    for (const css of injectedCssParts) {
      if (css?.trim()) {
        cssParts.push(css)
      }
    }
  }

  return {
    matchedRuleIds: matched.map((rule) => rule.id),
    excludeSelector: mergeSelectorDelta(
      matched,
      "excludeSelectors",
      "excludeSelectors.add",
      "excludeSelectors.remove",
    ),
    includeSelector: mergeSelectorDelta(
      matched,
      "includeSelectors",
      "includeSelectors.add",
      "includeSelectors.remove",
    ),
    forceBlockNodeSelector: mergeSelectorDelta(
      matched,
      "forceBlockNodeSelectors",
      "forceBlockNodeSelectors.add",
      "forceBlockNodeSelectors.remove",
    ),
    forceBlockStyleSelector: mergeSelectorDelta(
      matched,
      "forceBlockStyleSelectors",
      "forceBlockStyleSelectors.add",
      "forceBlockStyleSelectors.remove",
    ),
    forceInlineNodeSelector: mergeSelectorDelta(
      matched,
      "forceInlineNodeSelectors",
      "forceInlineNodeSelectors.add",
      "forceInlineNodeSelectors.remove",
    ),
    forceInlineStyleSelector: mergeSelectorDelta(
      matched,
      "forceInlineStyleSelectors",
      "forceInlineStyleSelectors.add",
      "forceInlineStyleSelectors.remove",
    ),
    preserveTextSelector: mergeSelectorDelta(
      matched,
      "preserveTextSelectors",
      "preserveTextSelectors.add",
      "preserveTextSelectors.remove",
    ),
    dontWalkTags: mergeTagSetDelta(
      matched,
      "dontWalkTags.add",
      "dontWalkTags.remove",
      DEFAULT_TAG_SETS.dontWalkTags,
      PROTECTED_DONT_WALK_TAGS,
      dontWalkTagsExplicitAdds,
    ),
    dontWalkTagsExplicitAdds: dontWalkTagsExplicitAdds.size > 0 ? dontWalkTagsExplicitAdds : null,
    dontWalkButTranslateTags: mergeTagSetDelta(
      matched,
      "dontWalkButTranslateTags.add",
      "dontWalkButTranslateTags.remove",
      DEFAULT_TAG_SETS.dontWalkButTranslateTags,
    ),
    mainContentIgnoreTags: mergeTagSetDelta(
      matched,
      "mainContentIgnoreTags.add",
      "mainContentIgnoreTags.remove",
      DEFAULT_TAG_SETS.mainContentIgnoreTags,
    ),
    forceBlockTags: mergeTagSetDelta(
      matched,
      "forceBlockTags.add",
      "forceBlockTags.remove",
      DEFAULT_TAG_SETS.forceBlockTags,
    ),
    forceInlineTranslationTags: mergeTagSetDelta(
      matched,
      "forceInlineTranslationTags.add",
      "forceInlineTranslationTags.remove",
      DEFAULT_TAG_SETS.forceInlineTranslationTags,
    ),
    minCharacters,
    minWords,
    injectedCss: cssParts.length > 0 ? cssParts.join("\n") : null,
  }
}
