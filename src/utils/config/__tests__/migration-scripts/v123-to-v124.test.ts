// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { lintCSS } from "@/utils/css/lint-css"
import { migrateConfig } from "../../migration"
import { migrate } from "../../migration-scripts/v123-to-v124"
import { testSeries as v123TestSeries } from "../example/v123"

const MAX_CUSTOM_CSS_LENGTH = 8192

/** Stored shapes, not the current schema — typed `any` like the migration they feed. */
function configWith(pageCSS: string | null, subtitlesCSS: string | null = null): any {
  return {
    language: { sourceCode: "auto", targetCode: "zh-Hans", level: "intermediate" },
    pageTranslation: {
      providerId: "microsoft-translate-default",
      translationNodeStyle: { preset: "default", isCustom: true, customCSS: pageCSS },
    },
    videoSubtitles: {
      enabled: true,
      style: { displayMode: "bilingual", translationPosition: "below", customCSS: subtitlesCSS },
    },
  }
}

function pageCSSOf(config: any): string | null {
  return config.pageTranslation.translationNodeStyle.customCSS
}

function subtitlesCSSOf(config: any): string | null {
  return config.videoSubtitles.style.customCSS
}

/** What the migration makes of one selector, standing alone in a rule. */
function rewrite(selector: string): string {
  const css = pageCSSOf(migrate(configWith(`${selector} {}`)))!
  return css.slice(0, -" {}".length)
}

