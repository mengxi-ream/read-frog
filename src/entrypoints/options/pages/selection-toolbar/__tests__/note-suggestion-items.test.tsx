// @vitest-environment jsdom

import type { ReactNode } from "react"
import type { Config } from "@/types/config/config"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { getBuiltInDictionaryAction } from "@/utils/custom-actions"
import { NoteSuggestionItems } from "../actions/note-suggestion-items"

const {
  selectionToolbarAtom,
  setSelectionToolbarMock,
  setProviderIdMock,
  useFeatureProviderMock,
  testState,
} = vi.hoisted(() => ({
  selectionToolbarAtom: {},
  setSelectionToolbarMock: vi.fn<(value: Config["selectionToolbar"]) => Promise<void>>(),
  setProviderIdMock: vi.fn<(providerId: string) => void>(),
  useFeatureProviderMock: vi.fn<(featureKey: string) => unknown>(),
  testState: {
    selectionToolbar: null as Config["selectionToolbar"] | null,
  },
}))

vi.mock("jotai", () => ({
  useAtom: (atom: object) => {
    if (atom !== selectionToolbarAtom || !testState.selectionToolbar) {
      throw new Error("Unexpected atom")
    }
    return [testState.selectionToolbar, setSelectionToolbarMock]
  },
}))

vi.mock("@/utils/atoms/config", () => ({
  configFieldsAtomMap: {
    selectionToolbar: selectionToolbarAtom,
  },
}))

// Keep the render shallow: the suggestion provider row only needs to prove it
// is wired to the noteSuggestion feature binding, not the dropdown internals.
vi.mock("@/components/llm-providers/use-feature-providers", () => ({
  useFeatureProvider: (featureKey: string) => useFeatureProviderMock(featureKey),
}))

vi.mock("@/components/llm-providers/provider-selector", () => ({
  default: ({ value, onChange }: { value: string; onChange: (id: string) => void }) => (
    <button
      type="button"
      data-testid="note-suggestion-provider-selector"
      onClick={() => onChange("picked-provider")}
    >
      {value}
    </button>
  ),
}))

vi.mock("@/components/ui/base-ui/select", async () => {
  const { createContext, useContext } = await import("react")
  const SelectContext = createContext<((value: string) => void) | null>(null)

  return {
    Select: ({
      children,
      onValueChange,
    }: {
      children: ReactNode
      value: string
      onValueChange: (value: string) => void
    }) => (
      <SelectContext.Provider value={onValueChange}>
        <div>{children}</div>
      </SelectContext.Provider>
    ),
    // `size` is the trigger's own prop, not an attribute a button understands.
    SelectTrigger: ({
      children,
      size: _size,
      ...props
    }: {
      children: ReactNode
      size?: string
      className?: string
      "aria-label"?: string
    }) => (
      <button type="button" role="combobox" {...props}>
        {children}
      </button>
    ),
    SelectValue: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children, value }: { children: ReactNode; value: string }) => {
      const context = useContext(SelectContext)
      if (!context) {
        throw new Error("SelectItem must be rendered inside Select")
      }
      return (
        <button type="button" role="option" aria-selected={false} onClick={() => context(value)}>
          {children}
        </button>
      )
    },
  }
})

function createCustomAction(
  id: string,
  name: string,
  enabled: boolean,
): SelectionToolbarCustomAction {
  const selectionToolbar = testState.selectionToolbar
  if (!selectionToolbar) {
    throw new Error("Expected selection toolbar test state")
  }

  return {
    id,
    name,
    enabled,
    icon: "tabler:sparkles",
    providerId: selectionToolbar.builtInActions.dictionary.providerId,
    systemPrompt: "System prompt",
    prompt: "Prompt",
    outputSchema: [
      {
        id: `${id}-result`,
        name: "result",
        type: "string",
        description: "Result",
        speaking: false,
      },
    ],
  }
}

