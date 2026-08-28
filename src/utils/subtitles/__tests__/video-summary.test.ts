import type { SubtitlesFragment } from "../types"
import type { ProvidersConfig } from "@/types/config/provider"
import { describe, expect, it } from "vitest"
import { buildTranscript, stripLeadingHeading, videoSummaryQueryKey } from "../video-summary"

function fragment(text: string): SubtitlesFragment {
  return { text, start: 0, end: 1000 }
}

describe("buildTranscript", () => {
  it("keeps one line per cue and drops blank ones", () => {
    expect(buildTranscript([fragment("first"), fragment("   "), fragment("second")])).toBe(
      "first\nsecond",
    )
  })

  it("strips zero-width characters", () => {
    expect(buildTranscript([fragment("a​b﻿")])).toBe("ab")
  })

  it("does not truncate long transcripts", () => {
    const long = Array.from({ length: 400 }, () => fragment("x".repeat(50)))

    expect(buildTranscript(long)).toHaveLength(400 * 50 + 399)
  })
})

describe("stripLeadingHeading", () => {
  it("removes a title the model added despite being told not to", () => {
    expect(stripLeadingHeading("## A Title\n\nThe body.")).toBe("The body.")
  })

  it("keeps headings the summary itself uses further down", () => {
    const summary = "Opening.\n\n## A section\nMore."

    expect(stripLeadingHeading(summary)).toBe(summary)
  })

  it("leaves an answer that opens with prose alone", () => {
    expect(stripLeadingHeading("Just prose.")).toBe("Just prose.")
  })
})

function localProvider(model: string): ProvidersConfig[number] {
  return {
    id: "deepseek",
    name: "DeepSeek",
    enabled: true,
    provider: "deepseek",
    apiKey: "test-key",
    model: { model, isCustomModel: false, customModel: null },
  } as ProvidersConfig[number]
}

describe("videoSummaryQueryKey", () => {
  it("separates the cache per video, language and provider", () => {
    const base = videoSummaryQueryKey("video-1", "cmn", [], "deepseek")

    expect(base).not.toEqual(videoSummaryQueryKey("video-2", "cmn", [], "deepseek"))
    expect(base).not.toEqual(videoSummaryQueryKey("video-1", "eng", [], "deepseek"))
    expect(base).not.toEqual(videoSummaryQueryKey("video-1", "cmn", [], "openai"))
    expect(base).toEqual(videoSummaryQueryKey("video-1", "cmn", [], "deepseek"))
  })

  it("separates a local provider edited under the same id", () => {
    const before = videoSummaryQueryKey("video-1", "cmn", [localProvider("v1")], "deepseek")
    const after = videoSummaryQueryKey("video-1", "cmn", [localProvider("v2")], "deepseek")

    expect(before).not.toEqual(after)
  })
})
