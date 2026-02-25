import type {
  StreamPortRequestMessage,
  StreamPortResponse,
  StreamPortStartMessage,
} from "@/types/background-stream"
import { browser } from "#imports"
import { generateUUIDv4 } from "@/utils/crypto-polyfill"

function createRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return generateUUIDv4()
}

/**
 * Handles cleanup, abort signals, and disconnection automatically
 */
export function createPortStreamPromise<TResponse = string, TPayload = unknown>(
  portName: string,
  payload: TPayload,
  options: {
    signal?: AbortSignal
    onChunk?: (data: TResponse) => void
    keepAliveIntervalMs?: number
  } = {},
): Promise<TResponse> {
  return new Promise<TResponse>((resolve, reject) => {
    const {
      signal,
      onChunk,
      keepAliveIntervalMs = 20_000,
    } = options

    const requestId = createRequestId()
    const port = browser.runtime.connect({ name: portName })

    let settled = false
    let messageListener: ((event: StreamPortResponse<TResponse>) => void) | undefined
    let disconnectListener: (() => void) | undefined
    let abortListener: (() => void) | undefined
    let keepAliveTimer: ReturnType<typeof setInterval> | undefined

    const cleanup = () => {
      if (messageListener) {
        port.onMessage.removeListener(messageListener)
      }
      if (disconnectListener) {
        port.onDisconnect.removeListener(disconnectListener)
      }
      if (abortListener && signal) {
        signal.removeEventListener("abort", abortListener)
      }
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer)
        keepAliveTimer = undefined
      }
    }

    const finalize = (callback: () => void) => {
      if (settled) {
        return
      }
      settled = true

      try {
        port.disconnect()
      }
      catch {
        // The port may already be closed due to a race with onDisconnect.
        // This is expected during cleanup and safe to ignore.
      }

      callback()
      cleanup()
    }

    messageListener = (event: StreamPortResponse<TResponse>) => {
      if (!event || event.requestId !== requestId) {
        return
      }

      if (event.type === "chunk") {
        onChunk?.(event.data)
        return
      }

      if (event.type === "done") {
        finalize(() => resolve(event.data))
        return
      }

      if (event.type === "error") {
        finalize(() => reject(new Error(event.error)))
      }
    }

    disconnectListener = () => {
      finalize(() => reject(new Error("Stream disconnected unexpectedly")))
    }

    abortListener = () => {
      finalize(() => reject(new DOMException("aborted", "AbortError")))
    }

    if (signal?.aborted) {
      abortListener()
      return
    }

    port.onMessage.addListener(messageListener)
    port.onDisconnect.addListener(disconnectListener)

    if (signal) {
      signal.addEventListener("abort", abortListener)
    }

    const startMessage: StreamPortStartMessage<unknown> = {
      type: "start",
      requestId,
      payload,
    }

    port.postMessage(startMessage as StreamPortRequestMessage<unknown>)

    if (keepAliveIntervalMs > 0) {
      keepAliveTimer = setInterval(() => {
        if (settled) {
          return
        }

        try {
          const pingMessage: StreamPortRequestMessage<unknown> = {
            type: "ping",
            requestId,
          }
          port.postMessage(pingMessage)
        }
        catch {
          // Ignore keepalive send failures; disconnect listener will handle it.
        }
      }, keepAliveIntervalMs)
    }
  })
}
