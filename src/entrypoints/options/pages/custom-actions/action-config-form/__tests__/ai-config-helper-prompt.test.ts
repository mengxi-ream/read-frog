import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { compileLayout, renderLayoutHtml } from "@read-frog/layout-engine/core"
import { lintLayout } from "@read-frog/layout-engine/editor"
import { DEFAULT_LAYOUT } from "@read-frog/layout-engine/presets"
import { describe, expect, it } from "vitest"
import { buildCustomActionLayoutScope, CUSTOM_ACTION_LAYOUT_HOST } from "@/utils/layout-host/host"
import {
  buildAiConfigHelperPrompt,
  EXAMPLE_LAYOUT,
  EXAMPLE_OUTPUT_FIELDS,
} from "../ai-config-helper-prompt"

const EXAMPLE_SCHEMA = EXAMPLE_OUTPUT_FIELDS.map((field) => ({ ...field, id: field.name }))

function renderExample(value: Record<string, unknown> | null, status: "streaming" | "done") {
  const compiled = compileLayout(EXAMPLE_LAYOUT)
  if (!compiled.ok) throw compiled.error
  return renderLayoutHtml(
    compiled.compiled,
    buildCustomActionLayoutScope({
      outputSchema: EXAMPLE_SCHEMA,
      value,
      selection: "The plane will take off soon.",
      targetCode: "eng",
      status,
    }),
  )
}

function createAction(overrides: Partial<SelectionToolbarCustomAction> = {}) {
  return {
    id: "action-1",
    name: "Phrase finder",
    enabled: true,
    icon: "tabler:search",
    providerId: "openai-default",
    systemPrompt: "Find phrases.\n```\nkeep this fence\n```",
    prompt: "Selection: {{selection}}",
    outputSchema: [
      { id: "field-1", name: "Phrases", type: "string", description: "A JSON array." },
      { id: "field-2", name: "Score", type: "number", description: "" },
    ],
    layout: "<p>{{ Phrases }}</p>",
    ...overrides,
  } satisfies SelectionToolbarCustomAction
}

describe("the layout example in the AI config helper prompt", () => {
  it("lints clean against the custom action host", () => {
    expect(lintLayout(EXAMPLE_LAYOUT, CUSTOM_ACTION_LAYOUT_HOST, EXAMPLE_SCHEMA)).toEqual([])
  })

  it("marks the quoted phrases, lists them, and shows the translation", () => {
    const html = renderExample(
      {
        Phrases: '[{"text":"take off","meaning":"to leave the ground"}]',
        Translation: "L'avion va bientôt décoller.",
      },
      "done",
    )

    expect(html).toContain(
      'The plane will <span class="phrase" data-tip="to leave the ground">take off</span> soon.',
    )
    expect(html).toContain("<li><b>take off</b> — to leave the ground</li>")
    expect(html).toContain("L&#39;avion va bientôt décoller.")
  })

  it("renders mid-stream: complete phrases only, and a placeholder for the translation", () => {
    const html = renderExample(
      { Phrases: '[{"text":"take off","meaning":"to leave the ground"},{"text":"so' },
      "streaming",
    )

    expect(html.match(/<li>/g)).toHaveLength(1)
    expect(html).toContain('<p class="translation">…</p>')
  })

  it("renders the bare selection before anything arrives", () => {
    const html = renderExample(null, "streaming")

    expect(html).toContain(
      '<p class="source" data-rf-key="source">The plane will take off soon.</p>',
    )
    expect(html).not.toContain("<ul")
  })
})

