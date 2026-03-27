// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { i18n } from "#imports"
import { render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { describe, expect, it } from "vitest"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { SaveToNotebaseButton } from "../save-to-notebase-button"

function cloneConfig(config: Config): Config {
  return JSON.parse(JSON.stringify(config)) as Config
}

function createAction(): SelectionToolbarCustomAction {
  return {
    id: "action-1",
    name: "Summarize",
    icon: "tabler:sparkles",
    providerId: "provider-1",
    systemPrompt: "system",
    prompt: "prompt",
    outputSchema: [
      {
        id: "field-summary",
        name: "summary",
        type: "string",
        description: "",
        speaking: false,
      },
    ],
    notebaseConnection: {
      tableId: "table-1",
      tableNameSnapshot: "Articles",
      mappings: [],
    },
  }
}

describe("saveToNotebaseButton beta gating", () => {
  it("does not render when beta experience is disabled", () => {
    const store = createStore()
    const config = cloneConfig(DEFAULT_CONFIG)

    config.betaExperience.enabled = false
    store.set(configAtom, config)

    render(
      <Provider store={store}>
        <SaveToNotebaseButton
          action={createAction()}
          isRunning={false}
          result={{ summary: "A short summary" }}
        />
      </Provider>,
    )

    expect(screen.queryByRole("button", { name: i18n.t("action.saveToNotebase") })).not.toBeInTheDocument()
  })
})
