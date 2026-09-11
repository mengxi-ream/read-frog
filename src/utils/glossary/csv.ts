import type { LangCodeISO6393 } from "@read-frog/definitions"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { MAX_GLOSSARY_SOURCE_LENGTH, MAX_GLOSSARY_TARGET_LENGTH } from "../constants/glossary"

export interface ParsedGlossaryRow {
  source: string
  target: string
  /**
   * Which target language this wording is for, as written in the file. Left
   * undefined when the column is absent or blank, and the importer then files
   * the row under the language chosen for the import.
   */
  targetLanguage?: string
  /**
   * Whether this term matches case-sensitively, as written in the file.
   *
   * Part of a term's IDENTITY (`buildMatchKey` prefixes `s:` or `i:`), so
   * without it an export could not be re-imported onto the rows it came from:
   * every case-sensitive term came back under a different key, landed beside
   * its original as a second row, and took the case rule off the term.
   *
   * Undefined — absent, blank, or unrecognised — means "use the setting chosen
   * for this import", exactly as a blank language column does.
   */
  caseSensitive?: boolean
}

export interface GlossaryCsvParseResult {
  rows: ParsedGlossaryRow[]
  /** 1-based line numbers that were dropped, with the reason, for the import summary. */
  skipped: Array<{ line: number; reason: "empty" | "too-long" | "unknown-language" }>
}

const HEADER_TOKENS = new Set(["source", "term", "original", "target", "translation"])
const LANGUAGE_HEADER_TOKENS = new Set(["targetlanguage", "target language", "language", "lang"])
const CASE_HEADER_TOKENS = new Set([
  "casesensitive",
  "case sensitive",
  "case",
  "matchcase",
  "match case",
])

/** Split one CSV line honouring double-quoted fields with `""` escaping. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ",") {
      fields.push(field)
      field = ""
    } else {
      field += char
    }
  }
  fields.push(field)
  return fields
}

function looksLikeHeader(fields: string[]): boolean {
  if (fields.length < 2) return false
  if (!fields.slice(0, 2).every((field) => HEADER_TOKENS.has(field.trim().toLowerCase()))) {
    return false
  }
  // A third or fourth column only makes it a header if it names what we write
  // there; anything else is data whose first two fields happen to read like
  // column names.
  const third = (fields[2] ?? "").trim().toLowerCase()
  if (third !== "" && !LANGUAGE_HEADER_TOKENS.has(third)) return false
  const fourth = (fields[3] ?? "").trim().toLowerCase()
  return fourth === "" || CASE_HEADER_TOKENS.has(fourth)
}

/**
 * The fourth column's value, or `undefined` when the file does not say.
 *
 * Unrecognised text reads as "does not say" rather than as `false`: guessing
 * would quietly change a term's identity, and the import's own checkbox is a
 * better answer than a coin flip.
 */
function parseCaseSensitive(field: string | undefined): boolean | undefined {
  const value = (field ?? "").trim().toLowerCase()
  if (value === "true" || value === "yes" || value === "1") return true
  if (value === "false" || value === "no" || value === "0") return false
  return undefined
}

/** A line leaves a quoted field open when its quote count is odd; `""` adds two. */
function hasUnclosedQuote(text: string): boolean {
  let count = 0
  for (const char of text) {
    if (char === '"') count++
  }
  return count % 2 === 1
}

/**
 * Split the file into logical records, rejoining the lines a quoted field spans.
 *
 * Splitting on newlines and parsing quotes per line — which is what this did —
 * turns one multi-line field into a truncated row plus fragments, and a fragment
 * carries no comma, so it parses as a bare source with an EMPTY target. An empty
 * target is the keep-original instruction, so a single stray newline in a file
 * from another tool installs a silent do-not-translate rule.
 *
 * A record reports the line number of its FIRST line, because that is the line
 * the user's editor shows for the row.
 */
function toRecords(content: string): Array<{ line: number; text: string }> {
  const records: Array<{ line: number; text: string }> = []
  let pending: string | null = null
  let pendingLine = 0

  content.split(/\r\n|\r|\n/).forEach((rawLine, index) => {
    const text = pending === null ? rawLine : `${pending}\n${rawLine}`
    if (pending === null) pendingLine = index + 1
    if (hasUnclosedQuote(text)) {
      pending = text
      return
    }
    pending = null
    records.push({ line: pendingLine, text })
  })

  // A file whose last quoted field is never closed. Keep what is there rather
  // than dropping the row without a word; `splitCsvLine` closes it at the end.
  if (pending !== null) records.push({ line: pendingLine, text: pending })
  return records
}

