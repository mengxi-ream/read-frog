// @vitest-environment jsdom

import type { APIProviderConfig } from "@/types/config/provider"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { describe, expect, it } from "vitest"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { isAPIProviderConfig } from "@/types/config/provider"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { BUILT_IN_DICTIONARY_ACTION_ID } from "@/utils/constants/custom-action"
import { getBuiltInDictionaryAction } from "@/utils/custom-actions"
import {
  BuiltInProviderEditor,
  CustomProviderEditor,
  ProviderEditor,
  useProviderForm,
  useProviderEditor,
} from "../api-providers/provider-editor"
import {
  ActionEditor,
  BuiltInActionEditor,
  CustomActionEditor,
  useActionEditor,
} from "../custom-actions/action-config-form/action-editor"

function ActionContextProbe() {
  useActionEditor()
  return null
}

function ProviderContextProbe() {
  useProviderEditor()
  return null
}

function DeleteActionProbe() {
  const deleteAction = useActionEditor().actions.delete
  if (!deleteAction) {
    throw new Error("Expected custom action delete command")
  }

  return (
    <button type="button" onClick={() => void deleteAction()}>
      Delete action
    </button>
  )
}

function createConfigStore() {
  const store = createStore()
  store.set(configAtom, structuredClone(DEFAULT_CONFIG))
  return store
}

function CustomProviderAssignments({ providerConfig }: { providerConfig: APIProviderConfig }) {
  const form = useProviderForm(providerConfig, async () => {})

  return (
    <CustomProviderEditor.Provider
      providerConfig={providerConfig}
      form={form}
      duplicate={async () => {}}
      delete={async () => {}}
    >
      <ProviderEditor.Assignments defaultOpen>
        <ProviderEditor.CustomActionAssignments />
      </ProviderEditor.Assignments>
    </CustomProviderEditor.Provider>
  )
}

describe("editor compound component contexts", () => {
  it("fails fast when an ActionEditor component is outside its provider", () => {
    expect(() => render(<ActionContextProbe />)).toThrow(
      "ActionEditor components must be rendered inside an ActionEditor Provider",
    )
  })

  it("fails fast when a ProviderEditor component is outside its provider", () => {
    expect(() => render(<ProviderContextProbe />)).toThrow(
      "ProviderEditor components must be rendered inside a ProviderEditor Provider",
    )
  })

  it("fails fast when Delete is composed for a built-in action", () => {
    const store = createConfigStore()
    const action = getBuiltInDictionaryAction(store.get(configAtom).selectionToolbar)

    expect(() =>
      render(
        <Provider store={store}>
          <BuiltInActionEditor.Provider action={action}>
            <ActionEditor.DeleteButton />
          </BuiltInActionEditor.Provider>
        </Provider>,
      ),
    ).toThrow("ActionEditor.delete is unavailable in this composition")
  })

  it("fails fast when Duplicate is composed for the built-in provider", () => {
    const store = createConfigStore()

    expect(() =>
      render(
        <Provider store={store}>
          <BuiltInProviderEditor.Provider>
            <ProviderEditor.DuplicateButton />
          </BuiltInProviderEditor.Provider>
        </Provider>,
      ),
    ).toThrow("ProviderEditor.duplicate is unavailable in this composition")
  })

  it("resets Save Suggestions to Dictionary when deleting its selected custom action", async () => {
    const store = createConfigStore()
    const config = structuredClone(store.get(configAtom))
    const action = {
      id: "save-suggestion-action",
      name: "Save Suggestion Action",
      enabled: false,
      icon: "tabler:sparkles",
      providerId: config.selectionToolbar.builtInActions.dictionary.providerId,
      systemPrompt: "System prompt",
      prompt: "Prompt",
      outputSchema: [
        {
          id: "result",
          name: "result",
          type: "string" as const,
          description: "Result",
          speaking: false,
        },
      ],
    }
    config.selectionToolbar.customActions = [action]
    config.selectionToolbar.saveSuggestion.actionId = action.id
    store.set(configAtom, config)

    render(
      <Provider store={store}>
        <CustomActionEditor.Provider action={action}>
          <DeleteActionProbe />
        </CustomActionEditor.Provider>
      </Provider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Delete action" }))

    await waitFor(() => {
      const selectionToolbar = store.get(configAtom).selectionToolbar
      expect(selectionToolbar.customActions).toEqual([])
      expect(selectionToolbar.saveSuggestion.actionId).toBe(BUILT_IN_DICTIONARY_ACTION_ID)
    })
  })

  it("assigns an action and enables a disabled custom provider through context actions", async () => {
    const store = createConfigStore()
    const config = structuredClone(store.get(configAtom))
    const providerConfig = config.providersConfig.find(
      (provider) => provider.id === "openai-default",
    )
    if (!providerConfig || !isAPIProviderConfig(providerConfig)) {
      throw new Error("Expected the default OpenAI provider")
    }
    config.providersConfig = config.providersConfig.map((provider) =>
      provider.id === providerConfig.id ? { ...provider, enabled: false } : provider,
    )
    store.set(configAtom, config)
    const dictionary = getBuiltInDictionaryAction(config.selectionToolbar)

    render(
      <Provider store={store}>
        <ThemeProvider forcedTheme="light">
          <CustomProviderAssignments providerConfig={{ ...providerConfig, enabled: false }} />
        </ThemeProvider>
      </Provider>,
    )

    const assignmentRow = screen.getByText(dictionary.name).parentElement
    const assignmentSwitch = assignmentRow?.querySelector('[role="switch"]')
    if (!(assignmentSwitch instanceof HTMLElement)) {
      throw new Error("Expected the Dictionary assignment switch")
    }
    fireEvent.click(assignmentSwitch)

    await waitFor(() => {
      const updatedConfig = store.get(configAtom)
      expect(
        updatedConfig.providersConfig.find((provider) => provider.id === providerConfig.id)
          ?.enabled,
      ).toBe(true)
      expect(getBuiltInDictionaryAction(updatedConfig.selectionToolbar).providerId).toBe(
        providerConfig.id,
      )
    })
  })
})
