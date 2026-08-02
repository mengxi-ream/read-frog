import type { StateData, SubtitlesFragment } from "../types"
import { describe, expect, it } from "vitest"
import {
  hasRenderableSubtitleByMode,
  isAwaitingTranslation,
  isTranslationPending,
} from "../display-rules"

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

describe("isAwaitingTranslation", () => {
  it("has subtitle, untranslated → true", () => {
    const sub = makeSubtitle()
    expect(isAwaitingTranslation(sub, null)).toBe(true)
  })

  it("has subtitle, translated → false", () => {
    const sub = makeSubtitle({ translation: "你好" })
    expect(isAwaitingTranslation(sub, null)).toBe(false)
  })

  it("gap, stateData loading → true", () => {
    const state: StateData = { state: "loading" }
    expect(isAwaitingTranslation(null, state)).toBe(true)
  })

  it("gap, stateData idle → false", () => {
    const state: StateData = { state: "idle" }
    expect(isAwaitingTranslation(null, state)).toBe(false)
  })

  it("gap, stateData null → false", () => {
    expect(isAwaitingTranslation(null, null)).toBe(false)
  })

  it("has subtitle, ignores stateData when determining loading", () => {
    const sub = makeSubtitle()
    const idleState: StateData = { state: "idle" }
    // subtitle without translation → awaiting, regardless of stateData
    expect(isAwaitingTranslation(sub, idleState)).toBe(true)
  })
})

describe("isTranslationPending", () => {
  it("returns true when translation is missing", () => {
    expect(isTranslationPending(makeSubtitle())).toBe(true)
  })

  it("returns false when translation is present", () => {
    expect(isTranslationPending(makeSubtitle({ translation: "你好" }))).toBe(false)
  })

  it("returns false for empty-string translation (resolved but blank)", () => {
    expect(isTranslationPending(makeSubtitle({ translation: "" }))).toBe(false)
  })

  it("returns false when subtitle is null", () => {
    expect(isTranslationPending(null)).toBe(false)
  })
})
