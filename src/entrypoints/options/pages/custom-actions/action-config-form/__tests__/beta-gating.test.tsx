// @vitest-environment jsdom
import type { ReactNode } from "react"
import type { Config } from "@/types/config/config"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { i18n } from "@/utils/i18n"
import { CustomActionConfigForm } from ".."
import { selectedCustomActionIdAtom } from "../../atoms"

vi.mock("@/components/form/quick-insertable-textarea-field-auto-save", () => ({
  QuickInsertableTextareaFieldAutoSave: ({
    label,
    readOnly,
  }: {
    label: string
    readOnly?: boolean
  }) => <div>{`${label}:${readOnly ? "readOnly" : "editable"}`}</div>,
}))

vi.mock("../name-field", () => ({
  NameField: ({ readOnly, labelExtra }: { readOnly: boolean; labelExtra?: ReactNode }) => (
    <div>
      {`NameField:${readOnly ? "readOnly" : "editable"}`}
      {labelExtra}
    </div>
  ),
}))

vi.mock("../icon-field", () => ({
  IconField: ({ readOnly }: { readOnly: boolean }) => (
    <div>{`IconField:${readOnly ? "readOnly" : "editable"}`}</div>
  ),
}))

vi.mock("../provider-field", () => ({
  ProviderField: () => <div>ProviderField</div>,
}))

vi.mock("../output-schema-field", () => ({
  OutputSchemaField: () => <div>OutputSchemaField</div>,
  ReadOnlyOutputSchemaField: () => <div>ReadOnlyOutputSchemaField</div>,
}))

vi.mock("../notebase-connection-field", () => ({
  NotebaseConnectionField: () => (
    <div>
      {i18n.t(
        "options.floatingButtonAndToolbar.selectionToolbar.customActions.form.notebase.title",
      )}
    </div>
  ),
}))

function cloneConfig(config: Config): Config {
  return JSON.parse(JSON.stringify(config)) as Config
}

describe("customActionConfigForm notebase availability", () => {
  it("renders built-in fields read-only and duplicates the complete action", async () => {
    const store = createStore()
    const config = cloneConfig(DEFAULT_CONFIG)
    config.selectionToolbar.builtInActions.dictionary.notebaseConnection = {
      notebaseId: "table-1",
      notebaseNameSnapshot: "Dictionary",
      connectedAccount: {
        id: "user-1",
        name: "Reader",
        email: "reader@example.com",
        image: null,
      },
      mappings: [],
    }
    store.set(configAtom, config)

    render(
      <Provider store={store}>
        <TooltipProvider>
          <CustomActionConfigForm />
        </TooltipProvider>
      </Provider>,
    )

    expect(screen.getByText("NameField:readOnly")).toBeInTheDocument()
    expect(screen.getByText("IconField:readOnly")).toBeInTheDocument()
    expect(screen.queryByText("OutputSchemaField")).not.toBeInTheDocument()
    expect(screen.getByText("ReadOnlyOutputSchemaField")).toBeInTheDocument()
    expect(screen.getByText("ProviderField")).toBeInTheDocument()
    expect(
      screen.queryByText(
        i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.delete"),
      ),
    ).not.toBeInTheDocument()

    expect(
      screen.queryByRole("button", { name: i18n.t("options.apiProviders.form.duplicate") }),
    ).not.toBeInTheDocument()

    const customizeButton = screen.getByRole("button", {
      name: i18n.t(
        "options.floatingButtonAndToolbar.selectionToolbar.customActions.form.customize",
      ),
    })
    fireEvent.click(customizeButton)

    await waitFor(() => {
      expect(store.get(configAtom).selectionToolbar.customActions).toHaveLength(1)
    })
    const duplicated = store.get(configAtom).selectionToolbar.customActions[0]!
    expect(duplicated).toMatchObject({
      enabled: true,
      providerId: config.selectionToolbar.builtInActions.dictionary.providerId,
      notebaseConnection: config.selectionToolbar.builtInActions.dictionary.notebaseConnection,
    })
    expect(duplicated.id).not.toBe("default-dictionary")
  })

  it("explains that customizing creates an editable built-in action copy", async () => {
    const store = createStore()
    store.set(configAtom, cloneConfig(DEFAULT_CONFIG))

    render(
      <Provider store={store}>
        <TooltipProvider>
          <CustomActionConfigForm />
        </TooltipProvider>
      </Provider>,
    )

    const customizeButton = screen.getByRole("button", {
      name: i18n.t(
        "options.floatingButtonAndToolbar.selectionToolbar.customActions.form.customize",
      ),
    })
    fireEvent.mouseEnter(customizeButton)
    fireEvent.focus(customizeButton)

    await waitFor(() =>
      expect(document.querySelector("[data-slot='tooltip-content']")).toHaveTextContent(
        i18n.t(
          "options.floatingButtonAndToolbar.selectionToolbar.customActions.form.customizeTooltip",
        ),
      ),
    )
  })

  it("shows the notebase connection field when beta experience is disabled", () => {
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
          notebaseId: "table-1",
          notebaseNameSnapshot: "Articles",
          connectedAccount: {
            id: "user-1",
            name: "Reader",
            email: "reader@example.com",
            image: null,
          },
          mappings: [],
        },
      },
    ]

    store.set(configAtom, config)
    store.set(selectedCustomActionIdAtom, "action-1")

    render(
      <Provider store={store}>
        <CustomActionConfigForm />
      </Provider>,
    )

    expect(
      screen.getByText(
        i18n.t(
          "options.floatingButtonAndToolbar.selectionToolbar.customActions.form.notebase.title",
        ),
      ),
    ).toBeInTheDocument()
  })

  it("duplicates a custom action with its mutable state and connection", async () => {
    const store = createStore()
    const config = cloneConfig(DEFAULT_CONFIG)
    const action = {
      id: "action-1",
      name: "Summarize",
      icon: "tabler:sparkles",
      enabled: false,
      providerId: config.selectionToolbar.builtInActions.dictionary.providerId,
      systemPrompt: "You are helpful.",
      prompt: "Summarize the selected text.",
      outputSchema: [
        {
          id: "summary-field",
          name: "summary",
          type: "string" as const,
          description: "Summary",
          speaking: false,
        },
      ],
      notebaseConnection: {
        notebaseId: "table-1",
        notebaseNameSnapshot: "Articles",
        connectedAccount: {
          id: "user-1",
          name: "Reader",
          email: "reader@example.com",
          image: null,
        },
        mappings: [],
      },
    }
    config.selectionToolbar.customActions = [action]
    store.set(configAtom, config)
    store.set(selectedCustomActionIdAtom, action.id)

    render(
      <Provider store={store}>
        <CustomActionConfigForm />
      </Provider>,
    )

    expect(screen.getByText("NameField:editable")).toBeInTheDocument()
    expect(screen.getByText("OutputSchemaField")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: i18n.t(
          "options.floatingButtonAndToolbar.selectionToolbar.customActions.form.customize",
        ),
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.delete"),
      }),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("options.apiProviders.form.duplicate") }),
    )

    await waitFor(() => {
      expect(store.get(configAtom).selectionToolbar.customActions).toHaveLength(2)
    })
    const duplicate = store.get(configAtom).selectionToolbar.customActions[1]!
    expect(duplicate).toEqual({
      ...action,
      id: expect.any(String),
      name: "Summarize 1",
    })
    expect(duplicate.id).not.toBe(action.id)
    expect(duplicate.notebaseConnection).not.toBe(action.notebaseConnection)
  })
})
