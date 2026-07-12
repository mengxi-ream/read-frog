import type { SiteRule } from "@/types/config/site-rules"
import rules from "./rules.json"

/**
 * Built-in per-site rules shipped with the extension.
 *
 * Order matters: `resolveSiteRule` applies scalar fields last-wins, so rules
 * later in the array take precedence, and the `readfrog-*` rules at the end
 * win over the rest of the data set.
 */
export const BUILT_IN_SITE_RULES: SiteRule[] = rules
