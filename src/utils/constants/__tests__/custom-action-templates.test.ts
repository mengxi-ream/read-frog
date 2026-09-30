import { readFile } from "node:fs/promises"
import { HostedAiStreamStructuredObjectInputSchema } from "@read-frog/api-contract"
import { compileLayout } from "@read-frog/layout-engine/core"
import { lintLayout } from "@read-frog/layout-engine/editor"
import { DEFAULT_LAYOUT } from "@read-frog/layout-engine/presets"
import { describe, expect, it } from "vitest"
import { selectionToolbarCustomActionsSchema } from "@/types/config/selection-toolbar"
import {
  buildSelectionToolbarCustomActionSystemPrompt,
  replaceSelectionToolbarCustomActionPromptTokens,
} from "@/utils/custom-action-prompt"
import { SUPPORTED_UI_LOCALES } from "@/utils/i18n/locales"
import { CUSTOM_ACTION_LAYOUT_HOST } from "@/utils/layout-host/host"
import {
  buildDictionaryActionLayout,
  buildImproveWritingActionLayout,
  buildSentenceAnalysisActionLayout,
} from "@/utils/layout-host/slots"
import { createDefaultDictionaryAction, createDefaultSentenceAnalysisAction } from "../config"
import { getSelectionToolbarCustomActionTokenCellText } from "../custom-action"
import { CUSTOM_ACTION_TEMPLATES } from "../custom-action-templates"

function createFromTemplate(id: string) {
  const template = CUSTOM_ACTION_TEMPLATES.find((candidate) => candidate.id === id)
  if (!template) throw new Error(`missing template ${id}`)
  return template.createAction("openai-default")
}

// A locale's `blank.prompt` block, its indentation removed. i18n is mocked in
// tests, so the text is read from the locale file.
async function readBlankPrompt(locale: string): Promise<string | undefined> {
  const text = await readFile(new URL(`../../../locales/${locale}.yml`, import.meta.url), "utf8")
  const block = /^ {8}blank:\n(?: {10}.*\n)*? {10}prompt: \|-\n((?: {12}.*\n)+)/m.exec(text)?.[1]
  return block?.replace(/^ {12}/gm, "").trimEnd()
}

describe("blank custom action template prompt", () => {
  // New actions default to the Built-in AI, whose contract requires a prompt:
  // an empty one fails the request before it is sent.
  it("gives a new Blank action a request the Built-in AI accepts", () => {
    const action = createFromTemplate("blank")
    const tokens = {
      selection: "serendipity",
      paragraphs: "Finding it was pure serendipity.",
      targetLanguage: "Japanese",
      webTitle: "",
      webUrl: "https://example.com/",
      webContent: "",
    }

    const input = HostedAiStreamStructuredObjectInputSchema.safeParse({
      instructions: buildSelectionToolbarCustomActionSystemPrompt(
        action.systemPrompt,
        tokens,
        action.outputSchema,
      ),
      prompt: replaceSelectionToolbarCustomActionPromptTokens(action.prompt, tokens),
      outputSchema: action.outputSchema.map(({ name, type }) => ({ name, type })),
    })

    expect(input.success).toBe(true)
  })

  it.each(SUPPORTED_UI_LOCALES)(
    "hands the model the selection and its context in %s",
    async (locale) => {
      const prompt = await readBlankPrompt(locale)

      for (const token of ["selection", "paragraphs", "targetLanguage"] as const) {
        expect(prompt).toContain(getSelectionToolbarCustomActionTokenCellText(token))
      }
    },
  )
})

describe("custom action template layouts", () => {
  it("gives the blank template the default field list", () => {
    expect(createFromTemplate("blank").layout).toBe(DEFAULT_LAYOUT)
  })

  it("gives the improve writing preset its card, built for its four stable fields", () => {
    const action = createFromTemplate("improve-writing")

    expect(action.icon).toBe("streamline-color:ai-edit-spark-flat")
    expect(action.outputSchema.map((field) => [field.id, field.type])).toEqual([
      ["improve-writing-setting", "string"],
      ["improve-writing-annotations", "string"],
      ["improve-writing-improved", "string"],
      ["improve-writing-summary", "string"],
    ])
    // i18n is mocked to return the key, so this checks the wiring, not the text.
    const prefix = "options.selectionToolbar.customActions.templates.improveWriting"
    expect(action.outputSchema[1]).toMatchObject({
      name: `${prefix}.fieldAnnotations`,
      description: `${prefix}.fieldAnnotationsDescription`,
    })
    expect(action.systemPrompt).toBe(`${prefix}.systemPrompt`)
    expect(action.prompt).toBe(`${prefix}.prompt`)
    expect(action.layout).toBe(buildImproveWritingActionLayout(action.outputSchema))
    expect(action.layout).not.toBe(DEFAULT_LAYOUT)

    const layout = action.layout ?? ""
    expect(compileLayout(layout).ok).toBe(true)
    const diagnostics = lintLayout(layout, CUSTOM_ACTION_LAYOUT_HOST, action.outputSchema)
    expect(diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([])
  })

  it("gives the dictionary preset the card built for its own fields", () => {
    const action = createFromTemplate("dictionary")

    expect(action.layout).toEqual(expect.any(String))
    expect(action.layout).toBe(buildDictionaryActionLayout(action.outputSchema))
    expect(action.layout).not.toBe(DEFAULT_LAYOUT)
  })

  it("gives the sentence analysis preset its card, built for its two stable fields", () => {
    const action = createFromTemplate("sentence-analysis")

    expect(action.icon).toBe("streamline-color:search-visual-flat")
    expect(action.outputSchema.map((field) => [field.id, field.type])).toEqual([
      ["sentence-analysis-annotations", "string"],
      ["sentence-analysis-translation", "string"],
    ])
    // i18n is mocked to return the key, so this checks the wiring, not the text.
    const prefix = "options.selectionToolbar.customActions.templates.sentenceAnalysis"
    expect(action.outputSchema[0]).toMatchObject({
      name: `${prefix}.fieldAnnotations`,
      description: `${prefix}.fieldAnnotationsDescription`,
    })
    expect(action.systemPrompt).toBe(`${prefix}.systemPrompt`)
    expect(action.layout).toBe(buildSentenceAnalysisActionLayout(action.outputSchema))
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

  it.each([
    ["dictionary", createDefaultDictionaryAction, "default-dictionary"],
    ["sentence-analysis", createDefaultSentenceAnalysisAction, "default-sentence-analysis"],
  ] as const)(
    "builds the built-in %s from its preset, with default- field ids and a card for them",
    (templateId, createBuiltIn, actionId) => {
      const preset = createFromTemplate(templateId)
      const builtIn = createBuiltIn()

      expect(builtIn.id).toBe(actionId)
      expect(builtIn.providerId).toBe("read-frog-free-ai")
      expect(builtIn.systemPrompt).toBe(preset.systemPrompt)
      expect(builtIn.outputSchema.map((field) => field.id)).toEqual(
        preset.outputSchema.map((field) => `default-${field.id}`),
      )
      expect(builtIn.layout).not.toBe(preset.layout)
      expect(builtIn.layout).toBe(
        templateId === "dictionary"
          ? buildDictionaryActionLayout(builtIn.outputSchema)
          : buildSentenceAnalysisActionLayout(builtIn.outputSchema),
      )
      // Built once per field set: every read gets the same string.
      expect(createBuiltIn().layout).toBe(builtIn.layout)
    },
  )
})