/**
 * Parse `source,target,targetLanguage`. The third column is OPTIONAL: a
 * two-column file — everything exported before it existed, and everything other
 * tools produce — still imports, and its rows take the language chosen for the
 * import. Columns past the third are ignored rather than rejected.
 *
 * A line with NO comma is a valid entry meaning "keep this term in the original
 * language" — Immersive Translate rejects exactly this shape (its parser gates
 * on `includes(",")`), and it is the single most requested case in issue #942
 * (`Acheron`, `NeonRider_07`). Getting it wrong would drop precisely the rows
 * users care most about, silently.
 */
export function parseGlossaryCsv(content: string): GlossaryCsvParseResult {
  const rows: ParsedGlossaryRow[] = []
  const skipped: GlossaryCsvParseResult["skipped"] = []
  // Strip a UTF-8 BOM: Excel writes one and it would otherwise become part of
  // the first source term.
  const records = toRecords(content.replace(/^﻿/, ""))

  records.forEach((record, index) => {
    if (record.text.trim() === "") return

    const fields = splitCsvLine(record.text)
    if (index === 0 && looksLikeHeader(fields)) return

    const source = (fields[0] ?? "").trim()
    const target = (fields[1] ?? "").trim()
    const targetLanguage = (fields[2] ?? "").trim()
    const caseSensitive = parseCaseSensitive(fields[3])

    if (source === "") {
      skipped.push({ line: record.line, reason: "empty" })
      return
    }
    if (source.length > MAX_GLOSSARY_SOURCE_LENGTH || target.length > MAX_GLOSSARY_TARGET_LENGTH) {
      skipped.push({ line: record.line, reason: "too-long" })
      return
    }

    // Absent keys rather than explicit `undefined`, so a row a file said nothing
    // about is indistinguishable from one written before the column existed.
    const row: ParsedGlossaryRow = { source, target }
    if (targetLanguage !== "") row.targetLanguage = targetLanguage
    if (caseSensitive !== undefined) row.caseSensitive = caseSensitive
    rows.push(row)
  })

  return { rows, skipped }
}

function escapeCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * Serialise to the same shape `parseGlossaryCsv` accepts, so an export
 * re-imports onto the rows it came from. A header is written because
 * spreadsheets need one and the parser sniffs it back off.
 *
 * All four columns are written unconditionally, blank where a row says nothing,
 * so the header always describes the rows beneath it. The fourth is what makes
 * the round trip lossless: `caseSensitive` is half of a term's key, and an
 * export without it re-imported every case-sensitive term as a second row.
 */
export function formatGlossaryCsv(rows: readonly ParsedGlossaryRow[]): string {
  const body = rows.map((row) =>
    [
      escapeCsvField(row.source),
      escapeCsvField(row.target),
      escapeCsvField(row.targetLanguage ?? ""),
      row.caseSensitive === undefined ? "" : String(row.caseSensitive),
    ].join(","),
  )
  return ["source,target,targetLanguage,caseSensitive", ...body].join("\n")
}

/**
 * Prepended to an export, never to anything the parser is handed back.
 *
 * Excel reads a CSV's encoding from its first bytes and falls back to the system
 * code page without them, so a UTF-8 export with no BOM opens as mojibake on a
 * Chinese Windows — and "share your glossary with someone" means a file they can
 * open. `parseGlossaryCsv` strips it again, so the round trip is unaffected.
 */
export const UTF8_BOM = "\uFEFF"

/**
 * Decode a picked file, tolerating what spreadsheets actually write.
 *
 * `File.text()` is UTF-8 only, and a byte it cannot decode becomes U+FFFD rather
 * than an error — so a CSV saved by Excel on a Chinese Windows (GB18030 by
 * default) imported as terms built from replacement characters, every one of
 * them non-empty and short enough to pass every check we have. Decoding
 * STRICTLY first is what turns that silent corruption into a detectable miss.
 */
export function decodeGlossaryCsv(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer)
  } catch {
    try {
      // A superset of GBK and GB2312, so one decoder covers every Chinese
      // legacy encoding a spreadsheet emits.
      return new TextDecoder("gb18030").decode(buffer)
    } catch {
      // A runtime without the legacy tables. Lossy UTF-8 still beats refusing a
      // file the user picked.
      return new TextDecoder().decode(buffer)
    }
  }
}

/** Whether a string names a language the extension can translate into. */
export function isKnownLanguageCode(code: string): code is LangCodeISO6393 {
  return Object.hasOwn(LANG_CODE_TO_EN_NAME, code)
}

/**
 * Which language an imported row lands under.
 *
 * A blank third column means "whatever was chosen for this import", which is
 * every file written before the column existed. A filled one we do not
 * recognise returns null and the caller drops the row: filing it under the
 * import's language would bury a Japanese wording in the Chinese list, where
 * the user would never think to look for it.
 */
export function resolveRowTargetLanguage(
  row: ParsedGlossaryRow,
  fallbackLang: LangCodeISO6393,
): LangCodeISO6393 | null {
  const declared = row.targetLanguage?.trim()
  if (!declared) return fallbackLang
  return isKnownLanguageCode(declared) ? declared : null
}
