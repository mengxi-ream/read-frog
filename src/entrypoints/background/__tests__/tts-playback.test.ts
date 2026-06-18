import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const onMessageMock = vi.fn()
const sendMessageMock = vi.fn()
const loggerWarnMock = vi.fn()
const createObjectURLDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL")
const revokeObjectURLDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL")

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

function getRegisteredMessageHandler<TData = unknown, TResult = unknown>(name: string) {
  const registration = onMessageMock.mock.calls.find(call => call[0] === name)
  if (!registration) {
    throw new Error(`Message handler not registered: ${name}`)
  }

  return registration[1] as (message: { data: TData }) => Promise<TResult>
}

function installFakeAudio() {
  const createObjectURLMock = vi.fn(() => "blob:tts-test")
  const revokeObjectURLMock = vi.fn()

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectURLMock,
  })
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURLMock,
  })

  class FakeAudio {
    static instances: FakeAudio[] = []

    onended: (() => void) | null = null
    onerror: (() => void) | null = null
    play = vi.fn().mockResolvedValue(undefined)
    pause = vi.fn()
    removeAttribute = vi.fn()
    load = vi.fn()

    constructor(readonly src: string) {
      FakeAudio.instances.push(this)
    }
  }

  vi.stubGlobal("Audio", FakeAudio)

  return {
    FakeAudio,
    createObjectURLMock,
    revokeObjectURLMock,
  }
}

describe("setupTTSPlaybackMessageHandlers", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    ;(globalThis as { chrome?: unknown }).chrome = undefined
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (createObjectURLDescriptor) {
      Object.defineProperty(URL, "createObjectURL", createObjectURLDescriptor)
    }
    else {
      delete (URL as { createObjectURL?: unknown }).createObjectURL
    }

    if (revokeObjectURLDescriptor) {
      Object.defineProperty(URL, "revokeObjectURL", revokeObjectURLDescriptor)
    }
    else {
      delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL
    }
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
    const startHandler = getRegisteredMessageHandler<{
      requestId: string
      audioBase64: string
      contentType: string
    }, { ok: boolean }>("ttsPlaybackStart")

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
    const startHandler = getRegisteredMessageHandler<{
      requestId: string
      audioBase64: string
      contentType: string
    }, { ok: boolean }>("ttsPlaybackStart")

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

  it("uses offscreen playback whenever the offscreen API is available", async () => {
    vi.stubEnv("BROWSER", "custom-chromium")
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
      if (type === "ttsOffscreenStop" || type === "ttsOffscreenPlay") {
        return { ok: true as const }
      }

      throw new Error(`Unexpected message: ${type}`)
    })

    const { setupTTSPlaybackMessageHandlers } = await import("../tts-playback")
    setupTTSPlaybackMessageHandlers()
    const prepareHandler = getRegisteredMessageHandler<undefined, { ok: true }>("ttsPlaybackPrepare")

    await prepareHandler({ data: undefined })

    expect(createDocumentMock).toHaveBeenCalledTimes(1)
  })

  it("uses background DOM audio playback in Firefox when offscreen is unavailable", async () => {
    vi.stubEnv("BROWSER", "firefox")
    const { FakeAudio, revokeObjectURLMock } = installFakeAudio()

    const { setupTTSPlaybackMessageHandlers } = await import("../tts-playback")
    setupTTSPlaybackMessageHandlers()
    const startHandler = getRegisteredMessageHandler<{
      requestId: string
      audioBase64: string
      contentType: string
    }, { ok: boolean }>("ttsPlaybackStart")

    const playbackPromise = startHandler({
      data: {
        requestId: "req-firefox",
        audioBase64: "ZmFrZQ==",
        contentType: "audio/mpeg",
      },
    })
    await Promise.resolve()

    expect(FakeAudio.instances).toHaveLength(1)
    expect(FakeAudio.instances[0]!.play).toHaveBeenCalled()
    expect(sendMessageMock).not.toHaveBeenCalled()

    FakeAudio.instances[0]!.onended?.()

    await expect(playbackPromise).resolves.toEqual({ ok: true })
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:tts-test")
  })

  it("stops only the active Firefox background playback request", async () => {
    vi.stubEnv("BROWSER", "firefox")
    const { FakeAudio } = installFakeAudio()

    const { setupTTSPlaybackMessageHandlers } = await import("../tts-playback")
    setupTTSPlaybackMessageHandlers()
    const startHandler = getRegisteredMessageHandler<{
      requestId: string
      audioBase64: string
      contentType: string
    }, { ok: boolean }>("ttsPlaybackStart")
    const stopHandler = getRegisteredMessageHandler<{ requestId?: string }, { ok: true }>("ttsPlaybackStop")

    const playbackPromise = startHandler({
      data: {
        requestId: "req-active",
        audioBase64: "ZmFrZQ==",
        contentType: "audio/mpeg",
      },
    })
    await Promise.resolve()

    await stopHandler({ data: { requestId: "req-other" } })
    expect(FakeAudio.instances[0]!.pause).not.toHaveBeenCalled()

    await stopHandler({ data: { requestId: "req-active" } })

    await expect(playbackPromise).resolves.toEqual({ ok: false, reason: "stopped" })
    expect(FakeAudio.instances[0]!.pause).toHaveBeenCalled()
  })
})
