import { describe, expect, it } from "vitest"
import { MAX_GLOSSARY_SOURCE_LENGTH } from "../../constants/glossary"
import { formatGlossaryCsv, parseGlossaryCsv } from "../csv"

describe("parseGlossaryCsv", () => {
  it("parses source,target pairs", () => {
    const { rows } = parseGlossaryCsv("Chort Bay,雀特湾\nHelldiver,地狱潜兵")
    expect(rows).toEqual([
      { source: "Chort Bay", target: "雀特湾" },
      { source: "Helldiver", target: "地狱潜兵" },
    ])
  })

  it("accepts a bare line with no comma as a keep-original entry", () => {
    // Immersive Translate drops this shape (its parser gates on includes(",")),
    // and it is the most requested case in issue #942.
    const { rows, skipped } = parseGlossaryCsv("Acheron\nNeonRider_07")
    expect(rows).toEqual([
      { source: "Acheron", target: "" },
      { source: "NeonRider_07", target: "" },
    ])
    expect(skipped).toEqual([])
  })

  it("accepts a trailing comma with an empty target as keep-original", () => {
    expect(parseGlossaryCsv("Acheron,").rows).toEqual([{ source: "Acheron", target: "" }])
  })

  it("skips a header row but only on the first line", () => {
    expect(parseGlossaryCsv("source,target\nGo,Go 语言").rows).toEqual([
      { source: "Go", target: "Go 语言" },
    ])
    // A term legitimately called "source" further down is data, not a header.
    expect(parseGlossaryCsv("Go,Go 语言\nsource,来源").rows).toHaveLength(2)
  })

  it("honours quoted fields with embedded commas and escaped quotes", () => {
    const { rows } = parseGlossaryCsv('"Smith, John",史密斯\n"say ""hi""",打招呼')
    expect(rows).toEqual([
      { source: "Smith, John", target: "史密斯" },
      { source: 'say "hi"', target: "打招呼" },
    ])
  })

  // Files exported from another tool routinely carry a third column. Rejecting
  // the row would lose the two fields we do understand.
  it("ignores columns past the second instead of rejecting the row", () => {
    expect(parseGlossaryCsv("GPU,显卡,hardware,extra").rows).toEqual([
      { source: "GPU", target: "显卡" },
    ])
  })

  it("ignores blank lines and strips a UTF-8 BOM", () => {
    const { rows } = parseGlossaryCsv("﻿Chort Bay,雀特湾\n\n\nHelldiver,地狱潜兵\n")
    expect(rows.map((row) => row.source)).toEqual(["Chort Bay", "Helldiver"])
  })

  it("handles CRLF and lone CR line endings", () => {
    expect(parseGlossaryCsv("a,1\r\nb,2\rc,3").rows).toHaveLength(3)
  })

  it("reports skipped rows with a line number instead of failing the import", () => {
    const tooLong = "x".repeat(MAX_GLOSSARY_SOURCE_LENGTH + 1)
    const { rows, skipped } = parseGlossaryCsv(`Good,好\n,orphan\n${tooLong},nope`)
    expect(rows).toEqual([{ source: "Good", target: "好" }])
    expect(skipped).toEqual([
      { line: 2, reason: "empty" },
      { line: 3, reason: "too-long" },
    ])
  })

  it("returns nothing for empty input", () => {
    expect(parseGlossaryCsv("").rows).toEqual([])
    expect(parseGlossaryCsv("   \n  ").rows).toEqual([])
  })
})

describe("formatGlossaryCsv", () => {
  it("round-trips through the parser", () => {
    const rows = [
      { source: "Smith, John", target: "史密斯" },
      { source: 'say "hi"', target: "打招呼" },
      { source: "Acheron", target: "" },
    ]
    expect(parseGlossaryCsv(formatGlossaryCsv(rows)).rows).toEqual(rows)
  })

  it("writes exactly two columns, whatever the rows contain", () => {
    const csv = formatGlossaryCsv([
      { source: "GPU", target: "显卡" },
      { source: "CPU", target: "处理器" },
    ])
    expect(csv.split("\n").every((line) => line.split(",").length === 2)).toBe(true)
  })

  it("writes a header the parser sniffs back off", () => {
    expect(formatGlossaryCsv([{ source: "a", target: "b" }]).split("\n")[0]).toBe("source,target")
  })

  it("emits no id column, so exporting and re-importing cannot duplicate a list", () => {
    // Identity is derived from the source term; an id column would make
    // export-on-A -> import-on-B -> sync produce two rows per term.
    expect(formatGlossaryCsv([{ source: "a", target: "b" }])).not.toMatch(/\bid\b/)
  })
})
