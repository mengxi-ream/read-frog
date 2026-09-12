import type { LangCodeISO6393 } from "@read-frog/definitions"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { MAX_GLOSSARY_SOURCE_LENGTH, MAX_GLOSSARY_TARGET_LENGTH } from "../constants/glossary"

/**
 * One row of a glossary CSV, after the file has been checked.
 *
 * Every field is REQUIRED, because the file is required to declare every field.
 * A term's identity is `(glossary, targetLang, matchKey)` and `caseSensitive` is
 * half of `matchKey`, so a file that leaves either unsaid does not identify the
 * rows it is describing — the importer would have to guess, and a wrong guess
 * files the term under a key the user cannot find it by.
 */
export interface ParsedGlossaryRow {
  source: string
  target: string
  targetLanguage: LangCodeISO6393
  caseSensitive: boolean
}

export interface GlossaryCsvSkip {
  /** 1-based line number, for the import summary. */
  line: number
  reason: "empty" | "too-long" | "unknown-language" | "missing-field"
}

export type GlossaryCsvParseResult =
  | { ok: true; rows: ParsedGlossaryRow[]; skipped: GlossaryCsvSkip[] }
  /** No usable header, so the file is not one of ours and its columns are unknown. */
  | { ok: false; reason: "missing-header" }

/**
 * What each column may be called.
 *
 * Per column rather than one shared set, so `target,source` is not accepted as a
 * header for a file whose columns are the other way round.
 */
const SOURCE_TOKENS = new Set(["source", "term", "original"])
const TARGET_TOKENS = new Set(["target", "translation"])
const LANGUAGE_TOKENS = new Set(["targetlanguage", "target language", "language", "lang"])
const CASE_TOKENS = new Set(["casesensitive", "case sensitive", "case", "matchcase", "match case"])

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

/**
 * Whether the first record names all four columns, in order.
 *
 * Required, not sniffed: the columns carry a term's identity, so a file that
 * does not name them is a file we cannot place its rows from. Rejecting it
 * whole is the honest answer — the alternative is to guess a language and a
 * case rule for every row, which is how an import lands terms under keys the
 * user never sees again.
 */
function hasRequiredHeader(fields: string[]): boolean {
  if (fields.length < 4) return false
  const at = (index: number) => (fields[index] ?? "").trim().toLowerCase()
  return (
    SOURCE_TOKENS.has(at(0)) &&
    TARGET_TOKENS.has(at(1)) &&
    LANGUAGE_TOKENS.has(at(2)) &&
    CASE_TOKENS.has(at(3))
  )
}

/** The fourth column's value, or `undefined` when the cell does not say either. */
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
 * Parse a glossary CSV, which must be the four-column file `formatGlossaryCsv`
 * writes: `source,target,targetLanguage,caseSensitive`.
 *
 * The header is required, and so is every cell. That is a deliberate narrowing:
 * the importer used to accept a two-column file and fill the missing halves
 * from a checkbox and a language picker on the import screen, which meant the
 * same file imported differently depending on controls the user had to
 * understand. The columns are a term's identity, so the file is the only honest
 * place for them, and a file that omits them is refused with a message naming
 * what is expected rather than being guessed at.
 *
 * A row that IS malformed inside a well-formed file is skipped and counted, not
 * fatal: one bad language code should not cost the user the other 900 rows.
 */
export function parseGlossaryCsv(content: string): GlossaryCsvParseResult {
  const rows: ParsedGlossaryRow[] = []
  const skipped: GlossaryCsvSkip[] = []
  // Strip a UTF-8 BOM: Excel writes one and it would otherwise become part of
  // the first source term — or, here, of the first header cell.
  const records = toRecords(content.replace(/^\ufeff/, ""))

  const first = records.find((record) => record.text.trim() !== "")
  if (first === undefined || !hasRequiredHeader(splitCsvLine(first.text))) {
    return { ok: false, reason: "missing-header" }
  }

  for (const record of records) {
    if (record === first || record.text.trim() === "") continue

    const fields = splitCsvLine(record.text)
    const source = (fields[0] ?? "").trim()
    const target = (fields[1] ?? "").trim()
    const targetLanguage = (fields[2] ?? "").trim()
    const caseSensitive = parseCaseSensitive(fields[3])

    if (source === "") {
      skipped.push({ line: record.line, reason: "empty" })
      continue
    }
    if (source.length > MAX_GLOSSARY_SOURCE_LENGTH || target.length > MAX_GLOSSARY_TARGET_LENGTH) {
      skipped.push({ line: record.line, reason: "too-long" })
      continue
    }
    if (caseSensitive === undefined) {
      skipped.push({ line: record.line, reason: "missing-field" })
      continue
    }
    if (!isKnownLanguageCode(targetLanguage)) {
      // Covers blank as well as unrecognised. Filing the row under some default
      // would bury a Japanese wording in the Chinese list, where the user would
      // never think to look for it.
      skipped.push({ line: record.line, reason: "unknown-language" })
      continue
    }

    rows.push({ source, target, targetLanguage, caseSensitive })
  }

  return { ok: true, rows, skipped }
}

function escapeCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * Serialise to exactly the shape `parseGlossaryCsv` requires, so an export
 * re-imports onto the rows it came from.
 *
 * All four columns are always written and always filled: a stored term knows
 * its language and its case rule, and those two are what let the round trip
 * land on the same keys instead of beside them.
 */
export function formatGlossaryCsv(rows: readonly ParsedGlossaryRow[]): string {
  const body = rows.map((row) =>
    [
      escapeCsvField(row.source),
      escapeCsvField(row.target),
      row.targetLanguage,
      String(row.caseSensitive),
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
