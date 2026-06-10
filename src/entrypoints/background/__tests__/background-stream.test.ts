import type { BackgroundStructuredObjectStreamSnapshot } from "@/types/background-stream"
import { beforeEach, describe, expect, it, vi } from "vitest"

const streamTextMock = vi.fn()
const outputObjectMock = vi.fn((params: Record<string, unknown>) => params)
const withLanguageModelByIdAPIKeyRotationMock = vi.fn()
const loggerErrorMock = vi.fn()
const parsePartialJsonMock = vi.fn(async (text: string | undefined) => {
  if (!text) {
    return { state: "undefined-input", value: undefined }
  }

  try {
    return { state: "successful-parse", value: JSON.parse(text) }
  }
  catch {
    try {
      return { state: "repaired-parse", value: JSON.parse(`${text}}`) }
    }
    catch {
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
  withLanguageModelByIdAPIKeyRotation: withLanguageModelByIdAPIKeyRotationMock,
}))

vi.mock("@/utils/logger", () => ({
  logger: {
    error: loggerErrorMock,
  },
}))

function createMockPort(name: string) {
  let messageListener: ((message: unknown) => void | Promise<void>) | undefined
  let disconnectListener: (() => void) | undefined

  const postMessage = vi.fn()
  const disconnect = vi.fn()

  const port = {
    name,
    postMessage,
    disconnect,
    onMessage: {
      addListener: vi.fn((listener: (message: unknown) => void | Promise<void>) => {
        messageListener = listener
      }),
      removeListener: vi.fn((listener: (message: unknown) => void | Promise<void>) => {
        if (messageListener === listener) {
          messageListener = undefined
        }
      }),
    },
    onDisconnect: {
      addListener: vi.fn((listener: () => void) => {
        disconnectListener = listener
      }),
      removeListener: vi.fn((listener: () => void) => {
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
    withLanguageModelByIdAPIKeyRotationMock.mockImplementation((_providerId, operation) => operation("mock-model"))
  })

  it("streams structured object output from background", async () => {
    streamTextMock.mockReturnValue({
      fullStream: (async function* () {
        yield { type: "text-delta", text: "{\"score\":97" }
        yield { type: "text-delta", text: ",\"summary\":\"Strong argument structure\"}" }
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

    expect(withLanguageModelByIdAPIKeyRotationMock).toHaveBeenCalledWith("openai-default", expect.any(Function), expect.any(Object))
    expect(streamTextMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "mock-model",
      prompt: "Analyze selection",
    }))
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
          status: "thinking",
          text: "",
        },
      },
      {
        output: { score: 97, summary: "Strong argument structure" },
        thinking: {
          status: "thinking",
          text: "",
        },
      },
    ])

    const schemaArg = outputObjectMock.mock.calls[0][0].schema as {
      safeParse: (value: unknown) => { success: boolean }
    }
    expect(schemaArg.safeParse({
      score: 99,
      summary: "text",
    }).success).toBe(true)
    expect(schemaArg.safeParse({
      score: null,
      summary: null,
    }).success).toBe(true)
    expect(schemaArg.safeParse({
      score: "99",
      summary: "text",
    }).success).toBe(false)
  })

  it("streams text via background stream port handler", async () => {
    streamTextMock.mockReturnValue({
      fullStream: (async function* () {
        yield { type: "text-delta", text: "Hello" }
        yield { type: "text-delta", text: " world" }
      })(),
      output: Promise.resolve("Hello world"),
    })

    const { handleStreamTextPort } = await import("../background-stream")
    const mockPort = createMockPort("stream-text")

    handleStreamTextPort(mockPort.port as never)
    await mockPort.emitMessage({
      type: "start",
      requestId: "req-text-1",
      payload: {
        providerId: "openai-default",
        prompt: "Say hello",
      },
    })

    expect(withLanguageModelByIdAPIKeyRotationMock).toHaveBeenCalledWith("openai-default", expect.any(Function), expect.any(Object))
    expect(mockPort.postMessage).toHaveBeenNthCalledWith(1, {
      type: "chunk",
      requestId: "req-text-1",
      data: {
        output: "Hello",
        thinking: {
          status: "thinking",
          text: "",
        },
      },
    })
    expect(mockPort.postMessage).toHaveBeenNthCalledWith(2, {
      type: "chunk",
      requestId: "req-text-1",
      data: {
        output: "Hello world",
        thinking: {
          status: "thinking",
          text: "",
        },
      },
    })
    expect(mockPort.postMessage).toHaveBeenNthCalledWith(3, {
      type: "done",
      requestId: "req-text-1",
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

  it("falls back to another API key when text streaming fails before emitting chunks", async () => {
    withLanguageModelByIdAPIKeyRotationMock.mockImplementation(async (_providerId, operation, options) => {
      try {
        return await operation("bad-model")
      }
      catch (error) {
        if (options.shouldFallback?.(error, { apiKey: "bad-key", apiKeyCount: 2, apiKeyIndex: 0 }) === false) {
          throw error
        }
        return operation("good-model")
      }
    })
    streamTextMock
      .mockReturnValueOnce({
        fullStream: (async function* () {
          throw new Error("bad key")
        })(),
      })
      .mockReturnValueOnce({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "Recovered" }
        })(),
      })

    const { handleStreamTextPort } = await import("../background-stream")
    const mockPort = createMockPort("stream-text")

    handleStreamTextPort(mockPort.port as never)
    await mockPort.emitMessage({
      type: "start",
      requestId: "req-text-fallback",
      payload: {
        providerId: "openai-default",
        prompt: "Say hello",
      },
    })

    expect(streamTextMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: "bad-model" }))
    expect(streamTextMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: "good-model" }))
    expect(mockPort.postMessage).toHaveBeenNthCalledWith(1, {
      type: "chunk",
      requestId: "req-text-fallback",
      data: {
        output: "Recovered",
        thinking: {
          status: "thinking",
          text: "",
        },
      },
    })
    expect(mockPort.postMessage).toHaveBeenNthCalledWith(2, {
      type: "done",
      requestId: "req-text-fallback",
      data: {
        output: "Recovered",
        thinking: {
          status: "complete",
          text: "",
        },
      },
    })
  })

  it("prefers stream onError root cause and posts error once", async () => {
    const rootCause = Object.assign(new Error("Incorrect API key provided"), {
      responseBody: "{\"error\":{\"message\":\"Incorrect API key provided\"}}",
    })

    streamTextMock.mockImplementation((options: {
      onError?: (event: { error: unknown }) => void
    }) => {
      options.onError?.({ error: rootCause })
      return {
        fullStream: (async function* () {})(),
        get output() {
          throw new Error("text stream should not consume output separately")
        },
      }
    })

    const { handleStreamTextPort } = await import("../background-stream")
    const mockPort = createMockPort("stream-text")

    handleStreamTextPort(mockPort.port as never)
    await mockPort.emitMessage({
      type: "start",
      requestId: "req-text-error",
      payload: {
        providerId: "openai-default",
        prompt: "Say hello",
      },
    })

    const errorMessages = mockPort.postMessage.mock.calls
      .map(call => call[0] as { type: string, error?: unknown })
      .filter(message => message.type === "error")

    expect(errorMessages).toHaveLength(1)
    expect(errorMessages[0]).toMatchObject({
      type: "error",
      requestId: "req-text-error",
      error: {
        message: "Incorrect API key provided",
      },
    })
    expect(mockPort.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "done" }))
  })

  it("keeps outer catch as fallback for pre-stream errors", async () => {
    withLanguageModelByIdAPIKeyRotationMock.mockRejectedValue(new Error("Model is undefined"))
    const { handleStreamTextPort } = await import("../background-stream")
    const mockPort = createMockPort("stream-text")

    handleStreamTextPort(mockPort.port as never)
    await mockPort.emitMessage({
      type: "start",
      requestId: "req-text-pre-stream-error",
      payload: {
        providerId: "openai-default",
        prompt: "Say hello",
      },
    })

    expect(mockPort.postMessage).toHaveBeenCalledWith({
      type: "error",
      requestId: "req-text-pre-stream-error",
      error: {
        message: "Model is undefined",
      },
    })
    expect(mockPort.disconnect).toHaveBeenCalledTimes(1)
  })

  it("treats stream port disconnect aborts as expected cancellation", async () => {
    let streamSignal: AbortSignal | undefined

    streamTextMock.mockImplementation((options: { abortSignal?: AbortSignal }) => {
      streamSignal = options.abortSignal
      return {
        fullStream: (async function* () {
          await new Promise<void>((_resolve, reject) => {
            options.abortSignal?.addEventListener("abort", () => {
              reject(options.abortSignal?.reason ?? new DOMException("aborted", "AbortError"))
            })
          })
        })(),
        output: new Promise<string>(() => {}),
      }
    })

    const { handleStreamTextPort } = await import("../background-stream")
    const mockPort = createMockPort("stream-text")

    handleStreamTextPort(mockPort.port as never)
    const startPromise = mockPort.emitMessage({
      type: "start",
      requestId: "req-text-abort",
      payload: {
        providerId: "openai-default",
        prompt: "Say hello",
      },
    })

    await new Promise(resolve => setTimeout(resolve, 0))
    expect(streamTextMock).toHaveBeenCalledTimes(1)

    mockPort.emitDisconnect()
    await startPromise

    expect(streamSignal?.aborted).toBe(true)
    expect(loggerErrorMock).not.toHaveBeenCalled()
    expect(mockPort.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({
      type: "error",
    }))
  })

  it("returns error for invalid text start payload and disconnects", async () => {
    const { handleStreamTextPort } = await import("../background-stream")
    const mockPort = createMockPort("stream-text")

    handleStreamTextPort(mockPort.port as never)
    await mockPort.emitMessage({
      type: "start",
      requestId: "req-text-invalid",
      payload: {
        providerId: "   ",
      },
    })

    expect(mockPort.postMessage).toHaveBeenCalledWith({
      type: "error",
      requestId: "req-text-invalid",
      error: { message: "Invalid stream start payload" },
    })
    expect(mockPort.disconnect).toHaveBeenCalledTimes(1)
    expect(withLanguageModelByIdAPIKeyRotationMock).not.toHaveBeenCalled()
  })

  it("returns error for invalid structured payload and disconnects", async () => {
    const { handleStreamStructuredObjectPort } = await import("../background-stream")

    const emptySchemaPort = createMockPort("stream-structured-object")
    handleStreamStructuredObjectPort(emptySchemaPort.port as never)
    await emptySchemaPort.emitMessage({
      type: "start",
      requestId: "req-structured-empty",
      payload: {
        providerId: "openai-default",
        outputSchema: [],
      },
    })

    expect(emptySchemaPort.postMessage).toHaveBeenCalledWith({
      type: "error",
      requestId: "req-structured-empty",
      error: { message: "Invalid stream start payload" },
    })
    expect(emptySchemaPort.disconnect).toHaveBeenCalledTimes(1)

    const duplicateKeyPort = createMockPort("stream-structured-object")
    handleStreamStructuredObjectPort(duplicateKeyPort.port as never)
    await duplicateKeyPort.emitMessage({
      type: "start",
      requestId: "req-structured-duplicate",
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
      requestId: "req-structured-duplicate",
      error: { message: "Invalid stream start payload" },
    })
    expect(duplicateKeyPort.disconnect).toHaveBeenCalledTimes(1)
  })

  it("disconnects invalid start message without requestId and cannot post error", async () => {
    const { handleStreamTextPort } = await import("../background-stream")
    const mockPort = createMockPort("stream-text")

    handleStreamTextPort(mockPort.port as never)
    await mockPort.emitMessage({
      type: "start",
      payload: {
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
      requestId: "req-ping",
    })

    expect(mockPort.postMessage).not.toHaveBeenCalled()
    expect(mockPort.disconnect).not.toHaveBeenCalled()
  })
})
