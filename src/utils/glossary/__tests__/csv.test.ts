import { describe, expect, it } from "vitest"
import { MAX_GLOSSARY_SOURCE_LENGTH } from "../../constants/glossary"
import {
  decodeGlossaryCsv,
  formatGlossaryCsv,
  parseGlossaryCsv,
  resolveRowTargetLanguage,
  UTF8_BOM,
} from "../csv"

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
  it("reads the third column as the target language", () => {
    expect(parseGlossaryCsv("GPU,显卡,cmn").rows).toEqual([
      { source: "GPU", target: "显卡", targetLanguage: "cmn" },
    ])
  })

  it("leaves the language unset when the column is absent or blank", () => {
    expect(parseGlossaryCsv("GPU,显卡").rows).toEqual([{ source: "GPU", target: "显卡" }])
    expect(parseGlossaryCsv("GPU,显卡,").rows).toEqual([{ source: "GPU", target: "显卡" }])
  })

  it("sniffs off a three-column header", () => {
    expect(parseGlossaryCsv("source,target,targetLanguage\nGPU,显卡,cmn").rows).toEqual([
      { source: "GPU", target: "显卡", targetLanguage: "cmn" },
    ])
  })

  it("ignores columns past the third instead of rejecting the row", () => {
    expect(parseGlossaryCsv("GPU,显卡,cmn,extra").rows).toEqual([
      { source: "GPU", target: "显卡", targetLanguage: "cmn" },
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
      { source: "Smith, John", target: "史密斯", targetLanguage: "cmn" },
      { source: 'say "hi"', target: "打招呼", targetLanguage: "jpn" },
      { source: "Acheron", target: "", targetLanguage: "cmn" },
    ]
    expect(parseGlossaryCsv(formatGlossaryCsv(rows)).rows).toEqual(rows)
  })

  /** A row with no language of its own writes a blank cell, and reads back unset. */
  it("round-trips a row with no language", () => {
    const rows = [{ source: "Acheron", target: "" }]
    expect(parseGlossaryCsv(formatGlossaryCsv(rows)).rows).toEqual(rows)
  })

  it("writes exactly four columns, whatever the rows contain", () => {
    const csv = formatGlossaryCsv([
      { source: "GPU", target: "显卡" },
      { source: "CPU", target: "处理器" },
    ])
    expect(csv.split("\n").every((line) => line.split(",").length === 4)).toBe(true)
  })

  it("writes a header the parser sniffs back off", () => {
    expect(formatGlossaryCsv([{ source: "a", target: "b" }]).split("\n")[0]).toBe(
      "source,target,targetLanguage,caseSensitive",
    )
  })

  /**
   * The round trip the product's own copy recommends before an irreversible
   * delete. Without the fourth column every case-sensitive term came back under
   * `i:` instead of `s:`, missed the row it came from, and was inserted BESIDE
   * it — doubling the list and taking the case rule off the term.
   */
  it("round-trips the case flag, which is half of a term's identity", () => {
    const rows = [
      { source: "Go", target: "围棋", targetLanguage: "cmn", caseSensitive: true },
      { source: "api", target: "接口", targetLanguage: "cmn", caseSensitive: false },
    ]
    expect(parseGlossaryCsv(formatGlossaryCsv(rows)).rows).toEqual(rows)
  })

  it("leaves the case cell blank for a row that does not say", () => {
    const rows = [{ source: "GPU", target: "显卡" }]
    expect(formatGlossaryCsv(rows).split("\n")[1]).toBe("GPU,显卡,,")
    expect(parseGlossaryCsv(formatGlossaryCsv(rows)).rows).toEqual(rows)
  })

  it("survives its own BOM, so an Excel-friendly export still re-imports", () => {
    const rows = [{ source: "GPU", target: "显卡", targetLanguage: "cmn", caseSensitive: true }]
    expect(parseGlossaryCsv(UTF8_BOM + formatGlossaryCsv(rows)).rows).toEqual(rows)
  })

  it("emits no id column, so exporting and re-importing cannot duplicate a list", () => {
    // Identity is derived from the source term; an id column would make
    // export-on-A -> import-on-B -> sync produce two rows per term.
    expect(formatGlossaryCsv([{ source: "a", target: "b" }])).not.toMatch(/\bid\b/)
  })
})

describe("parseGlossaryCsv — the case-sensitive column", () => {
  it.each([
    ["true", true],
    ["TRUE", true],
    ["yes", true],
    ["1", true],
    ["false", false],
    ["no", false],
    ["0", false],
  ])("reads %s as %s", (cell, expected) => {
    expect(parseGlossaryCsv(`Go,围棋,cmn,${cell}`).rows[0]?.caseSensitive).toBe(expected)
  })

  it.each([
    ["", "blank"],
    ["maybe", "a word we do not know"],
  ])("leaves it unset for %s (%s), so the import's own setting answers", (cell) => {
    expect(parseGlossaryCsv(`Go,围棋,cmn,${cell}`).rows[0]).toEqual({
      source: "Go",
      target: "围棋",
      targetLanguage: "cmn",
    })
  })

  it("sniffs off a four-column header", () => {
    expect(
      parseGlossaryCsv("source,target,targetLanguage,caseSensitive\nGo,围棋,cmn,true").rows,
    ).toEqual([{ source: "Go", target: "围棋", targetLanguage: "cmn", caseSensitive: true }])
  })

  it("still treats a fourth field that names nothing we write as data", () => {
    // Two header-looking words plus junk is a row whose source happens to be
    // called "source", not a header.
    expect(parseGlossaryCsv("source,target,cmn,whatever").rows).toHaveLength(1)
  })
})

