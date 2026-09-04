// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PLAYER_DATA_REQUEST_TYPE, PLAYER_DATA_RESPONSE_TYPE } from "@/utils/constants/subtitles"
import { getYoutubeConfig } from "../config"

function answerPlayerData(data: Record<string, unknown> | null) {
  const originalPostMessage = window.postMessage.bind(window)
  ;(window as any).postMessage = (message: any, targetOrigin: string) => {
    originalPostMessage(message, targetOrigin)
    if (message?.type !== PLAYER_DATA_REQUEST_TYPE || data === null) {
      return
    }
    setTimeout(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: window.location.origin,
          data: {
            type: PLAYER_DATA_RESPONSE_TYPE,
            requestId: message.requestId,
            success: true,
            data,
          },
        }),
      )
    }, 0)
  }
}

describe("youtube isLiveContent", () => {
  const originalLocation = window.location
  const originalPostMessage = window.postMessage

  beforeEach(() => {
    Object.defineProperty(window, "location", {
      value: {
        href: "https://www.youtube.com/watch?v=test123",
        search: "?v=test123",
        origin: "https://www.youtube.com",
        pathname: "/watch",
        hostname: "www.youtube.com",
      },
      writable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, "location", { value: originalLocation, writable: true })
    ;(window as any).postMessage = originalPostMessage
    vi.useRealTimers()
  })

  it("reads the live flag off the player data", async () => {
    answerPlayerData({ videoId: "test123", isLiveContent: true })
    const { isLiveContent } = getYoutubeConfig({ mode: "watch" })

    await expect(isLiveContent!()).resolves.toBe(true)
  })

  it("treats a regular upload as not live", async () => {
    answerPlayerData({ videoId: "test123", isLiveContent: false })
    const { isLiveContent } = getYoutubeConfig({ mode: "watch" })

    await expect(isLiveContent!()).resolves.toBe(false)
  })

  it("fails open when the player does not answer", async () => {
    vi.useFakeTimers()
    answerPlayerData(null)
    const { isLiveContent } = getYoutubeConfig({ mode: "watch" })

    const result = isLiveContent!()
    await vi.runAllTimersAsync()

    await expect(result).resolves.toBe(false)
  })
})
