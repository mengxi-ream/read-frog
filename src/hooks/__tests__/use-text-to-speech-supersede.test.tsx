// @vitest-environment jsdom
import type { ReactNode } from "react"
import type { TTSConfig } from "@/types/config/tts"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"

const sendMessageMock = vi.fn<(type: string, data?: any) => Promise<any>>()
const detectLanguageMock = vi.fn<(text: string) => Promise<string>>()

vi.mock("@/utils/message", () => ({
  sendMessage: (type: string, data?: any) => sendMessageMock(type, data),
}))
vi.mock("@/utils/content/language", () => ({
  detectLanguage: (text: string) => detectLanguageMock(text),
}))
vi.mock("@/utils/analytics", () => ({
  createFeatureUsageContext: () => ({}),
  trackFeatureUsed: vi.fn<() => Promise<void>>(async () => {}),
}))
vi.mock("@/components/ui/base-ui/toast", () => ({
  toastManager: { add: vi.fn<(options: unknown) => void>() },
}))

const { useTextToSpeech } = await import("../use-text-to-speech")

const ttsConfig = {
  defaultVoice: "en-US-DavisNeural",
  languageVoices: {},
  rate: 0,
  pitch: 0,
  volume: 0,
} as unknown as TTSConfig

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={createStore()}>{children}</Provider>
    </QueryClientProvider>
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("useTextToSpeech superseded runs", () => {
  it("never starts audio for a run replaced while its audio was still being fetched", async () => {
    // Run A is past voice detection and waiting on its audio; run B starts
    // meanwhile and plays. B's stop() resets shouldStopRef, so A must also
    // notice it is no longer the active request.
    const slowFetch = deferred<{ ok: true; audioBase64: string; contentType: string }>()
    detectLanguageMock.mockResolvedValue("eng")
    const started: string[] = []
    sendMessageMock.mockImplementation(async (type, data) => {
      if (type === "edgeTtsSynthesize") {
        return data.text === "A"
          ? slowFetch.promise
          : { ok: true, audioBase64: data.text, contentType: "audio/mpeg" }
      }
      if (type === "ttsPlaybackStart") {
        started.push(data.audioBase64)
        return { ok: true }
      }
      return undefined
    })

    const { result } = renderHook(() => useTextToSpeech(), { wrapper })

    let runA!: Promise<void>
    act(() => {
      runA = result.current.play("A", ttsConfig)
    })
    await waitFor(() =>
      expect(
        sendMessageMock.mock.calls.some(
          ([type, data]) => type === "edgeTtsSynthesize" && data.text === "A",
        ),
      ).toBe(true),
    )
    await act(async () => {
      await result.current.play("B", ttsConfig)
    })
    expect(started).toEqual(["B"])

    await act(async () => {
      slowFetch.resolve({ ok: true, audioBase64: "A", contentType: "audio/mpeg" })
      await runA
    })
    expect(started).toEqual(["B"])
    await waitFor(() => expect(result.current.isPlaying).toBe(false))
    expect(result.current.isFetching).toBe(false)
  })

  it("reports no error for a replaced run whose fetch fails", async () => {
    const slowFetch = deferred<{ ok: false; error: { code: string; message: string } }>()
    detectLanguageMock.mockResolvedValue("eng")
    sendMessageMock.mockImplementation(async (type, data) => {
      if (type === "edgeTtsSynthesize") {
        return data.text === "A"
          ? slowFetch.promise
          : { ok: true, audioBase64: data.text, contentType: "audio/mpeg" }
      }
      if (type === "ttsPlaybackStart") return { ok: true }
      return undefined
    })
    const { toastManager } = await import("@/components/ui/base-ui/toast")

    const { result } = renderHook(() => useTextToSpeech(), { wrapper })
    let runA!: Promise<void>
    act(() => {
      runA = result.current.play("A", ttsConfig)
    })
    await waitFor(() =>
      expect(
        sendMessageMock.mock.calls.some(
          ([type, data]) => type === "edgeTtsSynthesize" && data.text === "A",
        ),
      ).toBe(true),
    )
    await act(async () => {
      await result.current.play("B", ttsConfig)
    })
    await act(async () => {
      slowFetch.resolve({ ok: false, error: { code: "NETWORK_ERROR", message: "offline" } })
      await runA.catch(() => {})
    })
    expect(toastManager.add).not.toHaveBeenCalled()
  })
})