describe("parseGlossaryCsv — a quoted field spanning lines", () => {
  /**
   * Splitting on newlines before parsing quotes left the continuation as its own
   * line, and a line with no comma is a bare source with an EMPTY target — which
   * is the keep-original instruction. A stray newline in a third-party file
   * therefore installed a silent do-not-translate rule.
   */
  it("joins the continuation instead of emitting a keep-original fragment", () => {
    const { rows, skipped } = parseGlossaryCsv('Chort Bay,"雀特湾\n（港口）"\nHelldiver,地狱潜兵')
    expect(rows).toEqual([
      { source: "Chort Bay", target: "雀特湾\n（港口）" },
      { source: "Helldiver", target: "地狱潜兵" },
    ])
    expect(rows.some((row) => row.target === "")).toBe(false)
    expect(skipped).toEqual([])
  })

  it("joins a field spanning three lines, and across CRLF", () => {
    const { rows } = parseGlossaryCsv('a,"one\r\ntwo\r\nthree"\r\nb,2')
    expect(rows).toEqual([
      { source: "a", target: "one\ntwo\nthree" },
      { source: "b", target: "2" },
    ])
  })

  it("leaves an escaped quote pair from flipping the state", () => {
    // `""` is two quotes, so parity is unchanged and the record ends on its line.
    const { rows } = parseGlossaryCsv('"say ""hi""",打招呼\nGPU,显卡')
    expect(rows).toEqual([
      { source: 'say "hi"', target: "打招呼" },
      { source: "GPU", target: "显卡" },
    ])
  })

  it("numbers a later skipped row by its own line, not the record count", () => {
    const { rows, skipped } = parseGlossaryCsv('Chort Bay,"雀特湾\n（港口）"\n,orphan')
    expect(rows).toHaveLength(1)
    expect(skipped).toEqual([{ line: 3, reason: "empty" }])
  })

  it("keeps the last row when the file ends inside a quoted field", () => {
    expect(parseGlossaryCsv('GPU,显卡\nCPU,"处理器').rows).toEqual([
      { source: "GPU", target: "显卡" },
      { source: "CPU", target: "处理器" },
    ])
  })
})

describe("decodeGlossaryCsv", () => {
  // Byte literals rather than `TextEncoder`: `vitest.setup.ts` replaces the
  // global with a JSDOM-compatible shim that writes one byte per CHARACTER, so
  // 显 (U+663E) encodes as 0x3E. Only the encoder is shimmed, not `TextDecoder`,
  // which is all the code under test uses.
  const bytes = (...values: number[]) => new Uint8Array(values).buffer
  // "GPU," then 显 + 卡.
  const UTF8 = [0x47, 0x50, 0x55, 0x2c, 0xe6, 0x98, 0xbe, 0xe5, 0x8d, 0xa1]
  const GB18030 = [0x47, 0x50, 0x55, 0x2c, 0xcf, 0xd4, 0xbf, 0xa8]

  it("decodes UTF-8", () => {
    expect(decodeGlossaryCsv(bytes(...UTF8))).toBe("GPU,显卡")
  })

  /**
   * What Excel writes on a Chinese Windows. `File.text()` is UTF-8 only and
   * turns these bytes into replacement characters rather than an error, so the
   * import used to succeed with terms made of U+FFFD — non-empty, short enough,
   * and past every check we have.
   */
  it("falls back to GB18030 for bytes that are not valid UTF-8", () => {
    expect(decodeGlossaryCsv(bytes(...GB18030))).toBe("GPU,显卡")
  })

  it("prefers UTF-8, which GB18030 would decode to something else entirely", () => {
    // The ladder must try strict UTF-8 FIRST: these same bytes are legal
    // GB18030 and mean different characters there.
    expect(new TextDecoder("gb18030").decode(bytes(...UTF8))).not.toBe("GPU,显卡")
    expect(decodeGlossaryCsv(bytes(...UTF8))).toBe("GPU,显卡")
  })

  it("hands the BOM through for the parser to strip", () => {
    expect(parseGlossaryCsv(decodeGlossaryCsv(bytes(0xef, 0xbb, 0xbf, ...UTF8))).rows).toEqual([
      { source: "GPU", target: "显卡" },
    ])
  })

  it("never returns the replacement characters `File.text()` would have", () => {
    expect(decodeGlossaryCsv(bytes(...GB18030))).not.toContain("\uFFFD")
  })
})

describe("resolveRowTargetLanguage", () => {
  it("uses the import's language when the row names none", () => {
    expect(resolveRowTargetLanguage({ source: "a", target: "b" }, "cmn")).toBe("cmn")
    expect(resolveRowTargetLanguage({ source: "a", target: "b", targetLanguage: "" }, "cmn")).toBe(
      "cmn",
    )
    expect(
      resolveRowTargetLanguage({ source: "a", target: "b", targetLanguage: "  " }, "cmn"),
    ).toBe("cmn")
  })

  it("keeps the language the row names", () => {
    expect(
      resolveRowTargetLanguage({ source: "a", target: "b", targetLanguage: "jpn" }, "cmn"),
    ).toBe("jpn")
  })

  /**
   * Dropped rather than filed under the import's language: a Japanese wording
   * buried in the Chinese list is somewhere the user would never look for it.
   */
  it("refuses a language it does not recognise", () => {
    expect(
      resolveRowTargetLanguage({ source: "a", target: "b", targetLanguage: "zz" }, "cmn"),
    ).toBeNull()
    expect(
      resolveRowTargetLanguage({ source: "a", target: "b", targetLanguage: "Chinese" }, "cmn"),
    ).toBeNull()
  })
})
