import type { SubtitlesFragment } from "../types"
import type { VideoSummaryProviderRef } from "../video-summary"
import { hashKey } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"
import {
  buildTranscript,
  sampleTranscript,
  stripLeadingHeading,
  videoSummaryQueryKey,
} from "../video-summary"

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

function localRef(model: string) {
  return {
    kind: "local",
    id: "deepseek",
    name: "DeepSeek",
    config: {
      id: "deepseek",
      name: "DeepSeek",
      enabled: true,
      provider: "deepseek",
      apiKey: "test-key",
      model: { model, isCustomModel: false, customModel: null },
    },
  } as unknown as VideoSummaryProviderRef
}

function systemRef(providerId: string) {
  return {
    kind: "system",
    id: providerId,
    name: providerId,
    modelTier: "standard",
  } as unknown as VideoSummaryProviderRef
}

describe("videoSummaryQueryKey", () => {
  it("separates the cache per video, language and provider", () => {
    const ref = systemRef("built-in-ai")
    const base = videoSummaryQueryKey("video-1", "cmn", ref)

    expect(hashKey(base)).not.toBe(hashKey(videoSummaryQueryKey("video-2", "cmn", ref)))
    expect(hashKey(base)).not.toBe(hashKey(videoSummaryQueryKey("video-1", "eng", ref)))
    expect(hashKey(base)).not.toBe(
      hashKey(videoSummaryQueryKey("video-1", "cmn", systemRef("other"))),
    )
    expect(hashKey(base)).toBe(hashKey(videoSummaryQueryKey("video-1", "cmn", ref)))
  })

  it("separates a local provider edited under the same id", () => {
    const before = videoSummaryQueryKey("video-1", "cmn", localRef("v1"))
    const after = videoSummaryQueryKey("video-1", "cmn", localRef("v2"))

    expect(hashKey(before)).not.toBe(hashKey(after))
  })

  it("hashes the same regardless of the order fields were written in", () => {
    const a = videoSummaryQueryKey("video-1", "cmn", {
      kind: "system",
      id: "built-in-ai",
      name: "built-in-ai",
      modelTier: "standard",
    } as unknown as VideoSummaryProviderRef)
    const b = videoSummaryQueryKey("video-1", "cmn", {
      modelTier: "standard",
      name: "built-in-ai",
      id: "built-in-ai",
      kind: "system",
    } as unknown as VideoSummaryProviderRef)

    expect(hashKey(a)).toBe(hashKey(b))
  })
})

describe("sampleTranscript", () => {
  const lines = (count: number) => Array.from({ length: count }, (_, i) => `line ${i}`)

  it("leaves a transcript that already fits untouched", () => {
    const transcript = "one\ntwo\nthree"

    expect(sampleTranscript(transcript, 100)).toBe(transcript)
  })

  it("stays inside the budget once the transcript exceeds it", () => {
    const transcript = lines(400).join("\n")

    expect(sampleTranscript(transcript, 500).length).toBeLessThanOrEqual(500)
  })

  it("reaches the end of the video rather than only its opening", () => {
    const transcript = lines(400).join("\n")
    const sampled = sampleTranscript(transcript, 500)

    expect(sampled).toContain("line 0")
    expect(sampled).toContain("line 200")
    expect(sampled).toContain("line 350")
  })

  it("keeps every sampled cue whole", () => {
    const transcript = lines(400).join("\n")
    const source = new Set(lines(400))

    for (const cue of sampleTranscript(transcript, 500).split("\n").filter(Boolean)) {
      expect(source.has(cue)).toBe(true)
    }
  })
})
