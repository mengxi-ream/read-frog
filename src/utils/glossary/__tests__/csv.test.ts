import type { ParsedGlossaryRow } from "../csv"
import { describe, expect, it } from "vitest"
import { MAX_GLOSSARY_SOURCE_LENGTH } from "../../constants/glossary"
import {
  decodeGlossaryCsv,
  formatGlossaryCsv,
  parseGlossaryCsv,
  parseTargetLanguageCell,
  UTF8_BOM,
} from "../csv"
import { ALL_LANGUAGES } from "../target-language"

const HEADER = "source,target,targetLanguage,caseSensitive"

/** Parse a body under the required header, failing loudly if the file is refused. */
function parse(body: string) {
  const result = parseGlossaryCsv(`${HEADER}\n${body}`)
  if (!result.ok) throw new Error(`refused: ${result.reason}`)
  return result
}

describe("parseGlossaryCsv — the header is required", () => {
  /**
   * The columns carry a term's identity: `caseSensitive` is half of `matchKey`
   * and `targetLanguage` is the other axis a term is filed under. A file that
   * does not name them cannot be placed, and the importer used to fill the gap
   * from two controls on the screen — so the same file imported differently
   * depending on how they happened to be set.
   */
  it.each([
    ["a two-column file, which is what other tools export", "GPU,显卡"],
    ["a bare term with no comma at all", "Acheron"],
    ["a three-column file, missing the case rule", "source,target,targetLanguage\nGPU,显卡,cmn"],
    ["data whose first row merely looks like a header", "source,target,cmn,whatever"],
    [
      "a header in the wrong order",
      "target,source,targetLanguage,caseSensitive\n显卡,GPU,cmn,true",
    ],
    ["an empty file", ""],
    ["nothing but blank lines", "   \n  "],
  ])("refuses %s", (_case, content) => {
    expect(parseGlossaryCsv(content)).toEqual({ ok: false, reason: "missing-header" })
  })

  it("accepts the header this module writes", () => {
    expect(parse("GPU,显卡,cmn,false").rows).toEqual([
      { source: "GPU", target: "显卡", targetLanguage: "cmn", caseSensitive: false },
    ])
  })

  /** Spreadsheets retitle columns; the shape is what matters, not the spelling. */
  it.each([
    "Source,Target,Target Language,Match Case",
    "term,translation,lang,case",
    "  source , target , targetlanguage , casesensitive  ",
  ])("accepts the alias header %s", (header) => {
    expect(parseGlossaryCsv(`${header}\nGPU,显卡,cmn,true`)).toMatchObject({
      ok: true,
      rows: [{ source: "GPU", target: "显卡", targetLanguage: "cmn", caseSensitive: true }],
    })
  })

  it("finds the header past leading blank lines and a BOM", () => {
    expect(parseGlossaryCsv(`${UTF8_BOM}\n\n${HEADER}\nGPU,显卡,cmn,true`)).toMatchObject({
      ok: true,
    })
  })
})

