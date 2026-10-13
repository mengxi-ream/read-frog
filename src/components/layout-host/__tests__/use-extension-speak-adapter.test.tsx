// @vitest-environment jsdom
import type { ReactNode } from "react"
import type { TTSConfig } from "@/types/config/tts"
import { cleanup, renderHook } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

interface PlayOptions {
  forcedVoice?: string
  quiet?: boolean
}

const playMock = vi.fn<(text: string, config: TTSConfig, options?: PlayOptions) => Promise<void>>(
  async () => {},
)
const stopMock = vi.fn<() => void>()

vi.mock("@/hooks/use-text-to-speech", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/use-text-to-speech")>()),
  useTextToSpeech: () => ({ play: playMock, stop: stopMock, isPlaying: false }),
}))

const { useExtensionSpeakAdapter } = await import("../use-extension-speak-adapter")

const { languageVoices } = DEFAULT_CONFIG.tts

function wrapper({ children }: { children: ReactNode }) {
  return <Provider store={createStore()}>{children}</Provider>
}

function speakOptions(autoplay?: boolean) {
  return renderHook(() => useExtensionSpeakAdapter(undefined, autoplay), { wrapper }).result.current
}

async function play(text: string, options: { lang?: string; autoplay?: boolean } = {}) {
  const { adapter } = speakOptions()
  await adapter.play(text, {
    ...options,
    signal: new AbortController().signal,
    onStart: () => {},
  })
  return playMock.mock.calls.at(-1)?.[2]
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("useExtensionSpeakAdapter", () => {
  it("reads a trigger in the voice of the language its layout names", async () => {
    expect(await play("hola", { lang: "es-ES" })).toEqual({
      forcedVoice: languageVoices.spa,
      quiet: false,
    })
    // Chinese goes by region: Taiwan reads in the Traditional Mandarin voice.
    expect((await play("你好", { lang: "zh-TW" }))?.forcedVoice).toBe(languageVoices["cmn-Hant"])
  })

  it("leaves the voice to language detection when the layout names no language it knows", async () => {
    expect(await play("hello")).toEqual({ quiet: false })
    expect(await play("hello", { lang: "not a language" })).toEqual({ quiet: false })
  })

  it("plays a run nobody pressed for quietly, so a failure shows no toast", async () => {
    expect(await play("hola", { lang: "es", autoplay: true })).toEqual({
      forcedVoice: languageVoices.spa,
      quiet: true,
    })
  })

  it("asks the layout to read its marked trigger only where the host turns autoplay on", () => {
    expect(speakOptions().autoplay).toBe(false)
    expect(speakOptions(true).autoplay).toBe(true)
  })
})
