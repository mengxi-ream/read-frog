import type { StreamPortResponse } from "@/types/background-stream"
import { describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import { createPortStreamPromise } from "@/utils/content-script/port-streaming"
import { createSelectionToolbarRuntimeError } from "../inline-error"

const UPGRADE = { label: "Upgrade", url: "https://www.readfrog.app/pricing" }

/** A port whose background answers the start message with `error`. */
function connectPortFailingWith(error: Extract<StreamPortResponse, { type: "error" }>["error"]) {
  let onMessage: ((event: StreamPortResponse) => void) | undefined
  vi.spyOn(browser.runtime, "connect").mockReturnValue({
    onMessage: {
      addListener: (listener: typeof onMessage) => {
        onMessage = listener
      },
      removeListener: vi.fn<(...args: any[]) => any>(),
    },
    onDisconnect: {
      addListener: vi.fn<(...args: any[]) => any>(),
      removeListener: vi.fn<(...args: any[]) => any>(),
    },
    postMessage: (message: { type: string; streamRequestId: string }) => {
      if (message.type === "start") {
        onMessage?.({ type: "error", streamRequestId: message.streamRequestId, error })
      }
    },
    disconnect: vi.fn<(...args: any[]) => any>(),
  } as never)
}

async function catchRejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error("Expected the stream to reject")
}

describe("createSelectionToolbarRuntimeError", () => {
  it("keeps the call to action the background attached to a stream failure", async () => {
    connectPortFailingWith({ message: "Quota used up", action: UPGRADE })

    const error = await catchRejection(createPortStreamPromise("stream-structured-object", {}))

    expect(createSelectionToolbarRuntimeError("customAction", error)).toEqual({
      title: "options.selectionToolbar.errors.customActionFailed",
      description: "Quota used up",
      action: UPGRADE,
    })
  })

  it("shows a stream failure without an action as a plain message", async () => {
    connectPortFailingWith({ message: "Incorrect API key provided" })

    const error = await catchRejection(createPortStreamPromise("stream-structured-object", {}))

    expect(createSelectionToolbarRuntimeError("customAction", error)).toEqual({
      title: "options.selectionToolbar.errors.customActionFailed",
      description: "Incorrect API key provided",
      action: undefined,
    })
  })

  it("never turns an `action` found on a foreign error into a button", () => {
    const providerError = Object.assign(new Error("Rate limited"), { action: UPGRADE })

    expect(createSelectionToolbarRuntimeError("customAction", providerError).action).toBeUndefined()
  })
})