describe("parseGlossaryCsv — rows", () => {
  it("keeps an empty target, which means keep the original wording", () => {
    expect(parse("Acheron,,cmn,false").rows).toEqual([
      { source: "Acheron", target: "", targetLanguage: "cmn", caseSensitive: false },
    ])
  })

  it("honours quoted fields with embedded commas and escaped quotes", () => {
    expect(parse('"Smith, John",史密斯,cmn,false\n"say ""hi""",打招呼,cmn,false').rows).toEqual([
      { source: "Smith, John", target: "史密斯", targetLanguage: "cmn", caseSensitive: false },
      { source: 'say "hi"', target: "打招呼", targetLanguage: "cmn", caseSensitive: false },
    ])
  })

  it("ignores blank lines and columns past the fourth", () => {
    const { rows } = parse("GPU,显卡,cmn,false,extra\n\n\nCPU,处理器,cmn,false\n")
    expect(rows.map((row) => row.source)).toEqual(["GPU", "CPU"])
  })

  it("handles CRLF and lone CR line endings", () => {
    expect(parse("a,1,cmn,false\r\nb,2,cmn,false\rc,3,cmn,false").rows).toHaveLength(3)
  })

  /** One bad row must not cost the user the rest of the file. */
  it("skips a bad row with its line number rather than failing the file", () => {
    const tooLong = "x".repeat(MAX_GLOSSARY_SOURCE_LENGTH + 1)
    const { rows, skipped } = parse(
      [
        "Good,好,cmn,false",
        ",orphan,cmn,false",
        `${tooLong},nope,cmn,false`,
        "NoLang,x,,false",
        "BadLang,x,zz,false",
        "NoCase,x,cmn,",
        "BadCase,x,cmn,maybe",
      ].join("\n"),
    )
    expect(rows).toEqual([
      { source: "Good", target: "好", targetLanguage: "cmn", caseSensitive: false },
    ])
    expect(skipped).toEqual([
      { line: 3, reason: "empty" },
      { line: 4, reason: "too-long" },
      { line: 5, reason: "unknown-language" },
      { line: 6, reason: "unknown-language" },
      { line: 7, reason: "missing-field" },
      { line: 8, reason: "missing-field" },
    ])
  })

  it("returns no rows for a header with nothing under it", () => {
    expect(parse("").rows).toEqual([])
  })

  it.each([
    ["true", true],
    ["TRUE", true],
    ["yes", true],
    ["1", true],
    ["false", false],
    ["no", false],
    ["0", false],
  ])("reads the case cell %s as %s", (cell, expected) => {
    expect(parse(`Go,围棋,cmn,${cell}`).rows[0]?.caseSensitive).toBe(expected)
  })
})

describe("parseGlossaryCsv — a quoted field spanning lines", () => {
  /**
   * Splitting on newlines before parsing quotes left the continuation as its own
   * record, which under the old tolerant parser became a bare source with an
   * empty target — a silent do-not-translate rule. It is now a skipped row
   * instead, but joining it is still the only correct reading.
   */
  it("joins the continuation instead of emitting a fragment", () => {
    const { rows, skipped } = parse(
      'Chort Bay,"雀特湾\n（港口）",cmn,false\nHelldiver,地狱潜兵,cmn,false',
    )
    expect(rows).toEqual([
      {
        source: "Chort Bay",
        target: "雀特湾\n（港口）",
        targetLanguage: "cmn",
        caseSensitive: false,
      },
      { source: "Helldiver", target: "地狱潜兵", targetLanguage: "cmn", caseSensitive: false },
    ])
    expect(skipped).toEqual([])
  })

  it("joins a field spanning three lines, and across CRLF", () => {
    const { rows } = parse('a,"one\r\ntwo\r\nthree",cmn,false\r\nb,2,cmn,false')
    expect(rows.map((row) => row.target)).toEqual(["one\ntwo\nthree", "2"])
  })

  it("keeps an escaped quote pair from flipping the state", () => {
    const { rows } = parse('"say ""hi""",打招呼,cmn,false\nGPU,显卡,cmn,false')
    expect(rows.map((row) => row.source)).toEqual(['say "hi"', "GPU"])
  })

  it("numbers a later skipped row by its own line, not the record count", () => {
    const { skipped } = parse('Chort Bay,"雀特湾\n（港口）",cmn,false\n,orphan,cmn,false')
    expect(skipped).toEqual([{ line: 4, reason: "empty" }])
  })

  /**
   * An unclosed quote swallows the rest of the file, so the row it starts has no
   * language or case cell left. Skipped and counted, which is the honest answer:
   * the old parser salvaged a two-field row here, and under the strict format
   * that would mean inventing the two columns it ate.
   */
  it("skips, rather than salvages, a row left open by an unclosed quote", () => {
    const { rows, skipped } = parse('GPU,显卡,cmn,false\nCPU,"处理器,cmn,false')
    expect(rows.map((row) => row.source)).toEqual(["GPU"])
    expect(skipped).toEqual([{ line: 3, reason: "missing-field" }])
  })
})

