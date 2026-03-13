import type { BackgroundStructuredObjectStreamSnapshot } from "@/types/background-stream"
import { beforeEach, describe, expect, it, vi } from "vitest"

const streamTextMock = vi.fn()
const outputObjectMock = vi.fn((params: Record<string, unknown>) => params)
const getModelByIdMock = vi.fn()

class MockNoOutputGeneratedError extends Error {
  static isInstance(error: unknown): error is MockNoOutputGeneratedError {
    return error instanceof MockNoOutputGeneratedError
  }
}

vi.mock("ai", () => ({
  streamText: streamTextMock,
  NoOutputGeneratedError: MockNoOutputGeneratedError,
  Output: {
    object: outputObjectMock,
  },
}))

vi.mock("@/utils/providers/model", () => ({
  getModelById: getModelByIdMock,
}))

vi.mock("@/utils/logger", () => ({
  logger: {
    error: vi.fn(),
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
  })

  it("streams structured object output from background", async () => {
    getModelByIdMock.mockResolvedValue("mock-model")
    streamTextMock.mockReturnValue({
      partialOutputStream: (async function* () {
        yield { score: 97 }
        yield { score: 97, summary: "Strong argument structure" }
      })(),
      output: Promise.resolve({
        score: 97,
        summary: "Strong argument structure",
      }),
      fullStream: (async function* () {})(),
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
    getModelByIdMock.mockResolvedValue("mock-model")
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

    expect(getModelByIdMock).toHaveBeenCalledWith("openai-default")
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

  it("prefers stream onError root cause and posts error once", async () => {
    getModelByIdMock.mockResolvedValue("mock-model")
    const rootCause = Object.assign(new Error("Incorrect API key provided"), {
      responseBody: "{\"error\":{\"message\":\"Incorrect API key provided\"}}",
    })

    streamTextMock.mockImplementation((options: {
      onError?: (event: { error: unknown }) => void
    }) => {
      options.onError?.({ error: rootCause })
      return {
        fullStream: (async function* () {})(),
        output: Promise.reject(new MockNoOutputGeneratedError("No output generated. Check the stream for errors.")),
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
    getModelByIdMock.mockRejectedValue(new Error("Model is undefined"))
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
    expect(getModelByIdMock).not.toHaveBeenCalled()
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
