// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { i18n } from "#imports"
import { render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { describe, expect, it, vi } from "vitest"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { CustomActionConfigForm } from ".."

vi.mock("@/components/form/quick-insertable-textarea-field-auto-save", () => ({
  QuickInsertableTextareaFieldAutoSave: ({ label }: { label: string }) => <div>{label}</div>,
}))

vi.mock("../name-field", () => ({
  NameField: () => <div>NameField</div>,
}))

vi.mock("../icon-field", () => ({
  IconField: () => <div>IconField</div>,
}))

vi.mock("../provider-field", () => ({
  ProviderField: () => <div>ProviderField</div>,
}))

vi.mock("../output-schema-field", () => ({
  OutputSchemaField: () => <div>OutputSchemaField</div>,
}))

vi.mock("../notebase-connection-field", () => ({
  NotebaseConnectionField: () => (
    <div>{i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.notebase.title")}</div>
  ),
}))

function cloneConfig(config: Config): Config {
  return JSON.parse(JSON.stringify(config)) as Config
}

describe("customActionConfigForm beta gating", () => {
  it("hides the notebase connection field when beta experience is disabled", () => {
    const store = createStore()
    const config = cloneConfig(DEFAULT_CONFIG)

    config.betaExperience.enabled = false
    config.selectionToolbar.customActions = [
      {
        id: "action-1",
        name: "Summarize",
        icon: "tabler:sparkles",
        providerId: config.providersConfig[0]!.id,
        systemPrompt: "You are helpful.",
        prompt: "Summarize the selected text.",
        outputSchema: [],
        notebaseConnection: {
          tableId: "table-1",
          tableNameSnapshot: "Articles",
          mappings: [],
        },
      },
    ]

    store.set(configAtom, config)

    render(
      <Provider store={store}>
        <CustomActionConfigForm />
      </Provider>,
    )

    expect(
      screen.queryByText(i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.notebase.title")),
    ).not.toBeInTheDocument()
  })
})
