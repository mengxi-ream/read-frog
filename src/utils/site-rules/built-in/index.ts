import type { SiteRule } from "@/types/config/site-rules"
import rules from "./rules.json"

/** A rule as rules.json holds it: the rule, plus what only the published copy uses. */
type PublishedSiteRule = SiteRule & { minExtensionVersion?: string }

/**
 * `minExtensionVersion` tells older builds reading the published copy that a
 * rule needs newer code (see remote/document.ts). A bundled rule ships with
 * that code, so the key goes, as it does from remote rules. That keeps every
 * rule this build runs the same shape: the options page copies built-in rules,
 * and the user rules editor refuses keys it does not know.
 */
export function toBundledSiteRule({
  minExtensionVersion: _minExtensionVersion,
  ...rule
}: PublishedSiteRule): SiteRule {
  return rule
}

const publishedRules: PublishedSiteRule[] = rules

/**
 * Built-in per-site rules shipped with the extension. Merges to main also
 * publish this file to installed extensions, which use it in place of this
 * copy (see `getActiveBuiltInSiteRules` and utils/site-rules/remote).
 *
 * Order matters: `resolveSiteRule` applies scalar fields and tag-set deltas
 * last-wins, so rules later in the array take precedence. The rules that apply
 * everywhere ("*" or "<all_urls>", possibly narrowed by `contentTypes`) sit at
 * the top so every site rule can override them, and the `readfrog-*` site
 * rules at the end win over the rest of the data set.
 */
export const BUILT_IN_SITE_RULES: SiteRule[] = publishedRules.map(toBundledSiteRule)