describe("NoteSuggestionItems", () => {
  beforeEach(() => {
    testState.selectionToolbar = structuredClone(DEFAULT_CONFIG.selectionToolbar)
    setSelectionToolbarMock.mockReset()
    setSelectionToolbarMock.mockResolvedValue()
    setProviderIdMock.mockReset()
    useFeatureProviderMock.mockReset()
    useFeatureProviderMock.mockReturnValue({
      providers: [],
      providerId: DEFAULT_CONFIG.selectionToolbar.noteSuggestion.providerId,
      providerConfig: null,
      setProviderId: setProviderIdMock,
    })
  })

  it("lists the built-in action first and keeps disabled custom actions selectable", () => {
    const selectionToolbar = testState.selectionToolbar!
    const disabledAction = createCustomAction("disabled-action", "Disabled Action", false)
    const enabledAction = createCustomAction("enabled-action", "Enabled Action", true)
    selectionToolbar.customActions = [disabledAction, enabledAction]
    selectionToolbar.noteSuggestion = {
      ...selectionToolbar.noteSuggestion,
      enabled: false,
      actionId: disabledAction.id,
    }

    render(<NoteSuggestionItems />)

    const builtInAction = getBuiltInDictionaryAction(selectionToolbar)
    const options = screen.getAllByRole("option")
    expect(options.map((option) => option.textContent)).toEqual([
      builtInAction.name,
      disabledAction.name,
      enabledAction.name,
    ])

    const selector = screen.getByRole("combobox", {
      name: "options.selectionToolbar.actions.noteSuggestion.action",
    })
    expect(selector).toHaveTextContent(disabledAction.name)
    expect(selector).toBeEnabled()
    expect(screen.getByRole("switch")).not.toBeChecked()

    fireEvent.click(options[2]!)

    expect(setSelectionToolbarMock).toHaveBeenCalledWith({
      ...selectionToolbar,
      noteSuggestion: {
        ...selectionToolbar.noteSuggestion,
        actionId: enabledAction.id,
      },
    })
  })

  it("renders the configured built-in action without writing during render", () => {
    const selectionToolbar = testState.selectionToolbar!
    selectionToolbar.customActions = [createCustomAction("action-1", "Custom Action", true)]
    selectionToolbar.noteSuggestion.actionId = "default-dictionary"

    render(<NoteSuggestionItems />)

    expect(
      screen.getByRole("combobox", {
        name: "options.selectionToolbar.actions.noteSuggestion.action",
      }),
    ).toHaveTextContent(getBuiltInDictionaryAction(selectionToolbar).name)
    expect(setSelectionToolbarMock).not.toHaveBeenCalled()
  })

  it("preserves the existing enable switch and the selected action when toggled", () => {
    const selectionToolbar = testState.selectionToolbar!
    const action = createCustomAction("action-1", "Custom Action", true)
    selectionToolbar.customActions = [action]
    selectionToolbar.noteSuggestion.actionId = action.id

    render(<NoteSuggestionItems />)

    fireEvent.click(screen.getByRole("switch"))

    expect(setSelectionToolbarMock).toHaveBeenCalledWith({
      ...selectionToolbar,
      noteSuggestion: {
        ...selectionToolbar.noteSuggestion,
        enabled: false,
      },
    })
  })

  it("renders a provider row bound to the noteSuggestion feature", () => {
    render(<NoteSuggestionItems />)

    expect(useFeatureProviderMock).toHaveBeenCalledWith("noteSuggestion")

    const providerSelector = screen.getByTestId("note-suggestion-provider-selector")
    expect(providerSelector).toHaveTextContent(
      DEFAULT_CONFIG.selectionToolbar.noteSuggestion.providerId,
    )

    fireEvent.click(providerSelector)
    expect(setProviderIdMock).toHaveBeenCalledWith("picked-provider")
    // The provider write goes through the feature binding, not the raw
    // selectionToolbar atom.
    expect(setSelectionToolbarMock).not.toHaveBeenCalled()
  })
})
