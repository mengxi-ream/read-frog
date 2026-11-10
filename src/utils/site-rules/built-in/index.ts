import type { SiteRule } from "@/types/config/site-rules"
import rules from "./rules.json"

/**
 * Built-in per-site rules shipped with the extension.
 *
 * Order matters: `resolveSiteRule` applies scalar fields and tag-set deltas
 * last-wins, so rules later in the array take precedence. The rules that apply
 * everywhere ("*" or "<all_urls>", possibly narrowed by `contentTypes`) sit at
 * the top so every site rule can override them, and the `readfrog-*` site
 * rules at the end win over the rest of the data set.
 */
export const BUILT_IN_SITE_RULES: SiteRule[] = rules
