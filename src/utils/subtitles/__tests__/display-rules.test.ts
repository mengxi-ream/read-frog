import type { StateData, SubtitlesFragment } from "../types"
import type { SubtitlesDisplayMode } from "@/types/config/subtitles"
import { describe, expect, it } from "vitest"
import { deriveSubtitleDisplayDecision, hasRenderableSubtitleByMode } from "../display-rules"

function makeSubtitle(overrides?: Partial<SubtitlesFragment>): SubtitlesFragment {
  return {
    text: "hello",
    start: 0,
    end: 1000,
    ...overrides,
  }
}

describe("hasRenderableSubtitleByMode", () => {
  it("returns false when subtitle is null", () => {
    expect(hasRenderableSubtitleByMode(null, "bilingual")).toBe(false)
  })

  it("returns true for bilingual/originalOnly even without translation", () => {
    const sub = makeSubtitle()
    expect(hasRenderableSubtitleByMode(sub, "bilingual")).toBe(true)
    expect(hasRenderableSubtitleByMode(sub, "originalOnly")).toBe(true)
  })

  it("returns false for translationOnly without translation", () => {
    const sub = makeSubtitle()
    expect(hasRenderableSubtitleByMode(sub, "translationOnly")).toBe(false)
  })

  it("returns true for translationOnly with translation", () => {
    const sub = makeSubtitle({ translation: "你好" })
    expect(hasRenderableSubtitleByMode(sub, "translationOnly")).toBe(true)
  })
})

describe("deriveSubtitleDisplayDecision", () => {
  const modes: SubtitlesDisplayMode[] = ["bilingual", "originalOnly", "translationOnly"]

  it("idle: never shows state message", () => {
    const sub = makeSubtitle()
    for (const mode of modes) {
      const result = deriveSubtitleDisplayDecision(null, sub, mode)
      expect(result.showStateMessage).toBe(false)
    }
  })

  it("loading + has renderable content: hides loading", () => {
    const state: StateData = { state: "loading" }
    const sub = makeSubtitle({ translation: "你好" })
    const result = deriveSubtitleDisplayDecision(state, sub, "bilingual")
    expect(result.hasRenderableSubtitle).toBe(true)
    expect(result.showStateMessage).toBe(false)
  })

  it("loading + translationOnly without translation: shows loading", () => {
    const state: StateData = { state: "loading" }
    const sub = makeSubtitle()
    const result = deriveSubtitleDisplayDecision(state, sub, "translationOnly")
    expect(result.hasRenderableSubtitle).toBe(false)
    expect(result.showStateMessage).toBe(true)
  })

  it("error: always shows state message", () => {
    const state: StateData = { state: "error", message: "something went wrong" }
    for (const mode of modes) {
      const result = deriveSubtitleDisplayDecision(state, makeSubtitle({ translation: "你好" }), mode)
      expect(result.showStateMessage).toBe(true)
    }
  })
})
