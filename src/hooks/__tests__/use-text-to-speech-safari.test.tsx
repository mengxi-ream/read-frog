// @vitest-environment jsdom
import type { ReactNode } from "react"
import type { TTSConfig } from "@/types/config/tts"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const sendMessageMock = vi.fn<(type: string, data?: any) => Promise<any>>()
const toastAddMock = vi.fn<(options: unknown) => void>()

vi.mock("@/utils/message", () => ({
  sendMessage: (type: string, data?: any) => sendMessageMock(type, data),
}))
vi.mock("@/utils/content/language", () => ({
  detectLanguage: async () => "eng",
}))
vi.mock("@/utils/analytics", () => ({
  createFeatureUsageContext: () => ({}),
  trackFeatureUsed: vi.fn<() => Promise<void>>(async () => {}),
}))
vi.mock("@/components/ui/base-ui/toast", () => ({
  toastManager: { add: (options: unknown) => toastAddMock(options) },
}))

class FakeSource {
  buffer: unknown = null
  onended: (() => void) | null = null
  connect = vi.fn<(destination: unknown) => void>()
  disconnect = vi.fn<() => void>()
  start = vi.fn<() => void>()
  stop = vi.fn<() => void>()
}

const userActivation = { isActive: false }

/** Like Safari's: a resume() outside a click never settles. */
class FakeAudioContext {
  static instance: FakeAudioContext | undefined

  state: AudioContextState = "suspended"
  destination = {}
  sources: FakeSource[] = []

  constructor() {
    FakeAudioContext.instance = this
  }

  resume = vi.fn<() => Promise<void>>(() => {
    if (!userActivation.isActive) return new Promise<void>(() => {})
    this.state = "running"
    return Promise.resolve()
  })

  decodeAudioData = vi.fn<(data: ArrayBuffer) => Promise<unknown>>(async (data) =>
    new TextDecoder().decode(data),
  )

  createBufferSource = vi.fn<() => FakeSource>(() => {
    const source = new FakeSource()
    this.sources.push(source)
    return source
  })
}

vi.stubGlobal("AudioContext", FakeAudioContext)
Object.defineProperty(navigator, "userActivation", {
  configurable: true,
  get: () => userActivation,
})
// The hook picks its player when it loads.
vi.stubEnv("BROWSER", "safari")
const { useTextToSpeech } = await import("../use-text-to-speech")

const ttsConfig = {
  defaultVoice: "en-US-DavisNeural",
  languageVoices: {},
  rate: 0,
  pitch: 0,
  volume: 0,
} as unknown as TTSConfig

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={createStore()}>{children}</Provider>
    </QueryClientProvider>
  )
}

/** Synthesizes each chunk as audio whose bytes are the chunk's own text. */
function synthesizeChunksAsTheirText() {
  sendMessageMock.mockImplementation(async (type, data) =>
    type === "edgeTtsSynthesize"
      ? { ok: true, audioBase64: btoa(data.text), contentType: "audio/mpeg" }
      : undefined,
  )
}

function sources() {
  return FakeAudioContext.instance?.sources ?? []
}

function playbackMessages() {
  return sendMessageMock.mock.calls.filter(([type]) => type.startsWith("ttsPlayback"))
}

beforeEach(() => {
  // Every test is a page the user has not clicked yet.
  userActivation.isActive = false
  if (FakeAudioContext.instance) FakeAudioContext.instance.state = "suspended"
  synthesizeChunksAsTheirText()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  if (FakeAudioContext.instance) FakeAudioContext.instance.sources = []
})

afterAll(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("useTextToSpeech in Safari", () => {
  it("plays in the page, starting its audio within the click", async () => {
    const { result } = renderHook(() => useTextToSpeech(), { wrapper })

    let run!: Promise<void>
    act(() => {
      userActivation.isActive = true
      run = result.current.play("Hello", ttsConfig)
      // Nothing has been awaited yet.
      expect(FakeAudioContext.instance!.resume).toHaveBeenCalledOnce()
    })
    await waitFor(() => expect(sources()).toHaveLength(1))
    expect(sources()[0]!.buffer).toBe("Hello")
    expect(sources()[0]!.start).toHaveBeenCalledOnce()
    expect(result.current.isPlaying).toBe(true)

    await act(async () => {
      sources()[0]!.onended?.()
      await run
    })
    expect(result.current.isPlaying).toBe(false)
    expect(sendMessageMock).toHaveBeenCalledWith(
      "edgeTtsSynthesize",
      expect.objectContaining({ text: "Hello" }),
    )
    expect(playbackMessages()).toEqual([])
  })

  it("plays every chunk of a long text after one click, and stopping between chunks ends it", async () => {
    const longText = "Hello world. ".repeat(400)
    const { result } = renderHook(() => useTextToSpeech(), { wrapper })

    let run!: Promise<void>
    act(() => {
      userActivation.isActive = true
      run = result.current.play(longText, ttsConfig)
    })
    // The click no longer counts by the time the later chunks play.
    userActivation.isActive = false
    await waitFor(() => expect(sources()).toHaveLength(1))
    expect(result.current.totalChunks).toBeGreaterThan(2)

    act(() => {
      sources()[0]!.onended?.()
    })
    await waitFor(() => expect(sources()).toHaveLength(2))
    expect(sources()[1]!.start).toHaveBeenCalledOnce()

    await act(async () => {
      result.current.stop()
      await run
    })
    expect(sources()[1]!.stop).toHaveBeenCalledOnce()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(sources()).toHaveLength(2)
    expect(result.current.isPlaying).toBe(false)
    expect(playbackMessages()).toEqual([])
  })

  it("lets a reader elsewhere in the page interrupt the one playing", async () => {
    const first = renderHook(() => useTextToSpeech(), { wrapper })
    const second = renderHook(() => useTextToSpeech(), { wrapper })

    let firstRun!: Promise<void>
    act(() => {
      userActivation.isActive = true
      firstRun = first.result.current.play("First", ttsConfig)
    })
    await waitFor(() => expect(sources()).toHaveLength(1))

    let secondRun!: Promise<void>
    act(() => {
      secondRun = second.result.current.play("Second", ttsConfig)
    })
    await act(async () => {
      await firstRun
    })
    expect(sources()[0]!.stop).toHaveBeenCalledOnce()
    expect(first.result.current.isPlaying).toBe(false)

    await waitFor(() => expect(sources()).toHaveLength(2))
    expect(sources()[1]!.buffer).toBe("Second")
    await act(async () => {
      sources()[1]!.onended?.()
      await secondRun
    })
    expect(toastAddMock).not.toHaveBeenCalled()
  })

  it("says why there was no sound when it could not start, unless the run is a quiet one", async () => {
    const { result } = renderHook(() => useTextToSpeech(), { wrapper })

    await act(async () => {
      await expect(result.current.play("Hello", ttsConfig, { quiet: true })).rejects.toThrow(
        "[PLAYBACK_BLOCKED]",
      )
    })
    expect(toastAddMock).not.toHaveBeenCalled()

    await act(async () => {
      await expect(result.current.play("Hello", ttsConfig)).rejects.toThrow("[PLAYBACK_BLOCKED]")
    })
    expect(toastAddMock).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        type: "error",
        description: "speak.playbackBlocked",
      }),
    )
    expect(sources()).toEqual([])
    expect(result.current.isPlaying).toBe(false)
  })
})
