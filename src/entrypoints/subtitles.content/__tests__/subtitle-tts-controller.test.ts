import type { Config } from "@/types/config/config"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { currentSubtitleAtom, subtitlesStore } from "../atoms"
import { SubtitleTTSController } from "../subtitle-tts-controller"

// Mock the messaging layer so we never hit the network. ttsPlaybackStart
// resolves immediately (simulating onended) so the loop can advance quickly.
vi.mock("@/utils/message", () => ({
  sendMessage: vi.fn(async (type: string) => {
    if (type === "edgeTtsSynthesize") {
      return { ok: true, audioBase64: "AAAA", contentType: "audio/mpeg" }
    }
    if (type === "ttsPlaybackStart") {
      return { ok: true }
    }
    return { ok: true }
  }),
}))

// splitTextByUtf8Bytes is used internally; keep the real implementation.
vi.mock("@/utils/server/edge-tts/chunk", async () => {
  const actual = await vi.importActual<typeof import("@/utils/server/edge-tts/chunk")>(
    "@/utils/server/edge-tts/chunk",
  )
  return { splitTextByUtf8Bytes: (text: string) => actual.splitTextByUtf8Bytes(text) }
})

const baseConfig = {
  videoSubtitles: {
    tts: {
      enabled: true,
      readTarget: "translation" as const,
      voiceMode: "auto" as const,
      customVoice: "",
      rate: 0,
      pauseWithVideo: true,
    },
  },
  tts: {
    defaultVoice: "en-US-AndrewMultilingualNeural",
    languageVoices: { eng: "en-US-AndrewMultilingualNeural", cmn: "zh-CN-XiaoxiaoMultilingualNeural" },
    rate: 0,
    pitch: 0,
    volume: 0,
  },
  language: { sourceCode: "eng" as const, targetCode: "cmn" as const, level: "intermediate" as const },
} as unknown as Pick<Config, "videoSubtitles" | "tts" | "language">

function makeVideo(currentTime = 0): HTMLVideoElement {
  return {
    currentTime,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as HTMLVideoElement
}

function makeController(options: {
  fragments?: SubtitlesFragment[]
  config?: typeof baseConfig
  video?: HTMLVideoElement
}) {
  const fragments = options.fragments ?? []
  const video = options.video ?? makeVideo()
  const getConfig = vi.fn(async () => options.config ?? baseConfig)
  const controller = new SubtitleTTSController({
    getFragments: () => fragments,
    getVideoElement: () => video,
    getConfig,
  })
  return { controller, getConfig, video }
}

describe("subtitle TTS controller", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    subtitlesStore.set(currentSubtitleAtom, null)
  })

  it("plays the active cue when started (loop-driven)", async () => {
    const { sendMessage } = await import("@/utils/message")
    const fragments: SubtitlesFragment[] = [
      { text: "hello", translation: "你好", start: 0, end: 2000 },
    ]
    const { controller } = makeController({ fragments, video: makeVideo(0) })

    controller.start()
    // The loop should synthesize + start playback for the current cue.
    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith("ttsPlaybackStart", expect.objectContaining({ audioBase64: "AAAA" }))
    })
    expect(sendMessage).toHaveBeenCalledWith("edgeTtsSynthesize", expect.objectContaining({ text: "你好" }))

    controller.stop()
  })

  it("synthesizes the translation text by default, original when configured", async () => {
    const { sendMessage } = await import("@/utils/message")
    const fragments: SubtitlesFragment[] = [
      { text: "hello", translation: "你好", start: 0, end: 2000 },
    ]
    const originalConfig = {
      ...baseConfig,
      videoSubtitles: {
        ...baseConfig.videoSubtitles,
        tts: { ...baseConfig.videoSubtitles.tts, readTarget: "original" as const },
      },
    }
    const { controller } = makeController({ fragments, config: originalConfig, video: makeVideo(0) })

    controller.start()
    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith("edgeTtsSynthesize", expect.objectContaining({ text: "hello" }))
    })

    controller.stop()
  })

  it("stops the loop and playback on stop()", async () => {
    const { sendMessage } = await import("@/utils/message")
    const fragments: SubtitlesFragment[] = [
      { text: "hi", translation: "嗨", start: 0, end: 2000 },
    ]
    const { controller } = makeController({ fragments, video: makeVideo(0) })

    controller.start()
    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith("ttsPlaybackStart", expect.anything())
    })

    controller.stop()
    // stop() issues a ttsPlaybackStop with reason "stopped".
    expect(sendMessage).toHaveBeenCalledWith("ttsPlaybackStop", expect.objectContaining({ reason: "stopped" }))
  })

  it("does not synthesize when config has tts disabled", async () => {
    const { sendMessage } = await import("@/utils/message")
    const disabled = {
      ...baseConfig,
      videoSubtitles: { ...baseConfig.videoSubtitles, tts: { ...baseConfig.videoSubtitles.tts, enabled: false } },
    }
    const { controller } = makeController({ config: disabled, video: makeVideo(0) })

    controller.start()
    // Give the loop a chance to run (it should exit immediately on disabled).
    await new Promise(r => setTimeout(r, 30))
    expect(sendMessage).not.toHaveBeenCalledWith("edgeTtsSynthesize", expect.anything())

    controller.stop()
  })
})
