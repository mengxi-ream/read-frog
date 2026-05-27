import { describe, expect, it } from "vitest"
import { buildLineByLineBatchText, parseLineByLineBatchResult } from "../line-by-line-utils"

const SENTENCE_SEPARATOR = "@@"

describe("buildLineByLineBatchText", () => {
  it("joins two sentences with @@ separator", () => {
    const result = buildLineByLineBatchText(["Hello.", "World."])
    expect(result).toBe(`Hello.\n${SENTENCE_SEPARATOR}\nWorld.`)
  })

  it("returns single sentence as-is (no separator)", () => {
    const result = buildLineByLineBatchText(["Only one."])
    expect(result).toBe("Only one.")
  })

  it("joins three sentences", () => {
    const result = buildLineByLineBatchText(["A.", "B.", "C."])
    const parts = result.split(SENTENCE_SEPARATOR)
    expect(parts).toHaveLength(3)
    expect(parts[0].trim()).toBe("A.")
    expect(parts[1].trim()).toBe("B.")
    expect(parts[2].trim()).toBe("C.")
  })

  it("preserves internal spaces within sentences", () => {
    const result = buildLineByLineBatchText(["The cat sat.", "It rained."])
    expect(result).toContain("The cat sat.")
    expect(result).toContain("It rained.")
  })
})

describe("parseLineByLineBatchResult", () => {
  it("splits two sentences by @@", () => {
    const result = parseLineByLineBatchResult(`Translation A.\n${SENTENCE_SEPARATOR}\nTranslation B.`)
    expect(result).toEqual(["Translation A.", "Translation B."])
  })

  it("trims whitespace around sentences", () => {
    const result = parseLineByLineBatchResult(`  Hello.  \n${SENTENCE_SEPARATOR}\n  World.  `)
    expect(result).toEqual(["Hello.", "World."])
  })

  it("filters empty segments", () => {
    const result = parseLineByLineBatchResult(`A.\n${SENTENCE_SEPARATOR}\n\n${SENTENCE_SEPARATOR}\nC.`)
    expect(result).toEqual(["A.", "C."])
  })

  it("returns single element for text without separator", () => {
    const result = parseLineByLineBatchResult("Single translation.")
    expect(result).toEqual(["Single translation."])
  })

  it("returns empty array for empty string", () => {
    expect(parseLineByLineBatchResult("")).toEqual([])
  })

  it("returns empty array for whitespace-only string", () => {
    expect(parseLineByLineBatchResult("   \n  ")).toEqual([])
  })
})