describe("buildAiConfigHelperPrompt", () => {
  const input = {
    otherActionNames: ["Explain", "Summarize"],
    uiLocale: "zh-CN",
    targetCode: "cmn",
  } as const

  it("asks the assistant to find out the user's intent before designing anything", () => {
    const prompt = buildAiConfigHelperPrompt({ ...input, action: createAction() })

    expect(prompt).toContain("**Ask first.**")
    expect(prompt).toContain('change the action I have open** ("Phrase finder"')
    expect(prompt).toContain("**create a new action**")
    expect(prompt).toContain("Talk to me in Simplified Mandarin Chinese")
  })

  it("carries the open action's settings, keeping its own fences intact", () => {
    const prompt = buildAiConfigHelperPrompt({ ...input, action: createAction() })

    expect(prompt).toContain("**Name:** `Phrase finder`")
    expect(prompt).toContain("**Icon:** `tabler:search`")
    expect(prompt).toContain("````text\nFind phrases.\n```\nkeep this fence\n```\n````")
    expect(prompt).toContain("```text\nSelection: {{selection}}\n```")
    expect(prompt).toContain(
      "1. Name: `Phrases` · Type: `string` · Description:\n```text\nA JSON array.\n```",
    )
    expect(prompt).toContain("2. Name: `Score` · Type: `number` · Description: (no description)")
    expect(prompt).toContain("```html\n<p>{{ Phrases }}</p>\n```")
    expect(prompt).toContain("named `Explain`, `Summarize`")
  })

  it("shows the default field list for an action without a layout of its own", () => {
    const prompt = buildAiConfigHelperPrompt({
      ...input,
      action: createAction({ layout: undefined, systemPrompt: "", prompt: " " }),
    })

    expect(prompt).toContain(
      `**Layout** (the default field list):\n\`\`\`html\n${DEFAULT_LAYOUT.trimEnd()}\n\`\`\``,
    )
    expect(prompt).toContain("**System prompt:**\n(empty)")
    expect(prompt).toContain("**Prompt:**\n(empty)")
  })

  it("names the Notebase-mapped fields without revealing the connected account", () => {
    const prompt = buildAiConfigHelperPrompt({
      ...input,
      action: createAction({
        notebaseConnection: {
          notebaseId: "notebase-1",
          notebaseNameSnapshot: "Vocabulary",
          connectedAccount: { id: "user-1", name: "Reader", email: "reader@example.com" },
          mappings: [
            {
              id: "mapping-1",
              localFieldId: "field-2",
              notebaseColumnId: "column-1",
              notebaseColumnNameSnapshot: "Score",
            },
          ],
        },
      }),
    })

    expect(prompt).toContain("saves results to a Notebase, from these fields: `Score`")
    expect(prompt).not.toContain("reader@example.com")
    expect(prompt).not.toContain("user-1")
  })

  it("maps the English labels it uses to the interface's, except in English", () => {
    const action = createAction()
    const localized = buildAiConfigHelperPrompt({ ...input, action })
    const english = buildAiConfigHelperPrompt({ ...input, uiLocale: "en", action })

    // The i18n mock returns the key, tagged with the locale for translateIn.
    expect(localized).toContain(
      "- options.selectionToolbar.customActions.form.name@en → options.selectionToolbar.customActions.form.name",
    )
    expect(english).not.toContain("the editor shows these labels")
    expect(english).toContain("Talk to me in English")
  })

  it("names what to click as the editor shows it", () => {
    const action = createAction()
    const localized = buildAiConfigHelperPrompt({ ...input, action })
    const english = buildAiConfigHelperPrompt({ ...input, uiLocale: "en", action })
    const key = "options.selectionToolbar.customActions.form.addField"

    expect(localized).toContain(`In the editor, "${key}" (${key}@en) adds a field`)
    expect(english).toContain(`In the editor, "${key}@en" adds a field`)
  })

  it("names the target language the {{targetLanguage}} token fills in", () => {
    const prompt = buildAiConfigHelperPrompt({ ...input, action: createAction() })

    expect(prompt).toContain(
      '`{{targetLanguage}}`: options.selectionToolbar.customActions.form.tokens.targetLanguage@en (currently "Simplified Mandarin Chinese")',
    )
  })
})
