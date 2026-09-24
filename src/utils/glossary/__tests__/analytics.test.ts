import type { MatchedTerm } from "../types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { UNKNOWN_FEATURE_PROVIDER } from "@/utils/analytics-provider"
import { GLOSSARY_FEATURE_KEYS } from "../features"

const { sendMessageMock } = vi.hoisted(() => ({
  sendMessageMock: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/message", () => ({
  sendMessage: sendMessageMock,
}))

const { resetGlossaryUsageThrottleForTests, trackGlossaryUsed } = await import("../analytics")

const term: MatchedTerm = { matchKey: "frog", source: "frog", target: "青蛙", keepOriginal: false }

function lastEvent() {
  expect(sendMessageMock).toHaveBeenCalledTimes(1)
  const [event, properties] = sendMessageMock.mock.calls[0]!
  expect(event).toBe("trackFeatureUsedEvent")
  return properties
}

describe("trackGlossaryUsed", () => {
  beforeEach(() => {
    vi.useRealTimers()
    resetGlossaryUsageThrottleForTests()
    sendMessageMock.mockReset()
    sendMessageMock.mockResolvedValue(undefined)
  })

  it("reports the glossary as its own feature so the daily cache throttles it on its own", () => {
    trackGlossaryUsed("pageTranslation", [term], "cmn", { provider: "openai", backend_kind: "llm" })

    expect(lastEvent()).toEqual({
      feature: ANALYTICS_FEATURE.GLOSSARY,
      surface: ANALYTICS_SURFACE.PAGE_TRANSLATION,
      outcome: "success",
      latency_ms: 0,
      provider: "openai",
      backend_kind: "llm",
      target_language: "cmn",
    })
  })

  it("stays silent when nothing matched, so merely owning a glossary reports nothing", () => {
    trackGlossaryUsed("pageTranslation", [], "cmn", { provider: "openai", backend_kind: "llm" })

    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  it("carries a surface for every feature that can hold a glossary", () => {
    for (const feature of GLOSSARY_FEATURE_KEYS) {
      sendMessageMock.mockReset()
      resetGlossaryUsageThrottleForTests()
      trackGlossaryUsed(feature, [term], "cmn")
      expect(lastEvent().surface).toEqual(expect.any(String))
    }
  })

  it("names the feature the terms rode in on, since the daily cache keys on feature alone", () => {
    trackGlossaryUsed("selectionTranslation", [term], "cmn")
    expect(lastEvent().surface).toBe(ANALYTICS_SURFACE.SELECTION_TOOLBAR)

    // No throttle reset: each feature gets its own budget, so a page translation
    // in progress cannot mute the selection toolbar the user just reached for.
    sendMessageMock.mockReset()
    trackGlossaryUsed("videoSubtitles", [term], "cmn")
    expect(lastEvent().surface).toBe(ANALYTICS_SURFACE.VIDEO_SUBTITLES)

    sendMessageMock.mockReset()
    trackGlossaryUsed("inputTranslation", [term], "cmn")
    expect(lastEvent().surface).toBe(ANALYTICS_SURFACE.INPUT_TRANSLATION)
  })

  it("reports one paragraph, not every paragraph of a page", () => {
    for (let paragraph = 0; paragraph < 200; paragraph++) {
      trackGlossaryUsed("pageTranslation", [term], "cmn")
    }

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
  })

  it("reports again once the interval has passed, so a tab open past midnight is not muted", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-17T12:00:00Z"))
    trackGlossaryUsed("pageTranslation", [term], "cmn")
    expect(sendMessageMock).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(4 * 60 * 1000)
    trackGlossaryUsed("pageTranslation", [term], "cmn")
    expect(sendMessageMock).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(60 * 1000)
    trackGlossaryUsed("pageTranslation", [term], "cmn")
    expect(sendMessageMock).toHaveBeenCalledTimes(2)
  })

  it("does not spend a feature's budget on a run that matched nothing", () => {
    trackGlossaryUsed("pageTranslation", [], "cmn")
    trackGlossaryUsed("pageTranslation", [term], "cmn")

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
  })

  it("ignores hosted routes that build no glossary-bearing prompt of their own", () => {
    trackGlossaryUsed("videoSubtitlesSegmentation", [term], "cmn")
    trackGlossaryUsed("languageDetection", [term], "cmn")

    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  it("falls back to the unknown provider rather than dropping the event", () => {
    trackGlossaryUsed("pageTranslation", [term], "cmn")

    expect(lastEvent()).toMatchObject(UNKNOWN_FEATURE_PROVIDER)
  })

  it("never puts the matched terms themselves on the event", () => {
    trackGlossaryUsed(
      "pageTranslation",
      [
        {
          matchKey: "a private name",
          source: "a private name",
          target: "另一个私人名字",
          keepOriginal: false,
        },
      ],
      "cmn",
    )

    const serialized = JSON.stringify(lastEvent())
    expect(serialized).not.toContain("a private name")
    expect(serialized).not.toContain("另一个私人名字")
  })
})