describe("v123 to v124 migration", () => {
  it("rewrites each old lang value to the selector for the tags that replaced it", () => {
    expect(rewrite('[lang="zh"]')).toBe(':is([lang="zh-Hans"], [lang="yue"])')
    expect(rewrite('[lang="zh-TW"]')).toBe('[lang="zh-Hant"]')
    expect(rewrite('[lang="pt"]')).toBe('[lang|="pt"]')
    expect(rewrite('[lang="ku"]')).toBe('[lang="ckb"]')
    expect(rewrite('[lang="tl"]')).toBe('[lang="fil"]')
  })

  it("rewrites the custom CSS for page translations and for subtitles", () => {
    const migrated = migrate(
      configWith(
        '.read-frog-translated-content-wrapper[lang="zh"] { font-family: serif; }',
        '.subtitles-translation[lang="zh-TW"] { color: gold; }',
      ),
    )

    expect(pageCSSOf(migrated)).toBe(
      '.read-frog-translated-content-wrapper:is([lang="zh-Hans"], [lang="yue"]) { font-family: serif; }',
    )
    expect(subtitlesCSSOf(migrated)).toBe('.subtitles-translation[lang="zh-Hant"] { color: gold; }')
    expect(migrated.pageTranslation.translationNodeStyle).toEqual(
      expect.objectContaining({ preset: "default", isCustom: true }),
    )
    expect(migrated.videoSubtitles.style).toEqual(
      expect.objectContaining({ displayMode: "bilingual", translationPosition: "below" }),
    )
    expect(migrated.language.targetCode).toBe("zh-Hans")
  })

  it("rewrites every occurrence, including inside at-rules and functional pseudo-classes", () => {
    const css = [
      ".a[lang='zh'] .b {}",
      "@media (prefers-color-scheme: dark) { .a[lang='zh'] .b:hover {} }",
      '.c:not([lang="pt"]) {}',
    ].join("\n")

    expect(pageCSSOf(migrate(configWith(css)))).toBe(
      [
        '.a:is([lang="zh-Hans"], [lang="yue"]) .b {}',
        '@media (prefers-color-scheme: dark) { .a:is([lang="zh-Hans"], [lang="yue"]) .b:hover {} }',
        '.c:not([lang|="pt"]) {}',
      ].join("\n"),
    )
  })

  it("accepts double quotes, single quotes and no quotes", () => {
    for (const selector of ['[lang="zh-TW"]', "[lang='zh-TW']", "[lang=zh-TW]"]) {
      expect({ selector, rewritten: rewrite(selector) }).toEqual({
        selector,
        rewritten: '[lang="zh-Hant"]',
      })
    }
  })

  it("accepts whitespace anywhere inside the brackets", () => {
    for (const selector of [
      '[ lang="ku"]',
      '[lang ="ku"]',
      '[lang= "ku"]',
      '[lang="ku" ]',
      '[ lang = "ku" ]',
      "[\n\tlang\n=\n'ku'\n]",
      "[ lang = ku ]",
    ]) {
      expect({ selector, rewritten: rewrite(selector) }).toEqual({
        selector,
        rewritten: '[lang="ckb"]',
      })
    }
  })

  it("matches lang values case-insensitively, as HTML did", () => {
    expect(rewrite('[lang="ZH"]')).toBe(':is([lang="zh-Hans"], [lang="yue"])')
    expect(rewrite('[lang="zh-tw"]')).toBe('[lang="zh-Hant"]')
    expect(rewrite('[lang="PT"]')).toBe('[lang|="pt"]')
    expect(rewrite('[LANG="Tl"]')).toBe('[lang="fil"]')
  })

  it("carries an i or s flag over to every selector it writes", () => {
    expect(rewrite('[lang="zh" i]')).toBe(':is([lang="zh-Hans" i], [lang="yue" i])')
    expect(rewrite('[lang="zh"i]')).toBe(':is([lang="zh-Hans" i], [lang="yue" i])')
    expect(rewrite("[lang=pt I]")).toBe('[lang|="pt" I]')
    expect(rewrite('[lang="zh-TW" s]')).toBe('[lang="zh-Hant" s]')
    expect(rewrite("[ lang = tl s ]")).toBe('[lang="fil" s]')
  })

  it("leaves a case-sensitive selector alone when its case never matched the old value", () => {
    for (const selector of ['[lang="ZH" s]', '[lang="zh-tw" s]', '[lang="Pt" S]']) {
      expect(rewrite(selector)).toBe(selector)
    }
  })

  it("leaves other operators, other values and other attributes alone", () => {
    for (const selector of [
      '[lang|="zh"]',
      '[lang^="zh"]',
      '[lang~="zh"]',
      '[lang*="pt"]',
      '[lang$="TW"]',
      "[lang]",
      '[lang="ja"]',
      '[lang="ko"]',
      '[lang="zh-CN"]',
      '[lang="zh-HK"]',
      '[lang="zh-Hans"]',
      '[lang="pt-BR"]',
      '[lang="ku-IQ"]',
      '[lang=""]',
      "[lang=zhi]",
      '[lang="zh" x]',
      '[lang="constructor"]',
      '[data-lang="zh"]',
      '[xml|lang="zh"]',
      ":lang(zh)",
    ]) {
      expect(rewrite(selector)).toBe(selector)
    }
  })

  it("leaves null custom CSS, and a config without the fields, as they are", () => {
    const config = configWith(null, null)
    expect(migrate(config)).toBe(config)

    const bare = { uiLanguage: "zh-CN" }
    expect(migrate(bare)).toBe(bare)

    const withoutStyle = {
      pageTranslation: { providerId: "x" },
      videoSubtitles: { enabled: false },
    }
    expect(migrate(withoutStyle)).toBe(withoutStyle)
  })

  it("returns non-config input untouched", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate("config")).toBe("config")
    const oddStyles = {
      pageTranslation: { translationNodeStyle: "not an object" },
      videoSubtitles: { style: { customCSS: 42 } },
    }
    expect(migrate(oddStyles)).toBe(oddStyles)
  })

  it("does not change the config it is given", () => {
    const config = configWith('[lang="zh"] {}', '[lang="pt"] {}')
    const before = structuredClone(config)

    migrate(config)

    expect(config).toEqual(before)
  })

  it("is idempotent", () => {
    const once = migrate(
      configWith(
        '[lang="zh"], [lang="zh-TW"], [lang="pt"], [lang="ku"], [lang="tl"] { color: red; }',
        "[lang=zh i] {}",
      ),
    )
    const twice = migrate(once)

    expect(twice).toBe(once)
    expect(pageCSSOf(twice)).toBe(
      ':is([lang="zh-Hans"], [lang="yue"]), [lang="zh-Hant"], [lang|="pt"], [lang="ckb"], [lang="fil"] { color: red; }',
    )
  })

  it("keeps the original CSS when the rewrite would pass the length cap", () => {
    // `:is([lang="zh-Hans"], [lang="yue"])` is 24 characters longer than `[lang="zh"]`.
    const padded = (length: number) => {
      const rule = '[lang="zh"] {}'
      return `${rule}/*${"x".repeat(length - rule.length - 4)}*/`
    }

    const tooLong = padded(MAX_CUSTOM_CSS_LENGTH - 10)
    const fits = padded(MAX_CUSTOM_CSS_LENGTH - 24)
    const migrated = migrate(configWith(tooLong, fits))

    expect(pageCSSOf(migrated)).toBe(tooLong)
    expect(subtitlesCSSOf(migrated)).toHaveLength(MAX_CUSTOM_CSS_LENGTH)
    expect(subtitlesCSSOf(migrated)!.startsWith(':is([lang="zh-Hans"], [lang="yue"]) {}')).toBe(
      true,
    )
  })

  it("keeps every v123 example valid with old selectors in both custom CSS fields", async () => {
    // A config that fails the schema after migrating is replaced with defaults, so this is the
    // difference between rewritten selectors and a wiped profile — the over-long case included.
    const overLong = `[lang="zh"] {}/*${"x".repeat(MAX_CUSTOM_CSS_LENGTH - 18)}*/`
    expect(overLong).toHaveLength(MAX_CUSTOM_CSS_LENGTH)

    for (const [seriesId, series] of Object.entries(v123TestSeries)) {
      const config = structuredClone(series.config)
      config.pageTranslation.translationNodeStyle = {
        ...config.pageTranslation.translationNodeStyle,
        isCustom: true,
        customCSS: '.read-frog-translated-content-wrapper[lang="zh"] { color: red; }',
      }
      config.videoSubtitles.style.customCSS = overLong

      const migrated = await migrateConfig(migrate(config), 124)

      expect({ seriesId, css: pageCSSOf(migrated) }).toEqual({
        seriesId,
        css: '.read-frog-translated-content-wrapper:is([lang="zh-Hans"], [lang="yue"]) { color: red; }',
      })
      expect({ seriesId, css: subtitlesCSSOf(migrated) }).toEqual({ seriesId, css: overLong })
    }
  })

  it("writes CSS that still lints, starting from the CSS in issue #2509", () => {
    const css = `/* 中文译文单独设置 */
.read-frog-translated-content-wrapper[lang='zh']
[data-read-frog-custom-translation-style='custom'] {
    font-family: "Maple Mono NL NF CN", "Microsoft YaHei UI", system-ui, sans-serif;
    line-height: 1.75;
}

.read-frog-translated-content-wrapper[lang='zh']
[data-read-frog-custom-translation-style='custom']:hover {
    border-left-color: #368bd1;
}

@media (prefers-color-scheme: dark) {
    .read-frog-translated-content-wrapper[lang='zh']
    [data-read-frog-custom-translation-style='custom'] {
        color: #d7e0e8;
    }
}

.read-frog-translated-content-wrapper[lang="zh-TW"] { color: teal; }
.read-frog-translated-content-wrapper:not([ lang = pt i ]) { color: navy; }
[lang=ku] > span, [lang="tl" s]::before { content: ""; }
`
    expect(lintCSS(css).valid).toBe(true)

    const migrated = pageCSSOf(migrate(configWith(css)))!

    expect(migrated).not.toBe(css)
    expect(migrated).not.toMatch(/\[\s*lang\s*=\s*["']?(zh|zh-TW|pt|ku|tl)["']?[\s\]]/i)
    expect(lintCSS(migrated)).toEqual({ valid: true, errors: [] })
  })

  it("matches the elements with the new tags that the old selectors matched with the old codes", () => {
    // [language, the lang it had before v122, the lang it has now]
    const languages = [
      ["Simplified Chinese", "zh", "zh-Hans"],
      ["Cantonese", "zh", "yue"],
      ["Traditional Chinese", "zh-TW", "zh-Hant"],
      ["Brazilian Portuguese", "pt", "pt-BR"],
      ["European Portuguese", "pt", "pt-PT"],
      ["Central Kurdish", "ku", "ckb"],
      ["Filipino", "tl", "fil"],
      ["Japanese", "ja", "ja"],
      ["English", "en", "en"],
    ] as const

    function translation(lang: string) {
      const wrapper = document.createElement("span")
      wrapper.className = "read-frog-translated-content-wrapper"
      wrapper.setAttribute("lang", lang)
      const inner = document.createElement("span")
      wrapper.append(inner)
      return { wrapper, inner }
    }

    const matchedLanguages: Record<string, string[]> = {}
    for (const oldSelector of [
      '[lang="zh"]',
      '[lang="zh-TW"]',
      '[lang="pt"]',
      '[lang="ku"]',
      '[lang="tl"]',
      '[lang="ja"]',
    ]) {
      const newSelector = rewrite(oldSelector)
      matchedLanguages[oldSelector] = languages
        .filter(([, , newLang]) => translation(newLang).wrapper.matches(newSelector))
        .map(([language]) => language)
      for (const [language, oldLang, newLang] of languages) {
        const before = translation(oldLang)
        const after = translation(newLang)
        // The inner element too: an attribute selector, unlike `:lang()`, never reaches the
        // descendants of the element carrying the attribute.
        expect({
          oldSelector,
          language,
          wrapper: after.wrapper.matches(newSelector),
          inner: after.inner.matches(newSelector),
        }).toEqual({
          oldSelector,
          language,
          wrapper: before.wrapper.matches(oldSelector),
          inner: before.inner.matches(oldSelector),
        })
      }
    }

    expect(matchedLanguages).toEqual({
      '[lang="zh"]': ["Simplified Chinese", "Cantonese"],
      '[lang="zh-TW"]': ["Traditional Chinese"],
      '[lang="pt"]': ["Brazilian Portuguese", "European Portuguese"],
      '[lang="ku"]': ["Central Kurdish"],
      '[lang="tl"]': ["Filipino"],
      '[lang="ja"]': ["Japanese"],
    })
  })
})
