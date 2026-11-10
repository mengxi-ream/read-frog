import type { SiteRule } from "@/types/config/site-rules"
import { z } from "zod"
import { siteRuleSchema } from "@/types/config/site-rules"

/**
 * The built-in rules also reach installed extensions between releases. Every
 * merge to main that changes built-in/rules.json publishes it as a signed
 * document (.github/workflows/publish-site-rules.yml), and the background
 * checks for it every six hours (entrypoints/background/site-rules-update.ts).
 * The rules bundled with the extension stay in use whenever the document is
 * missing, fails verification, or is older than this build.
 *
 * The format number is part of the URL, so an incompatible layout can later be
 * published next to this one while older builds keep reading theirs.
 */
export const REMOTE_SITE_RULES_FORMAT = 1
export const REMOTE_SITE_RULES_URL = `https://rules.readfrog.app/v${REMOTE_SITE_RULES_FORMAT}/site-rules.json`

/**
 * Off in development, where the rules.json being edited must be what runs (a
 * published document would otherwise replace it), and in tests.
 */
export const REMOTE_SITE_RULES_ENABLED = !import.meta.env.DEV

/** Far above the published file (about 150 KB for 500 rules). */
export const MAX_REMOTE_SITE_RULES_LENGTH = 2 * 1024 * 1024
const MAX_REMOTE_SITE_RULES = 5000

const extensionVersionSchema = z.string().regex(/^\d+(?:\.\d+){0,3}$/)

/**
 * One rule as the document carries it. Strict where `siteRuleSchema` is
 * lenient, because a field this build does not know may be what keeps the
 * rule in scope: `readfrog-plain-text-document` matches `<all_urls>` and relies
 * on `contentTypes` to apply only to plain-text documents, so with that field
 * stripped it would walk PRE on every page. A rule like that gives way to this
 * build's own copy, or is skipped.
 *
 * `minExtensionVersion` covers what a field cannot show: a rule that needs code
 * from the same change, such as a selector that only works with a walker fix.
 * Older builds keep their own copy of the rule, or skip a new one.
 */
export const remoteSiteRuleSchema = z.strictObject({
  ...siteRuleSchema.shape,
  minExtensionVersion: extensionVersionSchema.optional(),
})

export const remoteSiteRulesDocumentSchema = z.object({
  format: z.literal(REMOTE_SITE_RULES_FORMAT),
  /**
   * Commit time of the published rules, in Unix seconds. It only orders
   * documents against each other: a fetched document replaces the stored one
   * only when its revision is higher, so a stale CDN copy never rolls back.
   */
  revision: z.number().int().positive(),
  /**
   * The package.json version when the document was published, which is the
   * latest release at the time. A newer build bundles these rules or newer
   * ones, so it keeps its own.
   */
  extensionVersion: extensionVersionSchema,
  /** Checked one by one against this build's schema when they are applied. */
  rules: z.array(z.unknown()).max(MAX_REMOTE_SITE_RULES),
})

export type RemoteSiteRulesDocument = z.infer<typeof remoteSiteRulesDocumentSchema>

/** Compares dotted numeric versions such as "1.58.1": negative, zero or positive. */
export function compareExtensionVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number)
  const rightParts = right.split(".").map(Number)
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index++) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0)
    if (difference !== 0) {
      return difference
    }
  }
  return 0
}

// Everything in CSS that fetches takes one of these. `image()` and
// `image-set()` also accept a bare string URL.
const LOADING_CSS_PATTERN = /url\(|src\(|image\(|image-set\(|@import/i

function decodeCssEscapes(css: string): string {
  return css.replaceAll(
    /\\(?:([\da-f]{1,6})[\t\n\f\r ]?|([\s\S]))/gi,
    (_match, hex: string | undefined, char: string | undefined) => {
      if (hex === undefined) {
        return char ?? ""
      }
      const codePoint = Number.parseInt(hex, 16)
      return codePoint > 0 && codePoint <= 0x10ffff && (codePoint < 0xd800 || codePoint > 0xdfff)
        ? String.fromCodePoint(codePoint)
        : "�"
    },
  )
}

/**
 * CSS from the document may not load anything. The signature keeps strangers
 * from publishing rules; this keeps even a leaked key from turning rule CSS
 * into a beacon or a reader of page attributes (`input[value^="a"]` with a
 * background URL). No built-in rule needs to load anything. Escapes are decoded
 * first, because `\75 rl(` is a `url(` as well.
 */
export function isRemoteCssAllowed(css: string): boolean {
  return !LOADING_CSS_PATTERN.test(decodeCssEscapes(css))
}

/** The rule as this build can apply it, or null when it cannot. */
export function parseRemoteSiteRule(raw: unknown, extensionVersion: string): SiteRule | null {
  const result = remoteSiteRuleSchema.safeParse(raw)
  if (!result.success) {
    return null
  }
  const { minExtensionVersion, ...rule } = result.data
  if (
    minExtensionVersion !== undefined &&
    compareExtensionVersions(extensionVersion, minExtensionVersion) < 0
  ) {
    return null
  }
  const cssBlocks = [rule.injectedCss, ...(rule["injectedCss.add"] ?? [])]
  return cssBlocks.every((css) => css === undefined || isRemoteCssAllowed(css)) ? rule : null
}

function rawRuleId(raw: unknown): string | undefined {
  return typeof raw === "object" && raw !== null && "id" in raw && typeof raw.id === "string"
    ? raw.id
    : undefined
}

/**
 * The built-in rules a build runs. The document wins when it is at least as
 * new as the build, and it is the whole ordered list: a rule removed from it
 * stops applying everywhere. A rule the build cannot take as is gives way to
 * the bundled rule with the same id, in its place, or is skipped.
 */
export function selectBuiltInSiteRules(
  bundledRules: SiteRule[],
  remote: RemoteSiteRulesDocument | null,
  extensionVersion: string,
): SiteRule[] {
  if (!remote || compareExtensionVersions(remote.extensionVersion, extensionVersion) < 0) {
    return bundledRules
  }

  const bundledById = new Map(bundledRules.map((rule) => [rule.id, rule]))
  const selected: SiteRule[] = []
  const selectedIds = new Set<string>()
  for (const raw of remote.rules) {
    const id = rawRuleId(raw)
    const rule =
      parseRemoteSiteRule(raw, extensionVersion) ??
      (id === undefined ? undefined : bundledById.get(id))
    if (rule && !selectedIds.has(rule.id)) {
      selectedIds.add(rule.id)
      selected.push(rule)
    }
  }
  return selected
}
