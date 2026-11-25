import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const onMessageMock = vi.fn<(...args: any[]) => any>()
const sendMessageMock = vi.fn<(...args: any[]) => any>()
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

function getRegisteredMessageHandler<TResult = unknown>(
  name: string,
): (message: { data: unknown }) => Promise<TResult> {
  const registration = onMessageMock.mock.calls.find((call) => call[0] === name)
  if (!registration) {
    throw new Error(`Message handler not registered: ${name}`)
  }

  return registration[1] as (message: { data: unknown }) => Promise<TResult>
}

function installFakeAudio() {
  const createObjectURLMock = vi.fn<(...args: any[]) => any>(() => "blob:tts-test")
  const revokeObjectURLMock = vi.fn<(...args: any[]) => any>()

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
    play = vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined)
    pause = vi.fn<(...args: any[]) => any>()
    removeAttribute = vi.fn<(...args: any[]) => any>()
    load = vi.fn<(...args: any[]) => any>()

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
    } else {
      delete (URL as { createObjectURL?: unknown }).createObjectURL
    }

    if (revokeObjectURLDescriptor) {
      Object.defineProperty(URL, "revokeObjectURL", revokeObjectURLDescriptor)
    } else {
      delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL
    }
  })

  it("recreates offscreen document after it disappears", async () => {
    const getContextsMock = vi.fn<(...args: any[]) => any>().mockResolvedValue([])
    const createDocumentMock = vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined)
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
    const startHandler = getRegisteredMessageHandler<{ ok: boolean }>("ttsPlaybackStart")

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
    const getContextsMock = vi
      .fn<(...args: any[]) => any>()
      .mockResolvedValue([{ contextType: "OFFSCREEN_DOCUMENT" }])
    ;(globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        getContexts: getContextsMock,
      },
      offscreen: {
        createDocument: vi.fn<(...args: any[]) => any>(),
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

    // vi.resetModules() brings a fresh logger with the fresh module; capture that one.
    const logs = (await import("@/utils/logging/testing")).captureLogs()
    const { setupTTSPlaybackMessageHandlers } = await import("../tts-playback")
    setupTTSPlaybackMessageHandlers()
    const startHandler = getRegisteredMessageHandler<{ ok: boolean }>("ttsPlaybackStart")

    const result = await startHandler({
      data: {
        requestId: "req-2",
        audioBase64: "ZmFrZQ==",
        contentType: "audio/mpeg",
      },
    })

    expect(result).toEqual({ ok: true })
    expect(
      sendMessageMock.mock.calls.filter((call) => call[0] === "ttsOffscreenPlay"),
    ).toHaveLength(2)
    expect(logs.filter((record) => record.level === "warn")).not.toHaveLength(0)
  })

  it("uses offscreen playback whenever the offscreen API is available", async () => {
    vi.stubEnv("BROWSER", "custom-chromium")
    const getContextsMock = vi.fn<(...args: any[]) => any>().mockResolvedValue([])
    const createDocumentMock = vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined)
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
    const prepareHandler = getRegisteredMessageHandler<{ ok: true }>("ttsPlaybackPrepare")

    await prepareHandler({ data: undefined })

    expect(createDocumentMock).toHaveBeenCalledTimes(1)
  })

  it("uses background DOM audio playback in Firefox when offscreen is unavailable", async () => {
    vi.stubEnv("BROWSER", "firefox")
    const { FakeAudio, revokeObjectURLMock } = installFakeAudio()

    const { setupTTSPlaybackMessageHandlers } = await import("../tts-playback")
    setupTTSPlaybackMessageHandlers()
    const startHandler = getRegisteredMessageHandler<{ ok: boolean }>("ttsPlaybackStart")

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
    const startHandler = getRegisteredMessageHandler<{ ok: boolean }>("ttsPlaybackStart")
    const stopHandler = getRegisteredMessageHandler<{ ok: true }>("ttsPlaybackStop")

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

  it("ignores closed message channel errors when stopping stale offscreen playback", async () => {
    const getContextsMock = vi
      .fn<(...args: any[]) => any>()
      .mockResolvedValue([{ contextType: "OFFSCREEN_DOCUMENT" }])
    const createDocumentMock = vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined)
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
        throw new Error(
          "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received",
        )
      }

      if (type === "ttsOffscreenPlay") {
        return { ok: true as const }
      }

      throw new Error(`Unexpected message: ${type}`)
    })

    const { setupTTSPlaybackMessageHandlers } = await import("../tts-playback")
    setupTTSPlaybackMessageHandlers()
    const startHandler = getRegisteredMessageHandler<{ ok: boolean }>("ttsPlaybackStart")

    const result = await startHandler({
      data: {
        requestId: "req-closed-stop",
        audioBase64: "ZmFrZQ==",
        contentType: "audio/mpeg",
      },
    })

    expect(result).toEqual({ ok: true })
    expect(createDocumentMock).not.toHaveBeenCalled()
  })

  it("does not retry ttsOffscreenPlay when the message channel closes mid-playback", async () => {
    const getContextsMock = vi
      .fn<(...args: any[]) => any>()
      .mockResolvedValue([{ contextType: "OFFSCREEN_DOCUMENT" }])
    const createDocumentMock = vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined)
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
        throw new Error(
          "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received",
        )
      }

      throw new Error(`Unexpected message: ${type}`)
    })

    const { setupTTSPlaybackMessageHandlers } = await import("../tts-playback")
    setupTTSPlaybackMessageHandlers()
    const startHandler = getRegisteredMessageHandler<{ ok: boolean }>("ttsPlaybackStart")

    await expect(
      startHandler({
        data: {
          requestId: "req-closed-play",
          audioBase64: "ZmFrZQ==",
          contentType: "audio/mpeg",
        },
      }),
    ).rejects.toThrow("message channel closed")

    expect(
      sendMessageMock.mock.calls.filter((call) => call[0] === "ttsOffscreenPlay"),
    ).toHaveLength(1)
    expect(createDocumentMock).not.toHaveBeenCalled()
  })

  it("skips retrying ttsOffscreenPlay if stop arrives while recreating the offscreen document", async () => {
    const getContextsMock = vi
      .fn<(...args: any[]) => any>()
      .mockResolvedValueOnce([{ contextType: "OFFSCREEN_DOCUMENT" }])
      .mockResolvedValueOnce([])

    let resolveCreateDocument!: () => void
    const createDocumentDeferred = new Promise<void>((resolve) => {
      resolveCreateDocument = resolve
    })
    const createDocumentMock = vi
      .fn<(...args: any[]) => any>()
      .mockReturnValue(createDocumentDeferred)
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
        throw new Error("Could not establish connection. Receiving end does not exist.")
      }

      throw new Error(`Unexpected message: ${type}`)
    })

    const { setupTTSPlaybackMessageHandlers } = await import("../tts-playback")
    setupTTSPlaybackMessageHandlers()
    const startHandler = getRegisteredMessageHandler<{ ok: boolean; reason?: string }>(
      "ttsPlaybackStart",
    )
    const stopHandler = getRegisteredMessageHandler<{ ok: true }>("ttsPlaybackStop")

    const playPromise = startHandler({
      data: {
        requestId: "req-stop-during-retry",
        audioBase64: "ZmFrZQ==",
        contentType: "audio/mpeg",
      },
    })

    await vi.waitFor(() => {
      expect(createDocumentMock).toHaveBeenCalledTimes(1)
    })

    await stopHandler({ data: { requestId: "req-stop-during-retry", reason: "stopped" } })
    resolveCreateDocument()

    await expect(playPromise).resolves.toEqual({ ok: false, reason: "stopped" })
    expect(
      sendMessageMock.mock.calls.filter((call) => call[0] === "ttsOffscreenPlay"),
    ).toHaveLength(1)
  })

  it("skips retrying ttsOffscreenPlay if a newer play request supersedes it during recovery", async () => {
    const getContextsMock = vi
      .fn<(...args: any[]) => any>()
      .mockResolvedValueOnce([{ contextType: "OFFSCREEN_DOCUMENT" }])
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ contextType: "OFFSCREEN_DOCUMENT" }])

    let resolveCreateDocument!: () => void
    const createDocumentDeferred = new Promise<void>((resolve) => {
      resolveCreateDocument = resolve
    })
    const createDocumentMock = vi
      .fn<(...args: any[]) => any>()
      .mockReturnValue(createDocumentDeferred)
    ;(globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        getContexts: getContextsMock,
      },
      offscreen: {
        createDocument: createDocumentMock,
      },
    }

    sendMessageMock.mockImplementation(async (type: string, data?: { requestId?: string }) => {
      if (type === "ttsOffscreenStop") {
        return { ok: true as const }
      }

      if (type === "ttsOffscreenPlay") {
        if (data?.requestId === "req-old") {
          throw new Error("Could not establish connection. Receiving end does not exist.")
        }
        return { ok: true as const }
      }

      throw new Error(`Unexpected message: ${type}`)
    })

    const { setupTTSPlaybackMessageHandlers } = await import("../tts-playback")
    setupTTSPlaybackMessageHandlers()
    const startHandler = getRegisteredMessageHandler<{ ok: boolean; reason?: string }>(
      "ttsPlaybackStart",
    )

    const oldPlayPromise = startHandler({
      data: {
        requestId: "req-old",
        audioBase64: "ZmFrZQ==",
        contentType: "audio/mpeg",
      },
    })

    await vi.waitFor(() => {
      expect(createDocumentMock).toHaveBeenCalledTimes(1)
    })

    const newPlayResult = await startHandler({
      data: {
        requestId: "req-new",
        audioBase64: "bmV3",
        contentType: "audio/mpeg",
      },
    })
    expect(newPlayResult).toEqual({ ok: true })

    resolveCreateDocument()
    await expect(oldPlayPromise).resolves.toEqual({ ok: false, reason: "interrupted" })

    const playCalls = sendMessageMock.mock.calls.filter((call) => call[0] === "ttsOffscreenPlay")
    expect(playCalls.map((call) => (call[1] as { requestId?: string })?.requestId)).toEqual([
      "req-old",
      "req-new",
    ])
  })

  it("reports a stopped request as stopped even when newer speech starts before it resumes", async () => {
    const getContextsMock = vi
      .fn<(...args: any[]) => any>()
      .mockResolvedValueOnce([{ contextType: "OFFSCREEN_DOCUMENT" }])
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ contextType: "OFFSCREEN_DOCUMENT" }])

    let resolveCreateDocument!: () => void
    const createDocumentDeferred = new Promise<void>((resolve) => {
      resolveCreateDocument = resolve
    })
    const createDocumentMock = vi
      .fn<(...args: any[]) => any>()
      .mockReturnValue(createDocumentDeferred)
    ;(globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        getContexts: getContextsMock,
      },
      offscreen: {
        createDocument: createDocumentMock,
      },
    }

    sendMessageMock.mockImplementation(async (type: string, data?: { requestId?: string }) => {
      if (type === "ttsOffscreenStop") {
        return { ok: true as const }
      }

      if (type === "ttsOffscreenPlay") {
        if (data?.requestId === "req-old") {
          throw new Error("Could not establish connection. Receiving end does not exist.")
        }
        return { ok: true as const }
      }

      throw new Error(`Unexpected message: ${type}`)
    })

    const { setupTTSPlaybackMessageHandlers } = await import("../tts-playback")
    setupTTSPlaybackMessageHandlers()
    const startHandler = getRegisteredMessageHandler<{ ok: boolean; reason?: string }>(
      "ttsPlaybackStart",
    )

    const stopHandler = getRegisteredMessageHandler<{ ok: true }>("ttsPlaybackStop")

    const oldPlayPromise = startHandler({
      data: {
        requestId: "req-old",
        audioBase64: "ZmFrZQ==",
        contentType: "audio/mpeg",
      },
    })

    await vi.waitFor(() => {
      expect(createDocumentMock).toHaveBeenCalledTimes(1)
    })

    await stopHandler({ data: { requestId: "req-old", reason: "stopped" } })

    const newPlayResult = await startHandler({
      data: {
        requestId: "req-new",
        audioBase64: "bmV3",
        contentType: "audio/mpeg",
      },
    })
    expect(newPlayResult).toEqual({ ok: true })

    resolveCreateDocument()
    await expect(oldPlayPromise).resolves.toEqual({ ok: false, reason: "stopped" })

    const playCalls = sendMessageMock.mock.calls.filter((call) => call[0] === "ttsOffscreenPlay")
    expect(playCalls.map((call) => (call[1] as { requestId?: string })?.requestId)).toEqual([
      "req-old",
      "req-new",
    ])
  })
})