describe("formatGlossaryCsv", () => {
  const rows = [
    { source: "Smith, John", target: "史密斯", targetLanguage: "cmn", caseSensitive: false },
    { source: 'say "hi"', target: "打招呼", targetLanguage: "jpn", caseSensitive: false },
    { source: "Acheron", target: "", targetLanguage: "cmn", caseSensitive: true },
  ] as const

  it("round-trips through the parser", () => {
    expect(parse(formatGlossaryCsv(rows).split("\n").slice(1).join("\n")).rows).toEqual([...rows])
  })

  it("writes a header the parser accepts, so an export re-imports as it is", () => {
    expect(parseGlossaryCsv(formatGlossaryCsv(rows))).toMatchObject({ ok: true, rows: [...rows] })
  })

  it("writes the header this module requires", () => {
    expect(formatGlossaryCsv(rows).split("\n")[0]).toBe(HEADER)
  })

  it("fills every cell, so no exported row can be skipped on the way back in", () => {
    const lines = formatGlossaryCsv(rows).split("\n").slice(1)
    expect(lines.every((line) => !/,,|,$/.test(line.replace(/^[^,]*,[^,]*/, "x")))).toBe(true)
  })

  /**
   * The round trip the product recommends before an irreversible delete. Without
   * the case column every case-sensitive term came back under `i:` instead of
   * `s:`, missed the row it came from, and was inserted BESIDE it.
   */
  it("round-trips the case flag, which is half of a term's identity", () => {
    const cased: ParsedGlossaryRow[] = [
      { source: "Go", target: "围棋", targetLanguage: "cmn", caseSensitive: true },
      { source: "api", target: "接口", targetLanguage: "cmn", caseSensitive: false },
    ]
    expect(parseGlossaryCsv(formatGlossaryCsv(cased))).toMatchObject({ ok: true, rows: cased })
  })

  it("survives its own BOM, so an Excel-friendly export still re-imports", () => {
    expect(parseGlossaryCsv(UTF8_BOM + formatGlossaryCsv(rows))).toMatchObject({ ok: true })
  })

  it("emits no id column, so exporting and re-importing cannot duplicate a list", () => {
    expect(formatGlossaryCsv(rows)).not.toMatch(/\bid\b/)
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
    expect(new TextDecoder("gb18030").decode(bytes(...UTF8))).not.toBe("GPU,显卡")
    expect(decodeGlossaryCsv(bytes(...UTF8))).toBe("GPU,显卡")
  })

  it("never returns the replacement characters `File.text()` would have", () => {
    expect(decodeGlossaryCsv(bytes(...GB18030))).not.toContain("\uFFFD")
  })
})

describe("parseTargetLanguageCell", () => {
  it("keeps the language the cell names", () => {
    expect(parseTargetLanguageCell("jpn")).toBe("jpn")
  })

  /**
   * What an export writes for a row not written for any one language. Read
   * case-insensitively because a spreadsheet is as likely to hand it back
   * capitalised as it took it.
   */
  it("keeps an all-languages cell as one", () => {
    expect(parseTargetLanguageCell("all")).toBe(ALL_LANGUAGES)
    expect(parseTargetLanguageCell("ALL")).toBe(ALL_LANGUAGES)
  })

  /**
   * Dropped rather than filed under some default: a Japanese wording buried in
   * the Chinese list is somewhere the user would never look for it.
   */
  it("refuses a cell that names no language we know", () => {
    expect(parseTargetLanguageCell("zz")).toBeNull()
    expect(parseTargetLanguageCell("Chinese")).toBeNull()
    expect(parseTargetLanguageCell("")).toBeNull()
  })
})
