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
  ttsAtom,
  ttsPlayMock,
  ttsStopMock,
} = vi.hoisted(() => ({
  anchoredToastAddMock: vi.fn<(options: unknown) => void>(),
  clipboardWriteMock: vi.fn<(text: string) => void>(),
  languageAtom: {},
  providersAtom: {},
  requestAtom: {},
  selectedProviderIdsAtom: {},
  ttsAtom: {},
  ttsPlayMock: vi.fn<(text: string, config: object) => Promise<void>>(),
  ttsStopMock: vi.fn<() => void>(),
}))

const ttsState = vi.hoisted(() => ({ isFetching: false, isPlaying: false }))
const ttsConfig = vi.hoisted(() => ({ defaultVoice: "en-US-AriaNeural" }))

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
  useMutation: () => useMutationMock.current,
}))

vi.mock("jotai", () => ({
  useAtom: () => [["provider-1"], vi.fn<(value: unknown) => void>()],
  useAtomValue: (atom: object) => {
    if (atom === requestAtom) return null
    if (atom === languageAtom) return { level: "intermediate" }
    if (atom === ttsAtom) return ttsConfig
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

vi.mock("@/hooks/use-text-to-speech", () => ({
  useTextToSpeech: () => ({
    play: ttsPlayMock,
    stop: ttsStopMock,
    ...ttsState,
  }),
}))

vi.mock("@/utils/atoms/config", () => ({
  configFieldsAtomMap: {
    language: languageAtom,
    tts: ttsAtom,
    providersConfig: providersAtom,
  },
}))

describe("TranslationCard speech", () => {
  beforeEach(() => {
    ttsPlayMock.mockReset().mockResolvedValue(undefined)
    ttsStopMock.mockReset()
    ttsState.isFetching = false
    ttsState.isPlaying = false
    useMutationMock.current = {
      data: "Translated text",
      isError: false,
      isPending: false,
      mutate: vi.fn<(request: unknown) => void>(),
      error: undefined,
    }
  })

  it("plays the card's translated text using the configured voice settings", () => {
    render(
      <TranslationCard
        providerId="provider-1"
        isExpanded
        onExpandedChange={vi.fn<(expanded: boolean) => void>()}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "translationHub.speakTranslation" }))

    expect(ttsPlayMock).toHaveBeenCalledWith("Translated text", ttsConfig)
  })

  it("stops speech while audio is loading or playing", () => {
    ttsState.isFetching = true
    const { rerender } = render(
      <TranslationCard
        providerId="provider-1"
        isExpanded
        onExpandedChange={vi.fn<(expanded: boolean) => void>()}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "speak.fetchingAudio" }))
    ttsState.isFetching = false
    ttsState.isPlaying = true
    rerender(
      <TranslationCard
        providerId="provider-1"
        isExpanded
        onExpandedChange={vi.fn<(expanded: boolean) => void>()}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "action.playing" }))

    expect(ttsStopMock).toHaveBeenCalledTimes(2)
    expect(ttsPlayMock).not.toHaveBeenCalled()
  })

  it("hides speech until a translation succeeds", () => {
    useMutationMock.current.data = undefined
    const { rerender } = render(
      <TranslationCard
        providerId="provider-1"
        isExpanded
        onExpandedChange={vi.fn<(expanded: boolean) => void>()}
      />,
    )

    expect(screen.queryByRole("button", { name: "translationHub.speakTranslation" })).toBeNull()

    useMutationMock.current.data = "Translated text"
    useMutationMock.current.isPending = true
    rerender(
      <TranslationCard
        providerId="provider-1"
        isExpanded
        onExpandedChange={vi.fn<(expanded: boolean) => void>()}
      />,
    )

    expect(screen.queryByRole("button", { name: "translationHub.speakTranslation" })).toBeNull()
  })
})

vi.mock("@/utils/config/helpers", () => ({
  getProviderConfigById: () => ({ id: "provider-1", name: "OpenAI", provider: "openai" }),
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

describe("TranslationCard error display", () => {
  beforeEach(() => {
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
