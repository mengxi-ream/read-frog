import type {
  BackgroundStructuredObjectStreamSnapshot,
  BackgroundTextStreamSnapshot,
} from "@/types/background-stream"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { defaultRequestRetryPolicy } from "@/utils/request/retry-policy"

const streamTextMock = vi.fn<(...args: any[]) => any>()
const outputObjectMock = vi.fn<(...args: any[]) => any>((params: Record<string, unknown>) => params)
const getModelByIdMock = vi.fn<(...args: any[]) => any>()
const getLanguageModelForConfigMock = vi.fn<(...args: any[]) => any>()
const loggerErrorMock = vi.fn<(...args: any[]) => any>()
const hostedStreamTextMock = vi.fn<(...args: any[]) => any>()
const hostedSelectionStreamTextMock = vi.fn<(...args: any[]) => any>()
const hostedStreamStructuredObjectMock = vi.fn<(...args: any[]) => any>()
const hostedNoteSuggestionStreamMock = vi.fn<(...args: any[]) => any>()
const parsePartialJsonMock = vi.fn<(...args: any[]) => any>(async (text: string | undefined) => {
  if (!text) {
    return { state: "undefined-input", value: undefined }
  }

  try {
    return { state: "successful-parse", value: JSON.parse(text) }
  } catch {
    try {
      return { state: "repaired-parse", value: JSON.parse(`${text}}`) }
    } catch {
      return { state: "failed-parse", value: undefined }
    }
  }
})

class MockNoOutputGeneratedError extends Error {
  static isInstance(error: unknown): error is MockNoOutputGeneratedError {
    return error instanceof MockNoOutputGeneratedError
  }
}

vi.mock("ai", () => ({
  streamText: streamTextMock,
  parsePartialJson: parsePartialJsonMock,
  NoOutputGeneratedError: MockNoOutputGeneratedError,
  Output: {
    object: outputObjectMock,
  },
}))

vi.mock("@/utils/providers/model", () => ({
  getModelById: getModelByIdMock,
  getLanguageModelForConfig: getLanguageModelForConfigMock,
}))

vi.mock("@/utils/orpc/background-client", () => ({
  backgroundOrpcClient: {
    hostedAi: {
      translate: {
        streamText: hostedStreamTextMock,
      },
      selectionTranslation: {
        streamText: hostedSelectionStreamTextMock,
      },
      customAction: {
        streamStructuredObject: hostedStreamStructuredObjectMock,
      },
      noteSuggestion: {
        streamStructuredObject: hostedNoteSuggestionStreamMock,
      },
    },
  },
}))

vi.mock("@/utils/logger", () => ({
  logger: {
    error: loggerErrorMock,
  },
}))

function createMockPort(name: string) {
  let messageListener: ((message: unknown) => void | Promise<void>) | undefined
  let disconnectListener: (() => void) | undefined

  const postMessage = vi.fn<(...args: any[]) => any>()
  const disconnect = vi.fn<(...args: any[]) => any>()

  const port = {
    name,
    postMessage,
    disconnect,
    onMessage: {
      addListener: vi.fn<(...args: any[]) => any>(
        (listener: (message: unknown) => void | Promise<void>) => {
          messageListener = listener
        },
      ),
      removeListener: vi.fn<(...args: any[]) => any>(
        (listener: (message: unknown) => void | Promise<void>) => {
          if (messageListener === listener) {
            messageListener = undefined
          }
        },
      ),
    },
    onDisconnect: {
      addListener: vi.fn<(...args: any[]) => any>((listener: () => void) => {
        disconnectListener = listener
      }),
      removeListener: vi.fn<(...args: any[]) => any>((listener: () => void) => {
        if (disconnectListener === listener) {
          disconnectListener = undefined
        }
      }),
    },
  }

  return {
    port,
    postMessage,
    disconnect,
    async emitMessage(message: unknown) {
      if (!messageListener) {
        throw new Error("Port message listener is not registered")
      }
      await messageListener(message)
    },
    emitDisconnect() {
      disconnectListener?.()
    },
  }
}

