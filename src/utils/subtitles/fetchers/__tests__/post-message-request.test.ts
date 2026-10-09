// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { POST_MESSAGE_TIMEOUT_MS } from "@/utils/constants/subtitles"
import { postMessageRequest } from "../post-message-request"

function settle(promise: Promise<unknown>) {
  const state: { settled: boolean; value?: unknown } = { settled: false }
  void promise.then((value) => {
    state.settled = true
    state.value = value
  })
  return state
}

describe("postMessageRequest", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(window, "postMessage").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("gives up after POST_MESSAGE_TIMEOUT_MS unless the caller allows longer", async () => {
    const usual = settle(postMessageRequest("REPLY", { type: "ASK" }))
    const longer = settle(postMessageRequest("REPLY", { type: "ASK" }, 2 * POST_MESSAGE_TIMEOUT_MS))

    await vi.advanceTimersByTimeAsync(POST_MESSAGE_TIMEOUT_MS)

    expect(usual).toEqual({ settled: true, value: null })
    expect(longer.settled).toBe(false)

    await vi.advanceTimersByTimeAsync(POST_MESSAGE_TIMEOUT_MS)

    expect(longer).toEqual({ settled: true, value: null })
  })

  it("takes a reply that arrives within the caller's longer wait", async () => {
    const reply = postMessageRequest("REPLY", { type: "ASK" }, 2 * POST_MESSAGE_TIMEOUT_MS)
    const { requestId } = vi.mocked(window.postMessage).mock.calls[0]![0]

    await vi.advanceTimersByTimeAsync(POST_MESSAGE_TIMEOUT_MS + 1000)
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "REPLY", requestId },
        origin: window.location.origin,
      }),
    )

    await expect(reply).resolves.toEqual({ type: "REPLY", requestId })
  })
})
