import { beforeEach, describe, expect, it, vi } from "vitest"

const onMessageMock = vi.fn()
const sendMessageMock = vi.fn()
const loggerWarnMock = vi.fn()

vi.mock("#imports", () => ({
  browser: {
    runtime: {
      getURL: (path: string) => `chrome-extension://test${path}`,
    },
  },
}))

vi.mock("@/utils/message", () => ({
  onMessage: onMessageMock,
  sendMessage: sendMessageMock,
}))

vi.mock("@/utils/logger", () => ({
  logger: {
    warn: loggerWarnMock,
  },
}))

function getRegisteredMessageHandler(name: string) {
  const registration = onMessageMock.mock.calls.find(call => call[0] === name)
  if (!registration) {
    throw new Error(`Message handler not registered: ${name}`)
  }

  return registration[1] as (message: {
    data: {
      requestId: string
      audioBase64: string
      contentType: string
    }
  }) => Promise<{ ok: boolean }>
}

describe("setupTTSPlaybackMessageHandlers", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("recreates offscreen document after it disappears", async () => {
    const getContextsMock = vi.fn().mockResolvedValue([])
    const createDocumentMock = vi.fn().mockResolvedValue(undefined)
    ;(globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        getContexts: getContextsMock,
      },
      offscreen: {
        createDocument: createDocumentMock,
      },
    }

    sendMessageMock.mockImplementation(async (type: string) => {
      if (type === "ttsOffscreenStop") {
        return { ok: true as const }
      }

      if (type === "ttsOffscreenPlay") {
        return { ok: true as const }
      }

      throw new Error(`Unexpected message: ${type}`)
    })

    const { setupTTSPlaybackMessageHandlers } = await import("../tts-playback")
    setupTTSPlaybackMessageHandlers()
    const startHandler = getRegisteredMessageHandler("ttsPlaybackStart")

    const payload = {
      data: {
        requestId: "req-1",
        audioBase64: "ZmFrZQ==",
        contentType: "audio/mpeg",
      },
    }

    await startHandler(payload)
    await startHandler(payload)

    expect(createDocumentMock).toHaveBeenCalledTimes(2)
  })

  it("retries once when offscreen receiver is temporarily missing", async () => {
    const getContextsMock = vi.fn().mockResolvedValue([
      { contextType: "OFFSCREEN_DOCUMENT" },
    ])
    ;(globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        getContexts: getContextsMock,
      },
      offscreen: {
        createDocument: vi.fn(),
      },
    }

    let playAttempts = 0
    sendMessageMock.mockImplementation(async (type: string) => {
      if (type === "ttsOffscreenStop") {
        return { ok: true as const }
      }

      if (type === "ttsOffscreenPlay") {
        playAttempts += 1
        if (playAttempts === 1) {
          throw new Error("Could not establish connection. Receiving end does not exist.")
        }
        return { ok: true as const }
      }

      throw new Error(`Unexpected message: ${type}`)
    })

    const { setupTTSPlaybackMessageHandlers } = await import("../tts-playback")
    setupTTSPlaybackMessageHandlers()
    const startHandler = getRegisteredMessageHandler("ttsPlaybackStart")

    const result = await startHandler({
      data: {
        requestId: "req-2",
        audioBase64: "ZmFrZQ==",
        contentType: "audio/mpeg",
      },
    })

    expect(result).toEqual({ ok: true })
    expect(sendMessageMock.mock.calls.filter(call => call[0] === "ttsOffscreenPlay")).toHaveLength(2)
    expect(loggerWarnMock).toHaveBeenCalled()
  })
})