describe("background-stream", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it.each([undefined, null, "", "unknownFeature", "toString"])(
    "rejects an invalid hosted feature (%s) at the stream port before calling a provider",
    async (hostedFeature) => {
      const { handleStreamTextPort } = await import("../background-stream")
      const mockPort = createMockPort("stream-text")
      handleStreamTextPort(mockPort.port as never)
      await mockPort.emitMessage({
        type: "start",
        streamRequestId: "invalid-hosted-route",
        payload: {
          providerKind: "system",
          providerId: "read-frog-free-ai",
          hostedFeature,
          instructions: "Translate",
          prompt: "Hello",
        },
      })
      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: "error",
        streamRequestId: "invalid-hosted-route",
        error: { message: "Invalid stream start payload" },
      })
      expect(hostedStreamTextMock).not.toHaveBeenCalled()
      expect(getModelByIdMock).not.toHaveBeenCalled()
      expect(streamTextMock).not.toHaveBeenCalled()
    },
  )

  it("rejects a built-in provider disguised as a local stream", async () => {
    const { handleStreamTextPort } = await import("../background-stream")
    const mockPort = createMockPort("stream-text")
    handleStreamTextPort(mockPort.port as never)
    await mockPort.emitMessage({
      type: "start",
      streamRequestId: "wrong-provider-kind",
      payload: { providerKind: "local", providerId: "read-frog-free-ai", prompt: "Hello" },
    })
    expect(mockPort.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }))
    expect(hostedStreamTextMock).not.toHaveBeenCalled()
    expect(getModelByIdMock).not.toHaveBeenCalled()
  })

  it("streams structured object output from background", async () => {
    getModelByIdMock.mockResolvedValue("mock-model")
    streamTextMock.mockReturnValue({
      stream: (async function* () {
        yield { type: "text-delta", text: '{"score":97' }
        yield { type: "text-delta", text: ',"summary":"Strong argument structure"}' }
        yield { type: "finish", finishReason: "stop" }
      })(),
      get output() {
        throw new Error("structured stream should not consume output separately")
      },
      get partialOutputStream() {
        throw new Error("structured stream should not consume partialOutputStream separately")
      },
    })

    const chunkSnapshots: BackgroundStructuredObjectStreamSnapshot[] = []
    const { runStructuredObjectStreamInBackground } = await import("../background-stream")
    const result = await runStructuredObjectStreamInBackground(
      {
        providerId: "openai-default",
        prompt: "Analyze selection",
        outputSchema: [
          { name: "score", type: "number" },
          { name: "summary", type: "string" },
        ],
      },
      {
        onChunk: (snapshot) => {
          chunkSnapshots.push(snapshot)
        },
      },
    )

    expect(getModelByIdMock).toHaveBeenCalledWith("openai-default")
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "mock-model",
        prompt: "Analyze selection",
      }),
    )
    expect(result).toEqual({
      output: {
        score: 97,
        summary: "Strong argument structure",
      },
      thinking: {
        status: "complete",
        text: "",
      },
    })
    expect(chunkSnapshots).toEqual([
      {
        output: { score: 97 },
        thinking: {
          status: "complete",
          text: "",
        },
      },
      {
        output: { score: 97, summary: "Strong argument structure" },
        thinking: {
          status: "complete",
          text: "",
        },
      },
    ])

    const schemaArg = outputObjectMock.mock.calls[0]![0].schema as {
      safeParse: (value: unknown) => { success: boolean }
    }
    expect(
      schemaArg.safeParse({
        score: 99,
        summary: "text",
      }).success,
    ).toBe(true)
    expect(
      schemaArg.safeParse({
        score: null,
        summary: null,
      }).success,
    ).toBe(true)
    expect(
      schemaArg.safeParse({
        score: "99",
        summary: "text",
      }).success,
    ).toBe(false)
  })

  it("streams hosted structured object output from background", async () => {
    hostedStreamStructuredObjectMock.mockResolvedValue(
      (async function* () {
        yield { type: "start" }
        yield { type: "text-delta", id: "text-1", text: '{"score":97' }
        yield { type: "start-step", request: {}, warnings: [] }
        yield { type: "reasoning-start", id: "reasoning-1" }
        yield { type: "reasoning-delta", id: "reasoning-1", text: "checking context" }
        yield { type: "reasoning-end", id: "reasoning-1" }
        yield { type: "text-delta", id: "text-1", text: ',"summary":"Strong argument structure"}' }
        yield { type: "finish", finishReason: "stop" }
      })(),
    )

    const chunkSnapshots: BackgroundStructuredObjectStreamSnapshot[] = []
    const { runStructuredObjectStreamInBackground } = await import("../background-stream")
    const result = await runStructuredObjectStreamInBackground(
      {
        providerId: "read-frog-advance-ai",
        modelTier: "advance",
        requestId: "123e4567-e89b-42d3-a456-426614174000",
        instructions: "Return structured data",
        prompt: "Analyze selection",
        outputSchema: [
          { name: "score", type: "number" },
          { name: "summary", type: "string" },
        ],
      },
      {
        onChunk: (snapshot) => {
          chunkSnapshots.push(snapshot)
        },
      },
    )

    expect(getModelByIdMock).not.toHaveBeenCalled()
    expect(hostedStreamStructuredObjectMock).toHaveBeenCalledWith(
      {
        instructions: "Return structured data",
        prompt: "Analyze selection",
        outputSchema: [
          { name: "score", type: "number" },
          { name: "summary", type: "string" },
        ],
        temperature: undefined,
        modelTier: "advance",
        requestId: "123e4567-e89b-42d3-a456-426614174000",
      },
      { signal: undefined },
    )
    expect(result).toEqual({
      output: {
        score: 97,
        summary: "Strong argument structure",
      },
      thinking: {
        status: "complete",
        text: "checking context",
      },
    })
    expect(chunkSnapshots.at(-1)).toEqual(result)
  })

  it("surfaces guest hosted rate limit errors with the sign-in message", async () => {
    hostedStreamStructuredObjectMock.mockResolvedValue(
      (async function* () {
        yield { type: "start" }
        throw Object.assign(new Error("Too Many Requests"), {
          code: "TOO_MANY_REQUESTS",
          status: 429,
          data: { quotaScope: "guest", retryAfterMs: 42_000 },
        })
      })(),
    )

    const { runStructuredObjectStreamInBackground } = await import("../background-stream")

    let caught: unknown
    try {
      await runStructuredObjectStreamInBackground({
        providerId: "read-frog-free-ai",
        instructions: "Return structured data",
        prompt: "Analyze selection",
        outputSchema: [{ name: "score", type: "number" }],
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toContain("hostedAi.errors.guestRateLimited")
    expect(
      defaultRequestRetryPolicy.decide(caught, {
        retryCount: 0,
        maxRetries: 2,
        baseRetryDelayMs: 1_000,
        now: Date.now(),
        rateLimitRetryCount: 0,
        consecutiveRateLimits: 0,
      }),
    ).toEqual({ action: "pause-and-retry", pauseMs: 42_000 })
  })

  it("does not normalize billing-period quota exhaustion into short-term traffic limiting", async () => {
    hostedStreamStructuredObjectMock.mockResolvedValue(
      (async function* () {
        yield { type: "start" }
        throw Object.assign(new Error("Quota exhausted"), {
          code: "HOSTED_AI_QUOTA_EXHAUSTED",
          status: 429,
          data: { quotaScope: "guest", retryAfterMs: 42_000 },
        })
      })(),
    )

    const { runStructuredObjectStreamInBackground } = await import("../background-stream")

    let caught: unknown
    try {
      await runStructuredObjectStreamInBackground({
        providerId: "read-frog-free-ai",
        modelTier: "normal",
        requestId: "123e4567-e89b-42d3-a456-426614174001",
        instructions: "Return structured data",
        prompt: "Analyze selection",
        outputSchema: [{ name: "score", type: "number" }],
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toContain("hostedAi.availability.quotaExhausted")
    expect((caught as Error & { retryAfterMs?: number }).retryAfterMs).toBeUndefined()
    expect(
      defaultRequestRetryPolicy.decide(caught, {
        retryCount: 0,
        maxRetries: 2,
        baseRetryDelayMs: 1_000,
        now: Date.now(),
        rateLimitRetryCount: 0,
        consecutiveRateLimits: 0,
      }),
    ).toEqual({ action: "fail", failQueue: true })
  })

  it.each([
    {
      code: "HOSTED_AI_TIER_RESTRICTED",
      status: 403,
      messageKey: "hostedAi.availability.ultraRequired",
    },
    {
      code: "UNAUTHORIZED",
      status: 401,
      messageKey: "hostedAi.availability.authenticationRequired",
    },
  ])(
    "drains the backlog on $code without leaking the transport status",
    async ({ code, status, messageKey }) => {
      hostedStreamStructuredObjectMock.mockResolvedValue(
        (async function* () {
          yield { type: "start" }
          throw Object.assign(new Error("denied"), { code, status, data: {} })
        })(),
      )

      const { runStructuredObjectStreamInBackground } = await import("../background-stream")

      let caught: unknown
      try {
        await runStructuredObjectStreamInBackground({
          providerId: "read-frog-free-ai",
          modelTier: "normal",
          requestId: "123e4567-e89b-42d3-a456-426614174002",
          instructions: "Return structured data",
          prompt: "Analyze selection",
          outputSchema: [{ name: "score", type: "number" }],
        })
      } catch (error) {
        caught = error
      }

      expect(caught).toBeInstanceOf(Error)
      expect((caught as Error).message).toContain(messageKey)
      expect((caught as Error & { retryAfterMs?: number }).retryAfterMs).toBeUndefined()
      expect(
        defaultRequestRetryPolicy.decide(caught, {
          retryCount: 0,
          maxRetries: 2,
          baseRetryDelayMs: 1_000,
          now: Date.now(),
          rateLimitRetryCount: 0,
          consecutiveRateLimits: 0,
        }),
      ).toEqual({ action: "fail", failQueue: true })
    },
  )

  // Denials arrive two ways and they are normalized by different code. Failing
  // to open the stream lands in each path's own `catch` around
  // `normalizeHostedAiError` — four independent call sites, so covering one
  // says nothing about the others. Failing mid-stream lands in the shared
  // `normalizeHostedPartStreamErrors`. The case above only exercises the
  // second; this covers both for the text path, which is what page
  // translation, selection translation, subtitles and input translation run
  // on. Either one coming back retryable makes the queue burn its whole
  // backoff budget on a pricing wall that never moves.
  it.each([
    {
      code: "HOSTED_AI_TIER_RESTRICTED",
      status: 403,
      messageKey: "hostedAi.availability.ultraRequired",
    },
    {
      code: "UNAUTHORIZED",
      status: 401,
      messageKey: "hostedAi.availability.authenticationRequired",
    },
  ])(
    "drains the backlog on $code from a hosted text stream",
    async ({ code, status, messageKey }) => {
      const denial = () => Object.assign(new Error("denied"), { code, status, data: {} })
      const { runStreamTextInBackground } = await import("../background-stream")

      const runAndCatch = async () => {
        let caught: unknown
        try {
          await runStreamTextInBackground({
            providerKind: "system",
            hostedFeature: "pageTranslation",
            providerId: "read-frog-free-ai",
            modelTier: "normal",
            requestId: "123e4567-e89b-42d3-a456-426614174003",
            instructions: "Translate text",
            prompt: "Hello world",
          })
        } catch (error) {
          caught = error
        }
        return caught
      }

      const expectQueueFatal = (caught: unknown) => {
        expect(caught).toBeInstanceOf(Error)
        expect((caught as Error).message).toContain(messageKey)
        // A retryAfterMs would route this into the rate-limit pause path instead.
        expect((caught as Error & { retryAfterMs?: number }).retryAfterMs).toBeUndefined()
        expect(
          defaultRequestRetryPolicy.decide(caught, {
            retryCount: 0,
            maxRetries: 2,
            baseRetryDelayMs: 1_000,
            now: Date.now(),
            rateLimitRetryCount: 0,
            consecutiveRateLimits: 0,
          }),
        ).toEqual({ action: "fail", failQueue: true })
      }

      // Refused before the stream opens — the text path's own catch.
      hostedStreamTextMock.mockRejectedValueOnce(denial())
      expectQueueFatal(await runAndCatch())

      // Refused after the first part — the shared mid-stream normalizer.
      hostedStreamTextMock.mockResolvedValueOnce(
        (async function* () {
          yield { type: "start" }
          throw denial()
        })(),
      )
      expectQueueFatal(await runAndCatch())
    },
  )

  it("treats structured object streams without finish as protocol errors", async () => {
    getModelByIdMock.mockResolvedValue("mock-model")
    streamTextMock.mockReturnValue({
      stream: (async function* () {
        yield { type: "text-delta", text: '{"score":97}' }
      })(),
    })

    const { runStructuredObjectStreamInBackground } = await import("../background-stream")

    await expect(
      runStructuredObjectStreamInBackground({
        providerId: "openai-default",
        prompt: "Analyze selection",
        outputSchema: [{ name: "score", type: "number" }],
      }),
    ).rejects.toThrow("Invalid AI stream response.")
  })

  it("treats length-finished structured object streams as truncated output", async () => {
    getModelByIdMock.mockResolvedValue("mock-model")
    streamTextMock.mockReturnValue({
      stream: (async function* () {
        yield { type: "text-delta", text: '{"summary":"partial but parseable' }
        yield { type: "finish", finishReason: "length" }
      })(),
    })

    const { runStructuredObjectStreamInBackground } = await import("../background-stream")

    await expect(
      runStructuredObjectStreamInBackground({
        providerId: "openai-default",
        prompt: "Analyze selection",
        outputSchema: [{ name: "summary", type: "string" }],
      }),
    ).rejects.toThrow(
      "The AI output reached the length limit. Please reduce the requested output length and try again.",
    )
  })

  it("treats text streams without finish as protocol errors", async () => {
    getModelByIdMock.mockResolvedValue("mock-model")
    streamTextMock.mockReturnValue({
      stream: (async function* () {
        yield { type: "text-delta", text: "Hello" }
      })(),
    })

    const { runStreamTextInBackground } = await import("../background-stream")

    await expect(
      runStreamTextInBackground({
        providerKind: "local",
        providerId: "openai-default",
        prompt: "Say hello",
      }),
    ).rejects.toThrow("Invalid AI stream response.")
  })

  it("treats length-finished text streams as truncated output", async () => {
    getModelByIdMock.mockResolvedValue("mock-model")
    streamTextMock.mockReturnValue({
      stream: (async function* () {
        yield { type: "text-delta", text: "partial" }
        yield { type: "finish", finishReason: "length" }
      })(),
    })

    const { runStreamTextInBackground } = await import("../background-stream")

    await expect(
      runStreamTextInBackground({
        providerKind: "local",
        providerId: "openai-default",
        prompt: "Say hello",
      }),
    ).rejects.toThrow(
      "The AI output reached the length limit. Please reduce the requested output length and try again.",
    )
  })

  it("streams text via background stream port handler", async () => {
    getModelByIdMock.mockResolvedValue("mock-model")
    streamTextMock.mockReturnValue({
      stream: (async function* () {
        yield { type: "text-delta", text: "Hello" }
        yield { type: "text-delta", text: " world" }
        yield { type: "finish", finishReason: "stop" }
      })(),
      output: Promise.resolve("Hello world"),
    })

    const { handleStreamTextPort } = await import("../background-stream")
    const mockPort = createMockPort("stream-text")

    handleStreamTextPort(mockPort.port as never)
    await mockPort.emitMessage({
      type: "start",
      streamRequestId: "req-text-1",
      payload: {
        providerKind: "local",
        providerId: "openai-default",
        instructions: "Be concise",
        prompt: "Say hello",
        reasoning: "low",
      },
    })

    expect(getModelByIdMock).toHaveBeenCalledWith("openai-default")
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: "Be concise",
        reasoning: "low",
      }),
    )
    expect(mockPort.postMessage).toHaveBeenNthCalledWith(1, {
      type: "chunk",
      streamRequestId: "req-text-1",
      data: {
        output: "Hello",
        thinking: {
          status: "complete",
          text: "",
        },
      },
    })
    expect(mockPort.postMessage).toHaveBeenNthCalledWith(2, {
      type: "chunk",
      streamRequestId: "req-text-1",
      data: {
        output: "Hello world",
        thinking: {
          status: "complete",
          text: "",
        },
      },
    })
    expect(mockPort.postMessage).toHaveBeenNthCalledWith(3, {
      type: "done",
      streamRequestId: "req-text-1",
      data: {
        output: "Hello world",
        thinking: {
          status: "complete",
          text: "",
        },
      },
    })
    expect(mockPort.disconnect).toHaveBeenCalledTimes(1)
  })

  it("uses the supplied local snapshot for both the model and its generation settings", async () => {
    const providerConfig = {
      ...DEFAULT_PROVIDER_CONFIG.openai,
      temperature: 0.3,
      reasoning: "low" as const,
    }
    // Storage may now contain another model, or the provider may have been deleted.
    getModelByIdMock.mockRejectedValue(new Error("Provider deleted"))
    getLanguageModelForConfigMock.mockReturnValue("snapshot-model")
    streamTextMock.mockReturnValue({
      stream: (async function* () {
        yield { type: "text-delta", text: "Snapshot summary" }
        yield { type: "finish", finishReason: "stop" }
      })(),
    })
    const { handleStreamTextPort } = await import("../background-stream")
    const mockPort = createMockPort("stream-text")
    handleStreamTextPort(mockPort.port as never)
    await mockPort.emitMessage({
      type: "start",
      streamRequestId: "summary-snapshot",
      payload: {
        providerKind: "local",
        providerId: providerConfig.id,
        providerConfig,
        instructions: "Summarize",
        prompt: "Video contents",
        temperature: 0.9,
        reasoning: "high",
      },
    })

    expect(getModelByIdMock).not.toHaveBeenCalled()
    expect(getLanguageModelForConfigMock).toHaveBeenCalledWith(providerConfig)
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "snapshot-model",
        temperature: 0.3,
        reasoning: "low",
      }),
    )
    expect(streamTextMock.mock.calls[0]![0]).not.toHaveProperty("providerConfig")
    expect(mockPort.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "done",
        data: expect.objectContaining({ output: "Snapshot summary" }),
      }),
    )
  })

  it.each([
    {
      providerKind: "local",
      providerId: "other-id",
      providerConfig: DEFAULT_PROVIDER_CONFIG.openai,
    },
    {
      providerKind: "local",
      providerId: DEFAULT_PROVIDER_CONFIG["microsoft-translate"].id,
      providerConfig: DEFAULT_PROVIDER_CONFIG["microsoft-translate"],
    },
    {
      providerKind: "system",
      hostedFeature: "pageTranslation",
      providerId: "read-frog-free-ai",
      providerConfig: { ...DEFAULT_PROVIDER_CONFIG.openai, id: "read-frog-free-ai" },
    },
  ])("rejects invalid local snapshots before starting a stream", async (payload) => {
    const { handleStreamTextPort } = await import("../background-stream")
    const mockPort = createMockPort("stream-text")
    handleStreamTextPort(mockPort.port as never)
    await mockPort.emitMessage({ type: "start", streamRequestId: "invalid-snapshot", payload })

    expect(streamTextMock).not.toHaveBeenCalled()
    expect(mockPort.postMessage).toHaveBeenCalledWith({
      type: "error",
      streamRequestId: "invalid-snapshot",
      error: { message: "Invalid stream start payload" },
    })
  })

  it("streams hosted text output from background", async () => {
    hostedStreamTextMock.mockResolvedValue(
      (async function* () {
        yield { type: "start" }
        yield { type: "reasoning-start", id: "reasoning-1" }
        yield { type: "reasoning-delta", id: "reasoning-1", text: "checking language" }
        yield { type: "reasoning-end", id: "reasoning-1" }
        yield { type: "text-delta", id: "text-1", text: "Hola" }
        yield { type: "text-delta", id: "text-1", text: " mundo" }
        yield { type: "finish", finishReason: "stop" }
      })(),
    )

    const chunkSnapshots: BackgroundTextStreamSnapshot[] = []
    const { runStreamTextInBackground } = await import("../background-stream")
    const result = await runStreamTextInBackground(
      {
        providerKind: "system",
        hostedFeature: "pageTranslation",
        providerId: "read-frog-free-ai",
        modelTier: "normal",
        requestId: "123e4567-e89b-42d3-a456-426614174002",
        instructions: "Translate text",
        prompt: "Hello world",
      },
      {
        onChunk: (snapshot) => {
          chunkSnapshots.push(snapshot)
        },
      },
    )

    expect(getModelByIdMock).not.toHaveBeenCalled()
    expect(hostedStreamTextMock).toHaveBeenCalledWith(
      {
        instructions: "Translate text",
        prompt: "Hello world",
        temperature: undefined,
        modelTier: "normal",
        requestId: "123e4567-e89b-42d3-a456-426614174002",
      },
      { signal: undefined },
    )
    // Absent hostedFeature routes to the page translation procedure.
    expect(hostedSelectionStreamTextMock).not.toHaveBeenCalled()
    expect(result).toEqual({
      output: "Hola mundo",
      thinking: {
        status: "complete",
        text: "checking language",
      },
    })
    expect(chunkSnapshots.at(-1)).toEqual(result)
  })

  it("routes hosted text streams with an explicit pageTranslation feature to the translate procedure", async () => {
    hostedStreamTextMock.mockResolvedValue(
      (async function* () {
        yield { type: "start" }
        yield { type: "text-delta", id: "text-1", text: "Hola" }
        yield { type: "finish", finishReason: "stop" }
      })(),
    )

    const { runStreamTextInBackground } = await import("../background-stream")
    const result = await runStreamTextInBackground({
      providerKind: "system",
      providerId: "read-frog-free-ai",
      hostedFeature: "pageTranslation",
      instructions: "Translate text",
      prompt: "Hello world",
    })

    expect(hostedStreamTextMock).toHaveBeenCalledTimes(1)
    expect(hostedSelectionStreamTextMock).not.toHaveBeenCalled()
    expect(getModelByIdMock).not.toHaveBeenCalled()
    expect(result.output).toBe("Hola")
  })

  it("routes hosted selectionTranslation text streams to the selectionTranslation procedure", async () => {
    hostedSelectionStreamTextMock.mockResolvedValue(
      (async function* () {
        yield { type: "start" }
        yield { type: "text-delta", id: "text-1", text: "Hola" }
        yield { type: "text-delta", id: "text-1", text: " mundo" }
        yield { type: "finish", finishReason: "stop" }
      })(),
    )

    const { runStreamTextInBackground } = await import("../background-stream")
    const result = await runStreamTextInBackground({
      providerKind: "system",
      providerId: "read-frog-free-ai",
      hostedFeature: "selectionTranslation",
      modelTier: "normal",
      requestId: "123e4567-e89b-42d3-a456-426614174003",
      instructions: "Translate text",
      prompt: "Hello world",
    })

    expect(hostedStreamTextMock).not.toHaveBeenCalled()
    // Exact wire payload: hostedFeature only selects the procedure and must
    // never ride along into the strict contract input.
    expect(hostedSelectionStreamTextMock).toHaveBeenCalledWith(
      {
        instructions: "Translate text",
        prompt: "Hello world",
        temperature: undefined,
        modelTier: "normal",
        requestId: "123e4567-e89b-42d3-a456-426614174003",
      },
      { signal: undefined },
    )
    expect(getModelByIdMock).not.toHaveBeenCalled()
    expect(result).toEqual({
      output: "Hola mundo",
      thinking: { status: "complete", text: "" },
    })
  })

  it("ends the thinking phase at the first output delta when no reasoning is emitted", async () => {
    hostedStreamTextMock.mockResolvedValue(
      (async function* () {
        yield { type: "start" }
        yield { type: "text-delta", id: "text-1", text: "Hola" }
        yield { type: "text-delta", id: "text-1", text: " mundo" }
        yield { type: "finish", finishReason: "stop" }
      })(),
    )

    const chunkSnapshots: BackgroundTextStreamSnapshot[] = []
    const { runStreamTextInBackground } = await import("../background-stream")
    await runStreamTextInBackground(
      {
        providerKind: "system",
        hostedFeature: "pageTranslation",
        providerId: "read-frog-free-ai",
        instructions: "Translate text",
        prompt: "Hello world",
      },
      {
        onChunk: (snapshot) => {
          chunkSnapshots.push(snapshot)
        },
      },
    )

    expect(chunkSnapshots[0]).toEqual({
      output: "Hola",
      thinking: { status: "complete", text: "" },
    })
  })

  it("reopens the thinking phase when reasoning arrives after output", async () => {
    hostedStreamTextMock.mockResolvedValue(
      (async function* () {
        yield { type: "start" }
        yield { type: "text-delta", id: "text-1", text: "Hola" }
        yield { type: "reasoning-delta", id: "reasoning-1", text: "second guess" }
        yield { type: "text-delta", id: "text-1", text: " mundo" }
        yield { type: "finish", finishReason: "stop" }
      })(),
    )

    const chunkSnapshots: BackgroundTextStreamSnapshot[] = []
    const { runStreamTextInBackground } = await import("../background-stream")
    await runStreamTextInBackground(
      {
        providerKind: "system",
        providerId: "read-frog-free-ai",
        hostedFeature: "pageTranslation",
        instructions: "Translate text",
        prompt: "Hello world",
      },
      {
        onChunk: (snapshot) => {
          chunkSnapshots.push(snapshot)
        },
      },
    )

    expect(chunkSnapshots.map((snapshot) => snapshot.thinking)).toEqual([
      { status: "complete", text: "" },
      { status: "thinking", text: "second guess" },
      { status: "complete", text: "second guess" },
    ])
  })

  it("prefers stream onError root cause and posts error once", async () => {
    getModelByIdMock.mockResolvedValue("mock-model")
    const rootCause = Object.assign(new Error("Incorrect API key provided"), {
      responseBody: '{"error":{"message":"Incorrect API key provided"}}',
    })

    streamTextMock.mockImplementation(
      (options: { onError?: (event: { error: unknown }) => void }) => {
        options.onError?.({ error: rootCause })
        return {
          stream: (async function* () {})(),
          get output() {
            throw new Error("text stream should not consume output separately")
          },
        }
      },
    )

    const { handleStreamTextPort } = await import("../background-stream")
    const mockPort = createMockPort("stream-text")

    handleStreamTextPort(mockPort.port as never)
    await mockPort.emitMessage({
      type: "start",
      streamRequestId: "req-text-error",
      payload: {
        providerKind: "local",
        providerId: "openai-default",
        prompt: "Say hello",
      },
    })

    const errorMessages = mockPort.postMessage.mock.calls
      .map((call) => call[0] as { type: string; error?: unknown })
      .filter((message) => message.type === "error")

    expect(errorMessages).toHaveLength(1)
    expect(errorMessages[0]).toMatchObject({
      type: "error",
      streamRequestId: "req-text-error",
      error: {
        message: "Incorrect API key provided",
      },
    })
    expect(mockPort.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "done" }))
  })

  it("keeps outer catch as fallback for pre-stream errors", async () => {
    getModelByIdMock.mockRejectedValue(new Error("Model is undefined"))
    const { handleStreamTextPort } = await import("../background-stream")
    const mockPort = createMockPort("stream-text")

    handleStreamTextPort(mockPort.port as never)
    await mockPort.emitMessage({
      type: "start",
      streamRequestId: "req-text-pre-stream-error",
      payload: {
        providerKind: "local",
        providerId: "openai-default",
        prompt: "Say hello",
      },
    })

    expect(mockPort.postMessage).toHaveBeenCalledWith({
      type: "error",
      streamRequestId: "req-text-pre-stream-error",
      error: {
        message: "Model is undefined",
      },
    })
    expect(mockPort.disconnect).toHaveBeenCalledTimes(1)
  })

  it("treats stream port disconnect aborts as expected cancellation", async () => {
    getModelByIdMock.mockResolvedValue("mock-model")
    let streamSignal: AbortSignal | undefined

    streamTextMock.mockImplementation((options: { abortSignal?: AbortSignal }) => {
      streamSignal = options.abortSignal
      return {
        stream: {
          [Symbol.asyncIterator]() {
            return {
              async next() {
                await new Promise<void>((_resolve, reject) => {
                  options.abortSignal?.addEventListener("abort", () => {
                    reject(options.abortSignal?.reason ?? new DOMException("aborted", "AbortError"))
                  })
                })
                return { done: true, value: undefined }
              },
            }
          },
        },
        output: new Promise<string>(() => {}),
      }
    })

    const { handleStreamTextPort } = await import("../background-stream")
    const mockPort = createMockPort("stream-text")

    handleStreamTextPort(mockPort.port as never)
    const startPromise = mockPort.emitMessage({
      type: "start",
      streamRequestId: "req-text-abort",
      payload: {
        providerKind: "local",
        providerId: "openai-default",
        prompt: "Say hello",
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(streamTextMock).toHaveBeenCalledTimes(1)

    mockPort.emitDisconnect()
    await startPromise

    expect(streamSignal?.aborted).toBe(true)
    expect(loggerErrorMock).not.toHaveBeenCalled()
    expect(mockPort.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
      }),
    )
  })

  it("returns error for invalid text start payload and disconnects", async () => {
    const { handleStreamTextPort } = await import("../background-stream")
    const mockPort = createMockPort("stream-text")

    handleStreamTextPort(mockPort.port as never)
    await mockPort.emitMessage({
      type: "start",
      streamRequestId: "req-text-invalid",
      payload: {
        providerKind: "local",
        providerId: "   ",
      },
    })

    expect(mockPort.postMessage).toHaveBeenCalledWith({
      type: "error",
      streamRequestId: "req-text-invalid",
      error: { message: "Invalid stream start payload" },
    })
    expect(mockPort.disconnect).toHaveBeenCalledTimes(1)
    expect(getModelByIdMock).not.toHaveBeenCalled()
  })

  it("returns error for invalid structured payload and disconnects", async () => {
    const { handleStreamStructuredObjectPort } = await import("../background-stream")

    const emptySchemaPort = createMockPort("stream-structured-object")
    handleStreamStructuredObjectPort(emptySchemaPort.port as never)
    await emptySchemaPort.emitMessage({
      type: "start",
      streamRequestId: "req-structured-empty",
      payload: {
        providerId: "openai-default",
        outputSchema: [],
      },
    })

    expect(emptySchemaPort.postMessage).toHaveBeenCalledWith({
      type: "error",
      streamRequestId: "req-structured-empty",
      error: { message: "Invalid stream start payload" },
    })
    expect(emptySchemaPort.disconnect).toHaveBeenCalledTimes(1)

    const duplicateKeyPort = createMockPort("stream-structured-object")
    handleStreamStructuredObjectPort(duplicateKeyPort.port as never)
    await duplicateKeyPort.emitMessage({
      type: "start",
      streamRequestId: "req-structured-duplicate",
      payload: {
        providerId: "openai-default",
        outputSchema: [
          { name: "score ", type: "number" },
          { name: "score", type: "string" },
        ],
      },
    })

    expect(duplicateKeyPort.postMessage).toHaveBeenCalledWith({
      type: "error",
      streamRequestId: "req-structured-duplicate",
      error: { message: "Invalid stream start payload" },
    })
    expect(duplicateKeyPort.disconnect).toHaveBeenCalledTimes(1)
  })

  it("disconnects invalid start message without streamRequestId and cannot post error", async () => {
    const { handleStreamTextPort } = await import("../background-stream")
    const mockPort = createMockPort("stream-text")

    handleStreamTextPort(mockPort.port as never)
    await mockPort.emitMessage({
      type: "start",
      payload: {
        providerKind: "local",
        providerId: "openai-default",
      },
    })

    expect(mockPort.postMessage).not.toHaveBeenCalled()
    expect(mockPort.disconnect).toHaveBeenCalledTimes(1)
  })

  it("ignores ping messages before stream starts", async () => {
    const { handleStreamTextPort } = await import("../background-stream")
    const mockPort = createMockPort("stream-text")

    handleStreamTextPort(mockPort.port as never)
    await mockPort.emitMessage({
      type: "ping",
      streamRequestId: "req-ping",
    })

    expect(mockPort.postMessage).not.toHaveBeenCalled()
    expect(mockPort.disconnect).not.toHaveBeenCalled()
  })

  it("streams note suggestions from the user's local provider", async () => {
    const envelope = {
      summaryFieldName: null,
      notes: [{ fields: [{ name: "Word", value: "ephemeral" }] }],
    }
    getModelByIdMock.mockResolvedValue("mock-model")
    streamTextMock.mockReturnValue({
      stream: (async function* () {
        yield { type: "text-delta", text: JSON.stringify(envelope) }
        yield { type: "finish", finishReason: "stop" }
      })(),
    })

    const { runNoteSuggestionStreamInBackground } = await import("../background-stream")
    const { noteSuggestionEnvelopeSchema } = await import("@/utils/note-suggestion/types")
    const result = await runNoteSuggestionStreamInBackground({
      providerId: "openai-default",
      instructions: "Suggest words",
      prompt: "Selection context",
    })

    expect(getModelByIdMock).toHaveBeenCalledWith("openai-default")
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "mock-model",
        instructions: "Suggest words",
        prompt: "Selection context",
      }),
    )
    expect(outputObjectMock).toHaveBeenCalledWith({ schema: noteSuggestionEnvelopeSchema })
    expect(result).toEqual({
      output: envelope,
      thinking: { status: "complete", text: "" },
    })
    expect(hostedStreamTextMock).not.toHaveBeenCalled()
    expect(hostedStreamStructuredObjectMock).not.toHaveBeenCalled()
  })

  it("streams hosted note suggestions and adapts the contract object into the envelope", async () => {
    const hostedObject = {
      action: {
        createNewDictionaryAction: false,
        targetActionId: null,
        summaryFieldName: "definition",
      },
      notes: [
        {
          fields: [
            { name: "Word", value: "ephemeral" },
            { name: "definition", value: "lasting a very short time" },
          ],
        },
      ],
    }
    const hostedObjectJson = JSON.stringify(hostedObject)
    hostedNoteSuggestionStreamMock.mockResolvedValue(
      (async function* () {
        yield { type: "start" }
        yield { type: "text-delta", id: "text-1", text: hostedObjectJson.slice(0, 40) }
        yield { type: "text-delta", id: "text-1", text: hostedObjectJson.slice(40) }
        yield { type: "finish", finishReason: "stop" }
      })(),
    )

    const { runNoteSuggestionStreamInBackground } = await import("../background-stream")
    const result = await runNoteSuggestionStreamInBackground({
      providerId: "read-frog-advance-ai",
      modelTier: "advance",
      requestId: "123e4567-e89b-42d3-a456-426614174010",
      instructions: "Suggest words",
      prompt: "Selection context",
    })

    expect(getModelByIdMock).not.toHaveBeenCalled()
    expect(streamTextMock).not.toHaveBeenCalled()
    expect(hostedStreamStructuredObjectMock).not.toHaveBeenCalled()
    expect(hostedNoteSuggestionStreamMock).toHaveBeenCalledWith(
      {
        instructions: "Suggest words",
        prompt: "Selection context",
        temperature: undefined,
        modelTier: "advance",
        requestId: "123e4567-e89b-42d3-a456-426614174010",
      },
      { signal: undefined },
    )
    // The contract's action.createNewDictionaryAction / action.targetActionId
    // are dropped in the envelope adaptation; only summaryFieldName survives.
    expect(result).toEqual({
      output: {
        summaryFieldName: "definition",
        notes: hostedObject.notes,
      },
      thinking: { status: "complete", text: "" },
    })
    expect(result.output).not.toHaveProperty("action")
  })

  it("defaults hosted note suggestion modelTier to normal when absent", async () => {
    const hostedObject = {
      action: {
        createNewDictionaryAction: false,
        targetActionId: null,
        summaryFieldName: null,
      },
      notes: [{ fields: [{ name: "Word", value: "ephemeral" }] }],
    }
    hostedNoteSuggestionStreamMock.mockResolvedValue(
      (async function* () {
        yield { type: "text-delta", id: "text-1", text: JSON.stringify(hostedObject) }
        yield { type: "finish", finishReason: "stop" }
      })(),
    )

    const { runNoteSuggestionStreamInBackground } = await import("../background-stream")
    await runNoteSuggestionStreamInBackground({
      providerId: "read-frog-free-ai",
      instructions: "Suggest words",
      prompt: "Selection context",
    })

    expect(hostedNoteSuggestionStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({ modelTier: "normal" }),
      { signal: undefined },
    )
  })

  it("rejects invalid hosted note suggestion input before calling the procedure", async () => {
    const { runNoteSuggestionStreamInBackground } = await import("../background-stream")

    // Missing instructions hits the shared guard for both provider kinds.
    let guardCaught: unknown
    try {
      await runNoteSuggestionStreamInBackground({
        providerId: "read-frog-free-ai",
        instructions: "",
        prompt: "Selection context",
      })
    } catch (error) {
      guardCaught = error
    }
    expect(guardCaught).toBeInstanceOf(Error)
    expect((guardCaught as Error & { code?: string }).code).toBe("invalid_request")
    expect((guardCaught as Error).message).toBe("Note suggestion requires instructions and prompt")

    // Whitespace-only instructions pass the guard but fail the contract parse.
    let contractCaught: unknown
    try {
      await runNoteSuggestionStreamInBackground({
        providerId: "read-frog-free-ai",
        instructions: "   ",
        prompt: "Selection context",
      })
    } catch (error) {
      contractCaught = error
    }
    expect(contractCaught).toBeInstanceOf(Error)
    expect((contractCaught as Error & { code?: string }).code).toBe("invalid_request")
    expect((contractCaught as Error).message).toBe("Invalid hosted AI request")

    expect(hostedNoteSuggestionStreamMock).not.toHaveBeenCalled()
    expect(streamTextMock).not.toHaveBeenCalled()
    expect(getModelByIdMock).not.toHaveBeenCalled()
  })

  it("normalizes hosted note suggestion quota exhaustion into an access-denied failure", async () => {
    hostedNoteSuggestionStreamMock.mockRejectedValue(
      Object.assign(new Error("Quota exhausted"), {
        code: "HOSTED_AI_QUOTA_EXHAUSTED",
        status: 429,
        data: { quotaScope: "user", retryAfterMs: 42_000 },
      }),
    )

    const { runNoteSuggestionStreamInBackground } = await import("../background-stream")

    let caught: unknown
    try {
      await runNoteSuggestionStreamInBackground({
        providerId: "read-frog-free-ai",
        modelTier: "normal",
        requestId: "123e4567-e89b-42d3-a456-426614174011",
        instructions: "Suggest words",
        prompt: "Selection context",
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toContain("hostedAi.availability.quotaExhausted")
    expect((caught as Error & { retryAfterMs?: number }).retryAfterMs).toBeUndefined()
    expect(
      defaultRequestRetryPolicy.decide(caught, {
        retryCount: 0,
        maxRetries: 2,
        baseRetryDelayMs: 1_000,
        now: Date.now(),
        rateLimitRetryCount: 0,
        consecutiveRateLimits: 0,
      }),
    ).toEqual({ action: "fail", failQueue: true })
  })

  it("propagates provider resolution failures for note suggestions", async () => {
    getModelByIdMock.mockRejectedValue(new Error("Provider missing-provider not found"))

    const { runNoteSuggestionStreamInBackground } = await import("../background-stream")

    await expect(
      runNoteSuggestionStreamInBackground({
        providerId: "missing-provider",
        instructions: "Suggest words",
        prompt: "Selection context",
      }),
    ).rejects.toThrow("Provider missing-provider not found")
    expect(streamTextMock).not.toHaveBeenCalled()
  })
})
