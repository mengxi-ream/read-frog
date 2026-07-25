import type { SiteRule } from "@/types/config/site-rules"
import { z } from "zod"
import {
  MAX_SITE_RULES_JSON_LENGTH,
  MAX_USER_SITE_RULES,
  siteRuleSchema,
} from "@/types/config/site-rules"

export interface UserRulesIssue {
  path: string
  message: string
}

export type UserRulesValidationErrorKind =
  | "syntax"
  | "notArray"
  | "tooLong"
  | "tooMany"
  | "schema"
  | "duplicateIds"

export type UserRulesValidationResult =
  | { ok: true; rules: SiteRule[] }
  | { ok: false; kind: UserRulesValidationErrorKind; issues: UserRulesIssue[] }

const selectorListSchema = z.array(z.string()).optional()

const editorSiteRuleInputSchema = siteRuleSchema
  .extend({
    forceBlockSelectors: selectorListSchema,
    "forceBlockSelectors.add": selectorListSchema,
    "forceBlockSelectors.remove": selectorListSchema,
    forceInlineSelectors: selectorListSchema,
    "forceInlineSelectors.add": selectorListSchema,
    "forceInlineSelectors.remove": selectorListSchema,
  })
  .strict()

const LEGACY_FORCE_SELECTOR_MAPPINGS = [
  ["forceBlockSelectors", ["forceBlockNodeSelectors", "forceBlockStyleSelectors"]],
  ["forceBlockSelectors.add", ["forceBlockNodeSelectors.add", "forceBlockStyleSelectors.add"]],
  [
    "forceBlockSelectors.remove",
    ["forceBlockNodeSelectors.remove", "forceBlockStyleSelectors.remove"],
  ],
  ["forceInlineSelectors", ["forceInlineStyleSelectors"]],
  ["forceInlineSelectors.add", ["forceInlineStyleSelectors.add"]],
  ["forceInlineSelectors.remove", ["forceInlineStyleSelectors.remove"]],
] as const

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function migrateLegacyForceSelectors(rule: z.infer<typeof editorSiteRuleInputSchema>): SiteRule {
  const source = rule as Record<string, unknown>
  const migrated: Record<string, unknown> = { ...source }

  for (const [legacyKey, canonicalKeys] of LEGACY_FORCE_SELECTOR_MAPPINGS) {
    if (hasOwn(source, legacyKey)) {
      for (const canonicalKey of canonicalKeys) {
        if (!hasOwn(source, canonicalKey)) {
          migrated[canonicalKey] = source[legacyKey]
        }
      }
    }
    delete migrated[legacyKey]
  }

  return migrated as SiteRule
}

const userRulesArraySchema = z.array(
  editorSiteRuleInputSchema.transform(migrateLegacyForceSelectors),
)

/** Render a zod issue path as `rules[2].matches`: numeric segments as `[n]`, string segments as `.name`. */
function formatIssuePath(path: PropertyKey[]): string {
  let formatted = "rules"
  for (const segment of path) {
    formatted += typeof segment === "number" ? `[${segment}]` : `.${String(segment)}`
  }
  return formatted
}

/**
 * Validate the user rules JSON document from the options-page editor.
 *
 * Pure: no i18n here — callers map `kind` to localized messages; `issues`
 * carry the raw parser/schema details for the error list.
 */
export function validateUserRulesDocument(text: string): UserRulesValidationResult {
  if (!text.trim()) {
    return { ok: true, rules: [] }
  }

  if (text.length > MAX_SITE_RULES_JSON_LENGTH) {
    return {
      ok: false,
      kind: "tooLong",
      issues: [
        {
          path: "rules",
          message: `Document is ${text.length} characters (max ${MAX_SITE_RULES_JSON_LENGTH})`,
        },
      ],
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    return {
      ok: false,
      kind: "syntax",
      issues: [{ path: "rules", message: error instanceof Error ? error.message : String(error) }],
    }
  }

  if (!Array.isArray(parsed)) {
    return {
      ok: false,
      kind: "notArray",
      issues: [{ path: "rules", message: "Top-level JSON value must be an array of rules" }],
    }
  }

  if (parsed.length > MAX_USER_SITE_RULES) {
    return {
      ok: false,
      kind: "tooMany",
      issues: [{ path: "rules", message: `${parsed.length} rules (max ${MAX_USER_SITE_RULES})` }],
    }
  }

  const result = userRulesArraySchema.safeParse(parsed)
  if (!result.success) {
    return {
      ok: false,
      kind: "schema",
      issues: result.error.issues.flatMap((issue) => {
        const path = formatIssuePath(issue.path)
        if (issue.code === "unrecognized_keys") {
          return issue.keys.map((key) => ({
            path: `${path}.${key}`,
            message: `Unrecognized field "${key}"`,
          }))
        }
        return [{ path, message: issue.message }]
      }),
    }
  }

  const seenIds = new Set<string>()
  const duplicateIssues: UserRulesIssue[] = []
  result.data.forEach((rule, index) => {
    if (seenIds.has(rule.id)) {
      duplicateIssues.push({ path: `rules[${index}].id`, message: `Duplicate id "${rule.id}"` })
    }
    seenIds.add(rule.id)
  })
  if (duplicateIssues.length > 0) {
    return { ok: false, kind: "duplicateIds", issues: duplicateIssues }
  }

  return { ok: true, rules: result.data }
}
