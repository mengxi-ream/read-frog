// @vitest-environment jsdom
import type { ReactNode } from "react"
import type { TTSConfig } from "@/types/config/tts"
import type { DetectLanguageOptions } from "@/utils/content/language"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"

const sendMessageMock = vi.fn<(type: string, data?: any) => Promise<any>>()
const detectLanguageMock =
  vi.fn<(text: string, options?: DetectLanguageOptions) => Promise<string>>()
const trackFeatureUsedMock = vi.fn<(properties: any) => Promise<void>>(async () => {})
const toastMock = vi.fn<(options: any) => void>()

vi.mock("@/utils/message", () => ({
  sendMessage: (type: string, data?: any) => sendMessageMock(type, data),
}))
vi.mock("@/utils/content/language", () => ({
  detectLanguage: (text: string, options?: DetectLanguageOptions) =>
    detectLanguageMock(text, options),
}))
vi.mock("@/utils/analytics", () => ({
  createFeatureUsageContext: () => ({}),
  trackFeatureUsed: (properties: any) => trackFeatureUsedMock(properties),
}))
vi.mock("@/components/ui/base-ui/toast", () => ({
  toastManager: { add: (options: any) => toastMock(options) },
}))
// Plain atoms instead of the storage-backed config, so each test sets the providers it needs.
vi.mock("@/utils/atoms/config", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/utils/atoms/config")>()
  const { atom } = await import("jotai")
  return {
    ...original,
    configFieldsAtomMap: {
      ...original.configFieldsAtomMap,
      languageDetection: atom({ mode: "basic" }),
      providersConfig: atom<unknown[]>([]),
    },
  }
})

const { useTextToSpeech } = await import("../use-text-to-speech")
const { configFieldsAtomMap } = await import("@/utils/atoms/config")

const googleProvider = {
  id: "google-tts",
  name: "Gemini",
  enabled: true,
  provider: "google",
  apiKey: "test-key",
  baseURL: "https://gateway.example/v1beta",
  headers: { "cf-aig-authorization": "Bearer gateway-token" },
  model: { model: "gemini-2.5-flash", isCustomModel: false, customModel: null },
}

const geminiTtsConfig = {
  provider: "gemini",
  gemini: {
    providerId: "google-tts",
    model: "gemini-3.8-flash-lite-tts",
    voice: "kore",
    style: "",
  },
  defaultVoice: "en-US-DavisNeural",
  languageVoices: {},
  rate: 0,
  pitch: 0,
  volume: 0,
} as unknown as TTSConfig

const AUDIO = { ok: true, audioBase64: "AAAA", contentType: "audio/wav" }

function renderTextToSpeech() {
  const store = createStore()
  void store.set(configFieldsAtomMap.providersConfig, [googleProvider] as never)
  const queryClient = new QueryClient()
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <Provider store={store}>{children}</Provider>
      </QueryClientProvider>
    )
  }
  return { ...renderHook(() => useTextToSpeech(), { wrapper }), store }
}

function synthesizeCalls() {
  return sendMessageMock.mock.calls.filter(([type]) => type === "geminiTtsSynthesize")
}

function playbackReply(type: string) {
  return type === "ttsPlaybackStart" ? { ok: true } : undefined
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("useTextToSpeech with Gemini", () => {
  it("speaks through the chosen Google provider, headers and all, without detecting the language", async () => {
    sendMessageMock.mockImplementation(async (type) =>
      type === "geminiTtsSynthesize" ? AUDIO : playbackReply(type),
    )
    const { result } = renderTextToSpeech()

    await act(async () => {
      await result.current.play("Hello", geminiTtsConfig)
    })

    expect(synthesizeCalls()).toEqual([
      [
        "geminiTtsSynthesize",
        {
          text: "Hello",
          providerConfig: googleProvider,
          model: "gemini-3.8-flash-lite-tts",
          voice: "kore",
          style: "",
        },
      ],
    ])
    expect(detectLanguageMock).not.toHaveBeenCalled()
  })

  it("asks for the next chunk only once the current one has arrived", async () => {
    const pending: ((value: unknown) => void)[] = []
    sendMessageMock.mockImplementation((type) =>
      type === "geminiTtsSynthesize"
        ? new Promise((resolve) => pending.push(resolve))
        : Promise.resolve(playbackReply(type)),
    )
    const { result } = renderTextToSpeech()

    let run!: Promise<void>
    act(() => {
      run = result.current.play("Hello world. ".repeat(200), geminiTtsConfig)
    })
    await waitFor(() => expect(synthesizeCalls()).toHaveLength(1))

    // Stopped before any audio arrived: only the first chunk was ever requested.
    act(() => {
      result.current.stop()
    })
    pending.forEach((resolve) => resolve(AUDIO))
    await act(async () => {
      await run.catch(() => {})
    })
    expect(synthesizeCalls()).toHaveLength(1)
  })

  it("replays cached audio after edits that cannot change it", async () => {
    sendMessageMock.mockImplementation(async (type) =>
      type === "geminiTtsSynthesize" ? AUDIO : playbackReply(type),
    )
    const { result, store } = renderTextToSpeech()

    await act(async () => {
      await result.current.play("Hello", geminiTtsConfig)
    })
    act(() => {
      void store.set(configFieldsAtomMap.providersConfig, [
        { ...googleProvider, name: "Renamed", temperature: 0.7 },
      ] as never)
    })
    await act(async () => {
      await result.current.play("Hello", { ...geminiTtsConfig, rate: 20 })
    })

    expect(synthesizeCalls()).toHaveLength(1)
  })

  it("blames the network rather than Edge TTS, and reports the reason", async () => {
    sendMessageMock.mockImplementation(async (type) =>
      type === "geminiTtsSynthesize"
        ? { ok: false, error: { code: "NETWORK_ERROR", message: "Failed to fetch" } }
        : playbackReply(type),
    )
    const { result } = renderTextToSpeech()

    await act(async () => {
      await expect(result.current.play("Hello", geminiTtsConfig)).rejects.toThrow("Failed to fetch")
    })

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Gemini TTS is temporarily unavailable. Please check your network and retry.",
      }),
    )
    expect(trackFeatureUsedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "failure",
        failure_reason: "network",
        provider: "google",
        backend_kind: "llm",
      }),
    )
  })

  it("asks for a Google provider when the chosen one is gone", async () => {
    const { result } = renderTextToSpeech()
    const withoutProvider = {
      ...geminiTtsConfig,
      gemini: { ...geminiTtsConfig.gemini, providerId: "google-gone" },
    }

    await act(async () => {
      await expect(result.current.play("Hello", withoutProvider)).rejects.toThrow(
        "MISSING_PROVIDER",
      )
    })

    expect(synthesizeCalls()).toHaveLength(0)
    expect(trackFeatureUsedMock).toHaveBeenCalledWith(
      expect.objectContaining({ failure_reason: "precheck" }),
    )
  })
})
