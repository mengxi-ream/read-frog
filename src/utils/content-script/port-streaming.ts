import type { AnalyticsFailureReason } from "@/types/analytics"
import type {
  StreamPortErrorPayload,
  StreamPortRequestMessage,
  StreamPortResponse,
  StreamPortStartMessage,
} from "@/types/background-stream"
import type { ErrorAction } from "@/utils/error-action"
import { browser } from "#imports"
import { getRandomUUID } from "@/utils/crypto-polyfill"

/**
 * Rejection message when the background port drops mid-stream (service worker
 * restart, extension reload). Callers can match it to treat the failure as an
 * infrastructure hiccup rather than a provider error.
 */
export const STREAM_PORT_DISCONNECTED_MESSAGE = "Stream disconnected unexpectedly"

/**
 * A failure the background reported over the port, with the call to action it
 * attached, if any. A class rather than a duck-typed `action` field so a UI
 * only ever renders buttons the extension itself built — never a URL that
 * happened to sit on some provider's error object.
 */
export class StreamPortError extends Error {
  readonly action?: ErrorAction
  readonly reason?: AnalyticsFailureReason

  constructor({ message, action, reason }: StreamPortErrorPayload) {
    super(message)
    this.name = "StreamPortError"
    this.action = action
    this.reason = reason
  }
}

/**
 * Handles cleanup, abort signals, and disconnection automatically
 */
export function createPortStreamPromise<TResponse = string>(
  portName: string,
  serializablePayload: unknown,
  options: {
    signal?: AbortSignal
    onChunk?: (data: TResponse) => void
    keepAliveIntervalMs?: number
  } = {},
): Promise<TResponse> {
  return new Promise<TResponse>((resolve, reject) => {
    const { signal, onChunk, keepAliveIntervalMs = 20_000 } = options

    const streamRequestId = getRandomUUID()
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
      } catch {
        // The port may already be closed due to a race with onDisconnect.
        // This is expected during cleanup and safe to ignore.
      }

      callback()
      cleanup()
    }

    messageListener = (event: StreamPortResponse<TResponse>) => {
      if (!event || event.streamRequestId !== streamRequestId) {
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
        finalize(() => reject(new StreamPortError(event.error)))
      }
    }

    disconnectListener = () => {
      finalize(() => reject(new Error(STREAM_PORT_DISCONNECTED_MESSAGE)))
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
      streamRequestId,
      payload: serializablePayload,
    }

    port.postMessage(startMessage)

    if (keepAliveIntervalMs > 0) {
      keepAliveTimer = setInterval(() => {
        if (settled) {
          return
        }

        try {
          const pingMessage: StreamPortRequestMessage<unknown> = {
            type: "ping",
            streamRequestId,
          }
          port.postMessage(pingMessage)
        } catch {
          // Ignore keepalive send failures; disconnect listener will handle it.
        }
      }, keepAliveIntervalMs)
    }
  })
}
