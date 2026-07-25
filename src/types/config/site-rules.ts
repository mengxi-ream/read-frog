import { z } from "zod"
import { MAX_CUSTOM_CSS_LENGTH } from "./translate"

/**
 * A per-site translation rule. Built-in rules ship with the extension and user
 * rules live in config; every rule whose `matches` hits the current URL applies.
 * Array fields are unioned across matching rules; scalar fields are last-wins
 * (user rules come after built-in rules, so user values take precedence).
 *
 * URL patterns accept bare hostnames ("github.com"), subdomain wildcards
 * ("*.example.com"), path wildcards (e.g. "github.com/<user>/settings"), and
 * full match patterns ("https://example.com" plus a path wildcard). Query
 * strings are ignored when matching.
 *
 * This schema is deliberately lenient (structure only): an invalid selector or
 * URL pattern is dropped with a warning at resolve time instead of failing the
 * schema, because a failed config parse falls back to DEFAULT_CONFIG and would
 * destroy the user's entire config (see `getLocalConfig`). Strict validation
 * (size caps, duplicate ids) happens in the options-page editor before save.
 */
export const siteRuleSchema = z.object({
  id: z.string().min(1),
  description: z.string().optional(),
  matches: z.union([z.string(), z.array(z.string())]),
  excludeMatches: z.array(z.string()).optional(),
  excludeSelectors: z.array(z.string()).optional(),
  "excludeSelectors.add": z.array(z.string()).optional(),
  "excludeSelectors.remove": z.array(z.string()).optional(),
  includeSelectors: z.array(z.string()).optional(),
  "includeSelectors.add": z.array(z.string()).optional(),
  "includeSelectors.remove": z.array(z.string()).optional(),
  forceBlockNodeSelectors: z.array(z.string()).optional(),
  "forceBlockNodeSelectors.add": z.array(z.string()).optional(),
  "forceBlockNodeSelectors.remove": z.array(z.string()).optional(),
  forceBlockStyleSelectors: z.array(z.string()).optional(),
  "forceBlockStyleSelectors.add": z.array(z.string()).optional(),
  "forceBlockStyleSelectors.remove": z.array(z.string()).optional(),
  forceInlineNodeSelectors: z.array(z.string()).optional(),
  "forceInlineNodeSelectors.add": z.array(z.string()).optional(),
  "forceInlineNodeSelectors.remove": z.array(z.string()).optional(),
  forceInlineStyleSelectors: z.array(z.string()).optional(),
  "forceInlineStyleSelectors.add": z.array(z.string()).optional(),
  "forceInlineStyleSelectors.remove": z.array(z.string()).optional(),
  preserveTextSelectors: z.array(z.string()).optional(),
  "preserveTextSelectors.add": z.array(z.string()).optional(),
  "preserveTextSelectors.remove": z.array(z.string()).optional(),
  minCharacters: z.number().int().min(0).optional(),
  minWords: z.number().int().min(0).optional(),
  injectedCss: z.string().max(MAX_CUSTOM_CSS_LENGTH).optional(),
  "injectedCss.add": z.array(z.string().max(MAX_CUSTOM_CSS_LENGTH)).optional(),
  enabled: z.boolean().optional(),
})

export type SiteRule = z.infer<typeof siteRuleSchema>

/** Editor-enforced cap on the serialized user rules document (not in the schema — see note above). */
export const MAX_SITE_RULES_JSON_LENGTH = 65536
/** Editor-enforced cap on the number of user rules. */
export const MAX_USER_SITE_RULES = 200

// `.default(...)` is load-bearing: it lets configs stored before this field
// existed still parse successfully, avoiding the destructive
// fallback-to-DEFAULT_CONFIG path during the upgrade window (same pattern as
// `uiLanguage` in config.ts).
export const siteRulesConfigSchema = z
  .object({
    userRules: z.array(siteRuleSchema),
    disabledBuiltInRules: z.array(z.string()),
  })
  .default({ userRules: [], disabledBuiltInRules: [] })

export type SiteRulesConfig = z.infer<typeof siteRulesConfigSchema>
