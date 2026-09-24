// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TranslationCard } from "@/entrypoints/translation-hub/components/translation-card"

const {
  anchoredToastAddMock,
  clipboardWriteMock,
  languageAtom,
  providersAtom,
  requestAtom,
  selectedProviderIdsAtom,
  translateTextCoreMock,
  providerRefState,
  mutationFnState,
} = vi.hoisted(() => ({
  anchoredToastAddMock: vi.fn<(options: unknown) => void>(),
  clipboardWriteMock: vi.fn<(text: string) => void>(),
  languageAtom: {},
  providersAtom: {},
  requestAtom: {},
  selectedProviderIdsAtom: {},
  translateTextCoreMock: vi.fn<() => Promise<string>>(),
  providerRefState: { kind: "local" },
  mutationFnState: { current: null as null | ((request: unknown) => Promise<string | undefined>) },
}))

interface UseMutationMockShape {
  data: string | undefined
  isError: boolean
  isPending: boolean
  mutate: (request: unknown) => void
  error: Error | undefined
}

const useMutationMock = vi.hoisted(() => {
  const initial: UseMutationMockShape = {
    data: "Translated text",
    isError: false,
    isPending: false,
    mutate: vi.fn<(request: unknown) => void>(),
    error: undefined,
  }
  return { current: initial }
})

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: { mutationFn: (request: unknown) => Promise<string | undefined> }) => {
    mutationFnState.current = options.mutationFn
    return useMutationMock.current
  },
}))

vi.mock("jotai", () => ({
  useAtom: () => [["provider-1"], vi.fn<(value: unknown) => void>()],
  useAtomValue: (atom: object) => {
    if (atom === requestAtom) return null
    if (atom === languageAtom) return { level: "intermediate" }
    if (atom === providersAtom) return []
    return undefined
  },
  useSetAtom: () => vi.fn<(value: unknown) => void>(),
}))

vi.mock("@/components/provider-icon", () => ({
  default: () => <span>Provider icon</span>,
}))

vi.mock("@/components/providers/theme-provider", () => ({
  useTheme: () => ({ theme: "light" }),
}))

vi.mock("@/components/ui/base-ui/toast", () => ({
  anchoredToastManager: { add: anchoredToastAddMock },
}))

vi.mock("@/utils/atoms/config", () => ({
  configFieldsAtomMap: {
    language: languageAtom,
    providersConfig: providersAtom,
  },
}))

vi.mock("@/utils/config/helpers", () => ({
  getProviderConfigById: () => ({ id: "provider-1", name: "OpenAI", provider: "openai" }),
}))

vi.mock("@/utils/providers/provider-registry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/providers/provider-registry")>()),
  BUILT_IN_AI_PROVIDER_LOGO: "built-in-logo",
  resolveProviderRefForCapability: () =>
    providerRefState.kind === "system"
      ? { kind: "system", id: "read-frog-free-ai", name: "Built-in AI", modelTier: "normal" }
      : {
          kind: "local",
          id: "provider-1",
          name: "OpenAI",
          config: { id: "provider-1", name: "OpenAI", provider: "openai" },
        },
}))

vi.mock("@/utils/host/translate/translate-text", () => ({
  translateTextCore: translateTextCoreMock,
}))

vi.mock("@/utils/i18n", () => ({
  i18n: { t: (key: string) => key },
}))

vi.mock("@/entrypoints/translation-hub/atoms", () => ({
  selectedProviderIdsAtom,
  translateRequestAtom: requestAtom,
  translationCardExpandedStateAtom: {},
}))

describe("TranslationCard copy feedback", () => {
  beforeEach(() => {
    providerRefState.kind = "local"
    anchoredToastAddMock.mockReset()
    clipboardWriteMock.mockReset()
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteMock },
    })
    useMutationMock.current = {
      data: "Translated text",
      isError: false,
      isPending: false,
      mutate: vi.fn<(request: unknown) => void>(),
      error: undefined,
    }
  })

  it("anchors provider-specific copy feedback to the copy button", () => {
    render(
      <TranslationCard
        providerId="provider-1"
        isExpanded
        onExpandedChange={vi.fn<(expanded: boolean) => void>()}
      />,
    )

    const copyButton = screen.getByTitle("translationHub.copyTranslation")
    fireEvent.click(copyButton)

    expect(clipboardWriteMock).toHaveBeenCalledWith("Translated text")
    expect(anchoredToastAddMock).toHaveBeenCalledWith({
      data: { tooltipStyle: true },
      id: "translation-copy-provider-1",
      positionerProps: { anchor: copyButton, sideOffset: 6 },
      title: "translationHub.copiedToClipboard",
    })
  })
})

describe("TranslationCard built-in translation", () => {
  it("routes built-in AI through the hosted page translation pipeline", async () => {
    providerRefState.kind = "system"
    translateTextCoreMock.mockResolvedValueOnce("Translated by built-in AI")
    render(
      <TranslationCard
        providerId="read-frog-free-ai"
        isExpanded
        onExpandedChange={vi.fn<(expanded: boolean) => void>()}
      />,
    )

    const result = await mutationFnState.current!({
      inputText: "Hello",
      sourceLanguage: "eng",
      targetLanguage: "cmn",
      timestamp: 1,
    })

    expect(result).toBe("Translated by built-in AI")
    expect(translateTextCoreMock).toHaveBeenCalledWith({
      text: "Hello",
      langConfig: { sourceCode: "eng", targetCode: "cmn", level: "intermediate" },
      providerConfig: {
        kind: "system",
        id: "read-frog-free-ai",
        name: "Built-in AI",
        modelTier: "normal",
      },
      hostedFeature: "pageTranslation",
      preserveLineBreaks: true,
    })
  })
})

describe("TranslationCard error display", () => {
  beforeEach(() => {
    providerRefState.kind = "local"
    useMutationMock.current = {
      data: undefined,
      isError: true,
      isPending: false,
      mutate: vi.fn<(request: unknown) => void>(),
      error: new Error(
        "upstream_429_rate_limit_exceeded_for_provider_openai_completions_with_a_very_long_unbroken_token_stream_that_overflows_the_card_boundary",
      ),
    }
  })

  it("renders long unbroken error messages with overflow-wrap so they stay inside the card", () => {
    render(
      <TranslationCard
        providerId="provider-1"
        isExpanded
        onExpandedChange={vi.fn<(expanded: boolean) => void>()}
      />,
    )

    const errorParagraph = screen.getByText(
      "upstream_429_rate_limit_exceeded_for_provider_openai_completions_with_a_very_long_unbroken_token_stream_that_overflows_the_card_boundary",
    )
    // break-words forces long unbreakable runs to wrap instead of overflowing
    expect(errorParagraph.className).toContain("break-words")
    // whitespace-pre-wrap preserves newlines in multi-line provider errors
    expect(errorParagraph.className).toContain("whitespace-pre-wrap")
  })
})
