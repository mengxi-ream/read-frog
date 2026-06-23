import type {
  TTSPlaybackStartRequest,
  TTSPlaybackStartResponse,
  TTSPlaybackStopRequest,
} from "@/types/tts-playback"
import { browser } from "#imports"
import { logger } from "@/utils/logger"
import { onMessage, sendMessage } from "@/utils/message"
import { DOMAudioPlaybackController } from "@/utils/tts-playback/dom-audio-controller"

const OFFSCREEN_DOCUMENT_PATH = "/offscreen.html" as const
const OFFSCREEN_DOCUMENT_URL = browser.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)
const OFFSCREEN_REASON = "AUDIO_PLAYBACK"
const OFFSCREEN_JUSTIFICATION
  = "Play synthesized speech from extension context to avoid webpage CSP media restrictions."

interface ChromeRuntimeContext {
  contextType?: string
}

interface ChromeRuntimeApi {
  getContexts?: (filter: { contextTypes: string[], documentUrls?: string[] }) => Promise<ChromeRuntimeContext[]>
}

interface ChromeOffscreenApi {
  createDocument: (options: { url: string, reasons: string[], justification: string }) => Promise<void>
}

interface ChromeLike {
  runtime?: ChromeRuntimeApi
  offscreen?: ChromeOffscreenApi
}

interface TTSPlaybackAdapter {
  prepare: () => Promise<void>
  play: (request: TTSPlaybackStartRequest) => Promise<TTSPlaybackStartResponse>
  stop: (request: TTSPlaybackStopRequest) => Promise<void>
}

function getChromeLike(): ChromeLike {
  return (globalThis as { chrome?: ChromeLike }).chrome ?? {}
}

function hasChromeOffscreenApi(): boolean {
  return typeof getChromeLike().offscreen?.createDocument === "function"
}

function hasBackgroundDOMAudioApi(): boolean {
  return typeof Audio === "function"
    && typeof Blob === "function"
    && typeof URL.createObjectURL === "function"
}

function isSingleOffscreenDocumentError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes("Only a single offscreen document may be created")
    || message.includes("already exists")
}

function isMissingReceiverError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes("Could not establish connection")
    || message.includes("Receiving end does not exist")
    || message.includes("No response")
}

class ChromeOffscreenPlaybackAdapter implements TTSPlaybackAdapter {
  private ensureOffscreenPromise: Promise<void> | null = null

  async prepare(): Promise<void> {
    if (await this.hasOffscreenDocument()) {
      return
    }

    if (this.ensureOffscreenPromise) {
      return this.ensureOffscreenPromise
    }

    this.ensureOffscreenPromise = (async () => {
      const chromeApi = getChromeLike()
      if (!chromeApi.offscreen?.createDocument) {
        throw new Error("Offscreen API is unavailable in this browser")
      }

      try {
        await chromeApi.offscreen.createDocument({
          url: OFFSCREEN_DOCUMENT_PATH,
          reasons: [OFFSCREEN_REASON],
          justification: OFFSCREEN_JUSTIFICATION,
        })
      }
      catch (error) {
        if (!isSingleOffscreenDocumentError(error)) {
          throw error
        }
      }
    })().finally(() => {
      this.ensureOffscreenPromise = null
    })

    return this.ensureOffscreenPromise
  }

  async play(request: TTSPlaybackStartRequest): Promise<TTSPlaybackStartResponse> {
    await this.prepare()

    // Latest request wins: always stop any in-progress playback first.
    await this.stop({ reason: "interrupted" })

    try {
      return await sendMessage("ttsOffscreenPlay", request)
    }
    catch (error) {
      if (!isMissingReceiverError(error)) {
        throw error
      }

      logger.warn("[Background][TTSPlayback] offscreen receiver missing, retrying once", error)

      // Offscreen documents can be reclaimed by the browser and briefly lose handlers.
      await this.prepare()
      return sendMessage("ttsOffscreenPlay", request)
    }
  }

  async stop(request: TTSPlaybackStopRequest): Promise<void> {
    try {
      await sendMessage("ttsOffscreenStop", request)
    }
    catch (error) {
      if (!isMissingReceiverError(error)) {
        throw error
      }
    }
  }

  private async hasOffscreenDocument(): Promise<boolean> {
    const chromeApi = getChromeLike()
    if (!chromeApi.runtime?.getContexts) {
      return false
    }

    const contexts = await chromeApi.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [OFFSCREEN_DOCUMENT_URL],
    })

    return contexts.some(context => context.contextType === "OFFSCREEN_DOCUMENT")
  }
}

class BackgroundDOMAudioPlaybackAdapter implements TTSPlaybackAdapter {
  private readonly controller = new DOMAudioPlaybackController("Failed to play audio in background page")

  async prepare(): Promise<void> {
    if (!hasBackgroundDOMAudioApi()) {
      throw new Error("DOM Audio playback is unavailable in background context")
    }
  }

  async play(request: TTSPlaybackStartRequest): Promise<TTSPlaybackStartResponse> {
    await this.prepare()
    return this.controller.play(request)
  }

  async stop(request: TTSPlaybackStopRequest): Promise<void> {
    this.controller.stop(request)
  }
}

class UnsupportedPlaybackAdapter implements TTSPlaybackAdapter {
  constructor(private readonly browserName: string) {}

  async prepare(): Promise<void> {
    throw new Error(`TTS playback is not supported in ${this.browserName}`)
  }

  async play(): Promise<TTSPlaybackStartResponse> {
    await this.prepare()
    return { ok: false, reason: "stopped" }
  }

  async stop(): Promise<void> {
  }
}

function createTTSPlaybackAdapter(): TTSPlaybackAdapter {
  if (hasChromeOffscreenApi()) {
    return new ChromeOffscreenPlaybackAdapter()
  }

  if (hasBackgroundDOMAudioApi()) {
    return new BackgroundDOMAudioPlaybackAdapter()
  }

  return new UnsupportedPlaybackAdapter(import.meta.env.BROWSER)
}

export function setupTTSPlaybackMessageHandlers() {
  const adapter = createTTSPlaybackAdapter()

  onMessage("ttsPlaybackPrepare", async () => {
    await adapter.prepare()
    return { ok: true as const }
  })

  onMessage("ttsPlaybackStart", async (message) => {
    return adapter.play(message.data)
  })

  onMessage("ttsPlaybackStop", async (message) => {
    try {
      await adapter.stop({
        requestId: message.data.requestId,
        reason: message.data.reason ?? "stopped",
      })
    }
    catch (error) {
      logger.warn("[Background][TTSPlayback] stop failed", error)
      throw error
    }

    return { ok: true as const }
  })
}
