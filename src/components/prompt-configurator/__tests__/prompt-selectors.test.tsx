// @vitest-environment jsdom

import type { ReactNode } from "react"
import type { Config } from "@/types/config/config"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import TranslatePromptSelector from "@/entrypoints/popup/components/translate-prompt-selector"
import { PromptSelector as TranslationHubPromptSelector } from "@/entrypoints/translation-hub/components/prompt-selector"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

const { providerAtom, selectedProvidersAtom, setTranslateMock, testState, translateAtom } =
  vi.hoisted(() => ({
    providerAtom: {},
    selectedProvidersAtom: {},
    setTranslateMock: vi.fn<(value: Partial<Config["translate"]>) => Promise<void>>(),
    testState: {
      translate: null as Config["translate"] | null,
    },
    translateAtom: {},
  }))

vi.mock("jotai", () => ({
  useAtom: (atom: object) => {
    if (atom !== translateAtom || !testState.translate) throw new Error("Unexpected atom")
    return [testState.translate, setTranslateMock]
  },
  useAtomValue: (atom: object) => {
    if (atom === providerAtom) return { provider: "mock-llm" }
    if (atom === selectedProvidersAtom) return [{ provider: "mock-llm" }]
    throw new Error("Unexpected atom")
  },
}))

vi.mock("@/utils/atoms/config", () => ({
  configFieldsAtomMap: { translate: translateAtom },
}))

vi.mock("@/utils/atoms/provider", () => ({
  featureProviderConfigAtom: () => providerAtom,
}))

vi.mock("@/entrypoints/translation-hub/atoms", () => ({
  selectedProvidersAtom,
}))

vi.mock("@/types/config/provider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/types/config/provider")>()),
  isLLMProvider: () => true,
}))

vi.mock("@/components/help-tooltip", () => ({
  HelpTooltip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string) =>
      ({
        "options.translation.personalizedPrompts.default": "Default",
        "options.translation.personalizedPrompts.builtInPrompts.precisionRewrite.name":
          "Deep polish",
        "options.translation.personalizedPrompts.builtInPrompts.default.description":
          "Default description",
        "options.translation.personalizedPrompts.builtInPrompts.precisionRewrite.description":
          "Precision description",
      })[key] ?? key,
  },
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
      onValueChange: (value: string) => void
    }) => (
      <SelectContext.Provider value={onValueChange}>
        <div>{children}</div>
      </SelectContext.Provider>
    ),
    SelectTrigger: ({ children }: { children: ReactNode }) => (
      <button type="button" role="combobox">
        {children}
      </button>
    ),
    SelectValue: ({ children }: { children?: ReactNode }) => <>{children}</>,
    SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children, value }: { children: ReactNode; value: string }) => {
      const onValueChange = useContext(SelectContext)
      return (
        <button type="button" role="option" onClick={() => onValueChange?.(value)}>
          {children}
        </button>
      )
    },
  }
})

function createTranslateConfig(): Config["translate"] {
  const translate = structuredClone(DEFAULT_CONFIG.translate)
  translate.customPromptsConfig = {
    promptId: "default",
    patterns: [
      { id: "custom", name: "Custom", systemPrompt: "Custom system", prompt: "Custom prompt" },
    ],
  }
  return translate
}

describe("translation prompt selectors", () => {
  beforeEach(() => {
    testState.translate = createTranslateConfig()
    setTranslateMock.mockReset()
    setTranslateMock.mockResolvedValue()
  })

  it("lists both built-ins before custom prompts in the popup and stores precision directly", () => {
    render(<TranslatePromptSelector />)

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Default",
      "Deep polish",
      "Custom",
    ])

    fireEvent.click(screen.getByRole("option", { name: "Deep polish" }))
    expect(setTranslateMock).toHaveBeenCalledWith({
      customPromptsConfig: {
        ...testState.translate!.customPromptsConfig,
        promptId: "precision-rewrite",
      },
    })
  })

  it("shows the selected built-in and uses the same order in Translation Hub", () => {
    testState.translate!.customPromptsConfig.promptId = "precision-rewrite"
    render(<TranslationHubPromptSelector />)

    expect(screen.getByRole("combobox")).toHaveTextContent("Deep polish")
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Default",
      "Deep polish",
      "Custom",
    ])
  })
})
