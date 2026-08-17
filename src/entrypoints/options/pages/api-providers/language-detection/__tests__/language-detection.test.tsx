// @vitest-environment jsdom

import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import { render, screen } from "@testing-library/react"
import { Provider, createStore } from "jotai"
import { describe, expect, it, vi } from "vitest"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { LanguageDetectionConfig } from ".."

vi.mock("@/utils/atoms/config", async () => {
  const { atom } = await vi.importActual<typeof import("jotai")>("jotai")
  return {
    configFieldsAtomMap: {
      languageDetection: atom({ mode: "basic" as const, providerId: undefined }),
      providersConfig: atom([]),
    },
  }
})

vi.mock("@/components/llm-providers/provider-selector", () => ({
  default: ({ value }: { value: string }) => <div data-testid="provider-selector">{value}</div>,
}))

vi.mock("@/components/llm-providers/use-hosted-ai-provider-options", () => ({
  useHostedAiProviderOptions: (
    _capability: string,
    providers: ProviderSelectorOption[],
  ): ProviderSelectorOption[] =>
    providers.map((provider) =>
      "kind" in provider && provider.kind === "system" ? { ...provider, disabled: true } : provider,
    ),
}))

vi.mock("@/components/llm-providers/use-hosted-ai-status", () => ({
  useHostedAiStatus: () => ({
    status: undefined,
    isSignedIn: false,
    isPending: false,
    isError: false,
  }),
}))

const localProvider = structuredClone(DEFAULT_PROVIDER_CONFIG.openai)

function renderLanguageDetection(mode: "basic" | "llm") {
  const store = createStore()
  void store.set(configFieldsAtomMap.providersConfig, [localProvider])
  void store.set(
    configFieldsAtomMap.languageDetection,
    mode === "llm" ? { mode, providerId: localProvider.id } : { mode },
  )

  return render(
    <Provider store={store}>
      <LanguageDetectionConfig />
    </Provider>,
  )
}

describe("LanguageDetectionConfig", () => {
  it("enables LLM mode when a local LLM is the only usable provider", () => {
    renderLanguageDetection("basic")

    expect(
      screen.getByRole("radio", {
        name: "options.apiProviders.languageDetection.mode.llm",
      }),
    ).toBeEnabled()
    expect(
      screen.getByText("options.apiProviders.languageDetection.status.basicRecommend"),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("options.apiProviders.languageDetection.status.noProviders"),
    ).not.toBeInTheDocument()
  })

  it("shows LLM detection as enabled for a selected local provider", () => {
    renderLanguageDetection("llm")

    expect(
      screen.getByText("options.apiProviders.languageDetection.status.llmEnabled"),
    ).toBeInTheDocument()
    expect(screen.getByTestId("provider-selector")).toHaveTextContent(localProvider.id)
    expect(
      screen.queryByText("options.apiProviders.languageDetection.status.noProviders"),
    ).not.toBeInTheDocument()
  })
})
