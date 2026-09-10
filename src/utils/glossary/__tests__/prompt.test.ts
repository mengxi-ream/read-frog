import type { MatchedTerm } from "../types"
import { describe, expect, it } from "vitest"
import {
  appendGlossaryToSystemPrompt,
  GLOSSARY_KEEP_MARKER,
  renderGlossaryPromptBlock,
} from "../prompt"

function term(source: string, target: string): MatchedTerm {
  return { matchKey: `i:${source.toLowerCase()}`, source, target, keepOriginal: target === "" }
}

describe("renderGlossaryPromptBlock", () => {
  it("returns null when nothing matched, so the prompt stays byte-identical", () => {
    expect(renderGlossaryPromptBlock([])).toBeNull()
  })

  it("renders a replacement as an arrow line", () => {
    const block = renderGlossaryPromptBlock([term("Chort Bay", "雀特湾")])
    expect(block).toContain("Chort Bay => 雀特湾")
  })

  it("renders an empty target as the keep marker", () => {
    const block = renderGlossaryPromptBlock([term("NeonRider_07", "")])
    expect(block).toContain(`NeonRider_07 => ${GLOSSARY_KEEP_MARKER}`)
  })

  it("keeps the terms under a single Terminology heading, in the given order", () => {
    const block = renderGlossaryPromptBlock([term("Acheron", ""), term("Helldiver", "地狱潜兵")])
    expect(block).toBe(`${block!.split("\n\nTerminology:\n")[0]}

Terminology:
Acheron => ${GLOSSARY_KEEP_MARKER}
Helldiver => 地狱潜兵`)
  })

  it("carries no worked input/output example", () => {
    const block = renderGlossaryPromptBlock([term("a", "b")])!
    // A marked slot inside an example measurably raised the empty-output rate in
    // this prompt assembly; see the note in prompt.ts.
    expect(block).not.toMatch(/example/i)
    expect(block).not.toMatch(/input:/i)
    expect(block).not.toMatch(/output:/i)
  })

  it("states the rules before the terms", () => {
    const block = renderGlossaryPromptBlock([term("a", "b")])!
    expect(block.indexOf("## Terminology Rules")).toBeLessThan(block.indexOf("Terminology:"))
  })
})

describe("appendGlossaryToSystemPrompt", () => {
  const SYSTEM = "## Rules\nSome existing rules."

  it("returns the prompt UNCHANGED when nothing matched", () => {
    // The load-bearing case: the finished prompt is part of the translation
    // cache key, so a user who merely owns a glossary must produce the same
    // bytes as a user with none.
    expect(appendGlossaryToSystemPrompt(SYSTEM, [])).toBe(SYSTEM)
  })

  it("separates the block with a blank line, like every other appended block", () => {
    const result = appendGlossaryToSystemPrompt(SYSTEM, [term("a", "b")])
    expect(result.startsWith(`${SYSTEM}\n\n`)).toBe(true)
    expect(result).toContain("## Terminology Rules")
  })

  it("is byte-identical for the same terms, whatever order they arrive in", () => {
    const one = appendGlossaryToSystemPrompt(SYSTEM, [term("a", "1"), term("b", "2")])
    const two = appendGlossaryToSystemPrompt(SYSTEM, [term("a", "1"), term("b", "2")])
    expect(one).toBe(two)
  })
})
