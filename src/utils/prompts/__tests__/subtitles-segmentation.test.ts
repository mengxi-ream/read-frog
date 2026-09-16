import { describe, expect, it } from "vitest"
import { DEFAULT_SUBTITLES_SEGMENTATION_SYSTEM_PROMPT } from "@/utils/constants/prompt"
import {
  MAX_CHARS_CJK,
  MAX_WORDS,
  MIN_STANDALONE_CUE_DURATION_MS,
  PAUSE_TIMEOUT_MS,
} from "@/utils/constants/subtitles"
import { getSubtitlesSegmentationPrompt } from "../subtitles-segmentation"

describe("subtitles segmentation prompt", () => {
  it("states the cue length limits from the shared constants", () => {
    expect(DEFAULT_SUBTITLES_SEGMENTATION_SYSTEM_PROMPT).toContain(`${MAX_WORDS} words`)
    expect(DEFAULT_SUBTITLES_SEGMENTATION_SYSTEM_PROMPT).toContain(`${MAX_CHARS_CJK} characters`)
  })

  it("ranks the length limit above sentence completeness", () => {
    const lengthRule = DEFAULT_SUBTITLES_SEGMENTATION_SYSTEM_PROMPT.indexOf("Length limit")
    const completenessRule =
      DEFAULT_SUBTITLES_SEGMENTATION_SYSTEM_PROMPT.indexOf("Complete sentences")
    expect(lengthRule).toBeGreaterThan(-1)
    expect(completenessRule).toBeGreaterThan(-1)
    expect(lengthRule).toBeLessThan(completenessRule)
  })

  it("leaves an already over-long input fragment as its own cue", () => {
    expect(DEFAULT_SUBTITLES_SEGMENTATION_SYSTEM_PROMPT).toContain(
      "already exceeds the limit on its own",
    )
  })

  it("never leaves a cue shorter than the standalone threshold on its own", () => {
    expect(DEFAULT_SUBTITLES_SEGMENTATION_SYSTEM_PROMPT).toContain(
      `${MIN_STANDALONE_CUE_DURATION_MS} ms`,
    )
    expect(DEFAULT_SUBTITLES_SEGMENTATION_SYSTEM_PROMPT).toContain("must never stand alone")
  })

  it("treats a silence longer than the pause timeout as a boundary even for brief cues", () => {
    const briefRule = DEFAULT_SUBTITLES_SEGMENTATION_SYSTEM_PROMPT.split("\n").find((line) =>
      line.includes("Exception for brief cues"),
    )
    expect(briefRule).toContain(`${PAUSE_TIMEOUT_MS} ms`)
    expect(DEFAULT_SUBTITLES_SEGMENTATION_SYSTEM_PROMPT).toContain("A silence is a hard boundary")
    expect(DEFAULT_SUBTITLES_SEGMENTATION_SYSTEM_PROMPT).toContain(
      "a line repeated after a pause is a second cue",
    )
    const finalCheck = DEFAULT_SUBTITLES_SEGMENTATION_SYSTEM_PROMPT.slice(
      DEFAULT_SUBTITLES_SEGMENTATION_SYSTEM_PROMPT.indexOf("## Final check before you answer"),
    )
    expect(finalCheck).toContain(`silence longer than ${PAUSE_TIMEOUT_MS} ms`)
  })

  it("ends with a final check that restates the hard limits after the examples", () => {
    const finalCheck = DEFAULT_SUBTITLES_SEGMENTATION_SYSTEM_PROMPT.indexOf(
      "## Final check before you answer",
    )
    const lastExample = DEFAULT_SUBTITLES_SEGMENTATION_SYSTEM_PROMPT.lastIndexOf("CORRECT (")
    expect(finalCheck).toBeGreaterThan(lastExample)
    const tail = DEFAULT_SUBTITLES_SEGMENTATION_SYSTEM_PROMPT.slice(finalCheck)
    expect(tail).toContain(`${MAX_WORDS} words or ${MAX_CHARS_CJK} characters`)
    expect(tail).toContain(`${MIN_STANDALONE_CUE_DURATION_MS} ms`)
    expect(tail).toContain("Never use the next cue's start as an end time")
  })

  it("injects the fragments into the user prompt", () => {
    const { systemPrompt, prompt } = getSubtitlesSegmentationPrompt('[{"s":0,"e":1,"t":"x"}]')
    expect(systemPrompt).toBe(DEFAULT_SUBTITLES_SEGMENTATION_SYSTEM_PROMPT)
    expect(prompt).toContain('[{"s":0,"e":1,"t":"x"}]')
  })
})
