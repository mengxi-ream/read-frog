import { compileLayout, renderLayoutHtml } from "@read-frog/layout-engine/core"
import { lintLayout } from "@read-frog/layout-engine/editor"
import { describe, expect, it } from "vitest"
import { MAX_CUSTOM_ACTION_LAYOUT_LENGTH } from "@/types/config/selection-toolbar"
import {
  buildCustomActionLayoutScope,
  createCustomActionLayoutHost,
  CUSTOM_ACTION_LAYOUT_HOST,
} from "../host"

// Saved layouts read these ctx keys: this list may grow, never shrink or be
// reordered.
describe("the custom action layout host", () => {
  it("keeps the ctx keys layouts were written against", () => {
    expect(CUSTOM_ACTION_LAYOUT_HOST.ctxKeys).toEqual([
      "fields",
      "selection",
      "targetLanguage",
      "sentenceAnalysisLabels",
      "improveWritingLabels",
      "status",
    ])
  })

  it("keys fields by name and caps layouts at the config schema's length", () => {
    expect(CUSTOM_ACTION_LAYOUT_HOST.scopeKey).toBe("name")
    expect(CUSTOM_ACTION_LAYOUT_HOST.maxSourceLength).toBe(MAX_CUSTOM_ACTION_LAYOUT_LENGTH)
    expect(createCustomActionLayoutHost(10).maxSourceLength).toBe(10)
  })

  it("exposes the answer by field name and the run in ctx", () => {
    const compiled = compileLayout(
      '{{ ["the term"] }}|{{ ctx.selection }}|{{ ctx.targetLanguage }}|{{ ctx.status }}|{% for f in ctx.fields %}{{ f.id }}:{{ f.value }}:{{ f.pending }};{% endfor %}',
    )
    if (!compiled.ok) throw compiled.error

    const html = renderLayoutHtml(
      compiled.compiled,
      buildCustomActionLayoutScope({
        outputSchema: [
          { id: "t", name: "the term", type: "string", description: "" },
          { id: "n", name: "count", type: "number", description: "" },
        ],
        value: { "the term": "blossom <b>" },
        selection: "blossoms",
        targetCode: "cmn",
        status: "streaming",
      }),
    )

    expect(html).toBe(
      "blossom &lt;b&gt;|blossoms|Simplified Mandarin Chinese|streaming|t:blossom &lt;b&gt;:false;n::true;",
    )
  })

  // The words come from the i18n mock, tagged with the locale they were asked in.
  it.each([
    ["cmn", "zh-CN"],
    ["cmn-Hant", "zh-TW"],
    ["jpn", "ja"],
    ["eng", "en"],
    // No words in French: the UI language's (the mock's is en).
    ["fra", "en"],
  ] as const)("puts the card's words in ctx in the language of %s", (targetCode, locale) => {
    const compiled = compileLayout(
      "{{ ctx.sentenceAnalysisLabels.roles.subject }}|{{ ctx.sentenceAnalysisLabels.forms['present-participle'] }}|{{ ctx.improveWritingLabels.types['word-choice'] }}",
    )
    if (!compiled.ok) throw compiled.error
    const html = renderLayoutHtml(
      compiled.compiled,
      buildCustomActionLayoutScope({
        outputSchema: [],
        value: null,
        selection: "",
        targetCode,
        status: "done",
      }),
    )
    const prefix = "options.selectionToolbar.customActions.templates.sentenceAnalysis"
    const iwPrefix = "options.selectionToolbar.customActions.templates.improveWriting"
    expect(html).toBe(
      `${prefix}.roles.subject@${locale}|${prefix}.forms.presentParticiple@${locale}|${iwPrefix}.types.wordChoice@${locale}`,
    )
  })

  it("flags ctx keys the host does not declare", () => {
    const codes = lintLayout("{{ ctx.side }}", CUSTOM_ACTION_LAYOUT_HOST, []).map(
      (diagnostic) => diagnostic.code,
    )
    expect(codes).toContain("unknownContextKey")
    expect(lintLayout("{{ ctx.selection }}", CUSTOM_ACTION_LAYOUT_HOST, [])).toEqual([])
  })
})
