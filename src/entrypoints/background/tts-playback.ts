import type { TTSOffscreenStopRequest, TTSPlaybackStartResponse } from "@/types/tts-playback"
import { browser } from "#imports"
import { logger } from "@/utils/logger"
import { onMessage, sendMessage } from "@/utils/message"

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

let ensureOffscreenPromise: Promise<void> | null = null

function getChromeLike(): ChromeLike {
  return (globalThis as { chrome?: ChromeLike }).chrome ?? {}
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

async function hasOffscreenDocument(): Promise<boolean> {
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

async function ensureOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) {
    return
  }

  if (ensureOffscreenPromise) {
    return ensureOffscreenPromise
  }

  ensureOffscreenPromise = (async () => {
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
    ensureOffscreenPromise = null
  })

  return ensureOffscreenPromise
}

async function stopOffscreenPlayback(data: TTSOffscreenStopRequest): Promise<void> {
  try {
    await sendMessage("ttsOffscreenStop", data)
  }
  catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error
    }
  }
}

async function startOffscreenPlayback(
  requestId: string,
  audioBase64: string,
  contentType: string,
): Promise<TTSPlaybackStartResponse> {
  await ensureOffscreenDocument()

  // Latest request wins: always stop any in-progress playback first.
  await stopOffscreenPlayback({ reason: "interrupted" })

  try {
    return await sendMessage("ttsOffscreenPlay", {
      requestId,
      audioBase64,
      contentType,
    })
  }
  catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error
    }

    logger.warn("[Background][TTSPlayback] offscreen receiver missing, retrying once", error)

    // Offscreen documents can be reclaimed by the browser and briefly lose handlers.
    await ensureOffscreenDocument()
    return sendMessage("ttsOffscreenPlay", {
      requestId,
      audioBase64,
      contentType,
    })
  }
}

export function setupTTSPlaybackMessageHandlers() {
  onMessage("ttsPlaybackEnsureOffscreen", async () => {
    await ensureOffscreenDocument()
    return { ok: true as const }
  })

  onMessage("ttsPlaybackStart", async (message) => {
    return startOffscreenPlayback(
      message.data.requestId,
      message.data.audioBase64,
      message.data.contentType,
    )
  })

  onMessage("ttsPlaybackStop", async (message) => {
    try {
      await stopOffscreenPlayback({
        requestId: message.data.requestId,
        reason: "stopped",
      })
    }
    catch (error) {
      logger.warn("[Background][TTSPlayback] stop failed", error)
      throw error
    }

    return { ok: true as const }
  })
}
