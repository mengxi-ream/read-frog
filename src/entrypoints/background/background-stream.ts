import type {
  BackgroundStreamPortName,
  BackgroundStreamTextPayload,
  StreamPortRequestMessage,
  StreamPortResponse,
  StreamPortStartMessage,
} from "@/types/background-stream"
import { streamText } from "ai"
import { BACKGROUND_STREAM_PORTS } from "@/types/background-stream"
import { logger } from "@/utils/logger"
import { getModelById } from "@/utils/providers/model"

export interface StreamOptions {
  signal?: AbortSignal
  onChunk?: (chunk: string, fullResponse: string) => void
}

interface ExtensionPort {
  name: string
  postMessage: (message: StreamPortResponse) => void
  disconnect: () => void
  onMessage: {
    addListener: (listener: (message: unknown) => void) => void
    removeListener: (listener: (message: unknown) => void) => void
  }
  onDisconnect: {
    addListener: (listener: () => void) => void
    removeListener: (listener: () => void) => void
  }
}

type StreamPortResponseWithoutRequestId
  = | { type: "chunk", data: string }
    | { type: "done", data: string }
    | { type: "error", error: string }

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === "string") {
    return error
  }
  return "Unexpected error occurred"
}

function createStreamPortHandler<TPayload>(
  streamFn: (payload: TPayload, options: StreamOptions) => Promise<string>,
  messageValidator: (msg: unknown) => msg is StreamPortStartMessage<TPayload>,
) {
  return (port: ExtensionPort) => {
    const abortController = new AbortController()
    let isActive = true
    let hasStarted = false
    let requestId: string | undefined
    let messageListener: ((rawMessage: unknown) => void) | undefined
    let disconnectListener: (() => void) | undefined

    const safePost = (response: StreamPortResponseWithoutRequestId) => {
      if (!isActive || abortController.signal.aborted || !requestId) {
        return
      }
      try {
        const message: StreamPortResponse = {
          ...response,
          requestId,
        }
        port.postMessage(message)
      }
      catch (error) {
        logger.error("[Background] Stream port post failed", error)
      }
    }

    const cleanup = () => {
      if (!isActive) {
        return
      }
      isActive = false
      if (messageListener) {
        port.onMessage.removeListener(messageListener)
      }
      if (disconnectListener) {
        port.onDisconnect.removeListener(disconnectListener)
      }
    }

    disconnectListener = () => {
      abortController.abort()
      cleanup()
    }

    messageListener = async (rawMessage: unknown) => {
      const message = rawMessage as StreamPortRequestMessage<TPayload> | undefined
      if (message?.type === "ping") {
        return
      }

      if (hasStarted) {
        return
      }

      if (!messageValidator(message)) {
        return
      }

      requestId = message.requestId
      hasStarted = true

      try {
        const result = await streamFn(message.payload, {
          signal: abortController.signal,
          onChunk: (_, fullResponse) => {
            safePost({ type: "chunk", data: fullResponse })
          },
        })

        if (!abortController.signal.aborted) {
          safePost({ type: "done", data: result })
        }
      }
      catch (error) {
        if (!abortController.signal.aborted) {
          safePost({ type: "error", error: getErrorMessage(error) })
        }
      }
      finally {
        cleanup()
        try {
          port.disconnect()
        }
        catch {
          // The port may already be closed due to a race with onDisconnect.
          // This is expected during cleanup and safe to ignore.
        }
      }
    }

    port.onMessage.addListener(messageListener)
    port.onDisconnect.addListener(disconnectListener)
  }
}

export async function runStreamTextInBackground(
  payload: BackgroundStreamTextPayload,
  options: StreamOptions = {},
) {
  const { providerId, ...streamTextParams } = payload
  const { signal, onChunk } = options

  if (signal?.aborted) {
    throw new DOMException("stream aborted", "AbortError")
  }

  const model = await getModelById(providerId)

  const result = await streamText({
    ...(streamTextParams as Parameters<typeof streamText>[0]),
    model,
    abortSignal: signal,
  })

  let fullResponse = ""
  for await (const delta of result.textStream) {
    if (signal?.aborted) {
      throw new DOMException("stream aborted", "AbortError")
    }

    fullResponse += delta
    onChunk?.(delta, fullResponse)
  }

  return fullResponse
}

export const handleStreamTextPort = createStreamPortHandler<BackgroundStreamTextPayload>(
  runStreamTextInBackground,
  (msg): msg is StreamPortStartMessage<BackgroundStreamTextPayload> => {
    const message = msg as StreamPortStartMessage<BackgroundStreamTextPayload> | undefined
    if (message?.type !== "start" || typeof message.requestId !== "string" || !message.payload) {
      return false
    }

    const payload = message.payload as Partial<BackgroundStreamTextPayload>
    return typeof payload.providerId === "string"
  },
)

type StreamPortHandler = (port: ExtensionPort) => void

export const BACKGROUND_STREAM_PORT_HANDLERS: Readonly<
  Record<BackgroundStreamPortName, StreamPortHandler>
> = {
  [BACKGROUND_STREAM_PORTS.streamText]: handleStreamTextPort,
}

export function dispatchBackgroundStreamPort(port: ExtensionPort): boolean {
  const handler = BACKGROUND_STREAM_PORT_HANDLERS[port.name as BackgroundStreamPortName]
  if (!handler) {
    return false
  }

  handler(port)
  return true
}
