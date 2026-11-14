/**
 * Migration script from v123 to v124
 *
 * Since v122 the `lang` attribute on a translation holds the target's full BCP 47 tag rather than
 * a two-letter code, so custom CSS written for the old values stopped matching (issue #2509). This
 * step rewrites those attribute selectors where custom CSS is kept, so each matches what it did
 * before:
 * - `pageTranslation.translationNodeStyle.customCSS`, styling `.read-frog-translated-content-wrapper`
 * - `videoSubtitles.style.customCSS`, styling `.subtitles-translation`
 *
 * Among languages that had a `lang` at all, five values changed:
 *
 *   [lang="zh"]     Simplified Chinese, Cantonese  →  :is([lang="zh-Hans"], [lang="yue"])
 *   [lang="zh-TW"]  Traditional Chinese            →  [lang="zh-Hant"]
 *   [lang="pt"]     Portuguese                     →  [lang|="pt"]
 *   [lang="ku"]     Central Kurdish                →  [lang="ckb"]
 *   [lang="tl"]     Filipino                       →  [lang="fil"]
 *
 * Cantonese was written `zh` too, so `zh` becomes both its successors. Not `:lang(zh)`: that also
 * takes in `zh-Hant`, and would set a user's `zh` rule and `zh-TW` rule against each other.
 * Portuguese is now `pt-BR` or `pt-PT`, and `|=` matches both while staying an attribute selector.
 * `:lang(pt)` would also match everything inside a translation, and every element of a Portuguese
 * page, since custom CSS is a stylesheet on the whole document.
 *
 * Every replacement has the specificity of the attribute selector it replaces, (0,1,0), so the
 * user's rules keep winning and losing against each other as they did.
 *
 * Rewritten: `[lang=…]` with the value in double quotes, single quotes or none, with any
 * whitespace inside the brackets, and with an `i` or `s` flag, which is kept. HTML compares `lang`
 * values case-insensitively, so `[lang="ZH"]` matched and is rewritten; under `s` only the value
 * exactly as the extension wrote it matched, so only that is. Other operators (`|=`, `^=`, …) and
 * other values stay as they are. This is a text rewrite, so a selector quoted in a comment or a
 * string changes too.
 *
 * Custom CSS is capped at 8192 characters, and a config that fails validation after migrating is
 * replaced with defaults, every setting lost. A field whose rewrite would pass the cap keeps its
 * original CSS.
 *
 * Idempotent: no new value is one of the old ones, and `|=` is not rewritten.
 *
 * IMPORTANT: This is a frozen snapshot. All values and helpers are deliberately inline and it
 * imports nothing from the evolving application code.
 */

// The schema's cap on both fields at v124.
const MAX_CUSTOM_CSS_LENGTH = 8192

function langSelector(operator: "=" | "|=", value: string, flag: string): string {
  return `[lang${operator}"${value}"${flag ? ` ${flag}` : ""}]`
}

interface Replacement {
  /** The value as the extension wrote it, which an `s`-flagged selector had to match exactly. */
  oldValue: string
  /** The selector matching every value that took its place, carrying the old selector's flag. */
  build: (flag: string) => string
}

// Keyed by the old value lowercased. A Map, so a value such as "constructor" finds nothing.
const REPLACEMENTS = new Map<string, Replacement>([
  [
    "zh",
    {
      oldValue: "zh",
      build: (flag) =>
        `:is(${langSelector("=", "zh-Hans", flag)}, ${langSelector("=", "yue", flag)})`,
    },
  ],
  ["zh-tw", { oldValue: "zh-TW", build: (flag) => langSelector("=", "zh-Hant", flag) }],
  ["pt", { oldValue: "pt", build: (flag) => langSelector("|=", "pt", flag) }],
  ["ku", { oldValue: "ku", build: (flag) => langSelector("=", "ckb", flag) }],
  ["tl", { oldValue: "tl", build: (flag) => langSelector("=", "fil", flag) }],
])

// `[lang=value]`. A quoted value may run straight into the flag (`"zh"i`); an unquoted one needs
// whitespace first, or `[lang=zhi]` would read as `zh` with an `i` flag.
const LANG_EQUALS_SELECTOR =
  /\[\s*lang\s*=\s*(?:(["'])([\w-]*)\1\s*|([\w-]+)(?:\s+|(?=\])))(?:([is])\s*)?\]/gi

function rewriteLangSelectors(css: string): string {
  return css.replace(
    LANG_EQUALS_SELECTOR,
    (
      selector: string,
      _quote: string | undefined,
      quotedValue: string | undefined,
      bareValue: string | undefined,
      flag: string | undefined,
    ) => {
      const value = quotedValue ?? bareValue ?? ""
      const replacement = REPLACEMENTS.get(value.toLowerCase())
      if (!replacement) return selector
      if (flag?.toLowerCase() === "s" && value !== replacement.oldValue) return selector
      return replacement.build(flag ?? "")
    },
  )
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

// The same record when there is nothing to change, so a second run hands its input back.
function withMigratedCustomCSS(style: unknown): unknown {
  if (!isRecord(style) || typeof style.customCSS !== "string") return style
  const rewritten = rewriteLangSelectors(style.customCSS)
  if (rewritten === style.customCSS || rewritten.length > MAX_CUSTOM_CSS_LENGTH) return style
  return { ...style, customCSS: rewritten }
}

export function migrate(oldConfig: any): any {
  if (!isRecord(oldConfig)) return oldConfig

  let config: Record<string, any> = oldConfig

  const pageTranslation = config.pageTranslation
  if (isRecord(pageTranslation)) {
    const translationNodeStyle = withMigratedCustomCSS(pageTranslation.translationNodeStyle)
    if (translationNodeStyle !== pageTranslation.translationNodeStyle) {
      config = { ...config, pageTranslation: { ...pageTranslation, translationNodeStyle } }
    }
  }

  const videoSubtitles = config.videoSubtitles
  if (isRecord(videoSubtitles)) {
    const style = withMigratedCustomCSS(videoSubtitles.style)
    if (style !== videoSubtitles.style) {
      config = { ...config, videoSubtitles: { ...videoSubtitles, style } }
    }
  }

  return config
}
