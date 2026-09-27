import { compileLayout } from "@read-frog/layout-engine/core"
import { lintLayout } from "@read-frog/layout-engine/editor"
import { DEFAULT_LAYOUT } from "@read-frog/layout-engine/presets"
import { describe, expect, it } from "vitest"
import { selectionToolbarCustomActionsSchema } from "@/types/config/selection-toolbar"
import { CUSTOM_ACTION_LAYOUT_HOST } from "@/utils/layout-host/host"
import {
  buildDictionaryActionLayout,
  buildSentenceAnalysisActionLayout,
} from "@/utils/layout-host/slots"
import {
  CUSTOM_ACTION_TEMPLATES,
  getSentenceAnalysisLayoutLabels,
} from "../custom-action-templates"

function createFromTemplate(id: string) {
  const template = CUSTOM_ACTION_TEMPLATES.find((candidate) => candidate.id === id)
  if (!template) throw new Error(`missing template ${id}`)
  return template.createAction("openai-default")
}

describe("custom action template layouts", () => {
  it.each(["improve-writing", "blank"])("gives %s the default field list", (id) => {
    expect(createFromTemplate(id).layout).toBe(DEFAULT_LAYOUT)
  })

  it("gives the dictionary preset the card built for its own fields", () => {
    const action = createFromTemplate("dictionary")

    expect(action.layout).toEqual(expect.any(String))
    expect(action.layout).toBe(buildDictionaryActionLayout(action.outputSchema))
    expect(action.layout).not.toBe(DEFAULT_LAYOUT)
  })

  it("gives the sentence analysis preset its card, built for its three stable fields", () => {
    const action = createFromTemplate("sentence-analysis")

    expect(action.icon).toBe("tabler:highlight")
    expect(action.outputSchema.map((field) => [field.id, field.type])).toEqual([
      ["sentence-analysis-annotations", "string"],
      ["sentence-analysis-translation", "string"],
      ["sentence-analysis-structure", "string"],
    ])
    // i18n is mocked to return the key, so this checks the wiring, not the text.
    const prefix = "options.selectionToolbar.customActions.templates.sentenceAnalysis"
    expect(action.outputSchema[0]).toMatchObject({
      name: `${prefix}.fieldAnnotations`,
      description: `${prefix}.fieldAnnotationsDescription`,
    })
    expect(action.systemPrompt).toBe(`${prefix}.systemPrompt`)
    expect(action.layout).toBe(
      buildSentenceAnalysisActionLayout(action.outputSchema, getSentenceAnalysisLayoutLabels()),
    )
    expect(action.layout).not.toBe(DEFAULT_LAYOUT)

    const layout = action.layout ?? ""
    expect(compileLayout(layout).ok).toBe(true)
    const diagnostics = lintLayout(layout, CUSTOM_ACTION_LAYOUT_HOST, action.outputSchema)
    expect(diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([])
  })

  it("creates schema-valid actions", () => {
    const actions = CUSTOM_ACTION_TEMPLATES.map((template) =>
      template.createAction("openai-default"),
    )

    expect(selectionToolbarCustomActionsSchema.safeParse(actions).success).toBe(true)
  })
})
