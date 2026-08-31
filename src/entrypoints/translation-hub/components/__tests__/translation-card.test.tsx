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
  ttsConfigMock,
} = vi.hoisted(() => ({
  anchoredToastAddMock: vi.fn<(options: unknown) => void>(),
  clipboardWriteMock: vi.fn<(text: string) => void>(),
  languageAtom: {},
  providersAtom: {},
  requestAtom: {},
  selectedProviderIdsAtom: {},
  ttsAtom: {},
  ttsConfigMock: {
    defaultVoice: "en-US-AriaNeural",
    languageVoices: {},
    rate: 0,
    pitch: 0,
    volume: 0,
  },
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

interface UseTextToSpeechMockShape {
  play: (text: string, ttsConfig: unknown) => void
  stop: () => void
  isFetching: boolean
  isPlaying: boolean
}

const useTTSMock = vi.hoisted(() => {
  const initial: UseTextToSpeechMockShape = {
    play: vi.fn<(text: string, ttsConfig: unknown) => void>(),
    stop: vi.fn<() => void>(),
    isFetching: false,
    isPlaying: false,
  }
  return { current: initial }
})

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => useMutationMock.current,
}))

vi.mock("@/hooks/use-text-to-speech", () => ({
  useTextToSpeech: () => useTTSMock.current,
}))

vi.mock("jotai", () => ({
  useAtom: () => [["provider-1"], vi.fn<(value: unknown) => void>()],
  useAtomValue: (atom: object) => {
    if (atom === requestAtom) return null
    if (atom === languageAtom) return { level: "intermediate" }
    if (atom === providersAtom) return []
    if (atom === ttsAtom) return ttsConfigMock
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
    tts: ttsAtom,
  },
}))

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

beforeEach(() => {
  useTTSMock.current = {
    play: vi.fn<(text: string, ttsConfig: unknown) => void>(),
    stop: vi.fn<() => void>(),
    isFetching: false,
    isPlaying: false,
  }
})

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

describe("TranslationCard speak button", () => {
  beforeEach(() => {
    useMutationMock.current = {
      data: "Translated text",
      isError: false,
      isPending: false,
      mutate: vi.fn<(request: unknown) => void>(),
      error: undefined,
    }
  })

  it("plays the card's translated text through TTS when clicked", () => {
    render(
      <TranslationCard
        providerId="provider-1"
        isExpanded
        onExpandedChange={vi.fn<(expanded: boolean) => void>()}
      />,
    )

    const speakButton = screen.getByTitle("translationHub.speakTranslation")
    expect(speakButton.querySelector('[data-icon="tabler:volume"]')).not.toBeNull()

    fireEvent.click(speakButton)

    expect(useTTSMock.current.play).toHaveBeenCalledWith("Translated text", ttsConfigMock)
    expect(useTTSMock.current.stop).not.toHaveBeenCalled()
  })

  it("shows a stop icon and stops playback when clicked while playing", () => {
    useTTSMock.current = { ...useTTSMock.current, isPlaying: true }

    render(
      <TranslationCard
        providerId="provider-1"
        isExpanded
        onExpandedChange={vi.fn<(expanded: boolean) => void>()}
      />,
    )

    const speakButton = screen.getByTitle("action.playing")
    expect(speakButton.querySelector('[data-icon="tabler:player-stop-filled"]')).not.toBeNull()

    fireEvent.click(speakButton)

    expect(useTTSMock.current.stop).toHaveBeenCalledTimes(1)
    expect(useTTSMock.current.play).not.toHaveBeenCalled()
  })

  it("shows a spinning loader while fetching audio and stops when clicked", () => {
    useTTSMock.current = { ...useTTSMock.current, isFetching: true }

    render(
      <TranslationCard
        providerId="provider-1"
        isExpanded
        onExpandedChange={vi.fn<(expanded: boolean) => void>()}
      />,
    )

    const speakButton = screen.getByTitle("speak.fetchingAudio")
    const loaderIcon = speakButton.querySelector('[data-icon="tabler:loader-2"]')
    expect(loaderIcon).not.toBeNull()
    expect(loaderIcon?.className).toContain("animate-spin")

    fireEvent.click(speakButton)

    expect(useTTSMock.current.stop).toHaveBeenCalledTimes(1)
    expect(useTTSMock.current.play).not.toHaveBeenCalled()
  })

  it("hides the speak button when the card has no translated text", () => {
    useMutationMock.current = {
      data: undefined,
      isError: false,
      isPending: false,
      mutate: vi.fn<(request: unknown) => void>(),
      error: undefined,
    }

    render(
      <TranslationCard
        providerId="provider-1"
        isExpanded
        onExpandedChange={vi.fn<(expanded: boolean) => void>()}
      />,
    )

    expect(screen.queryByTitle("translationHub.speakTranslation")).toBeNull()
  })
})
