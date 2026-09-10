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
}

export interface GlossaryCsvParseResult {
  rows: ParsedGlossaryRow[]
  /** 1-based line numbers that were dropped, with the reason, for the import summary. */
  skipped: Array<{ line: number; reason: "empty" | "too-long" | "unknown-language" }>
}

const HEADER_TOKENS = new Set(["source", "term", "original", "target", "translation"])
const LANGUAGE_HEADER_TOKENS = new Set(["targetlanguage", "target language", "language", "lang"])

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
  // A third column only makes it a header if it names the language; anything
  // else there is data whose first two fields happen to read like column names.
  const third = (fields[2] ?? "").trim().toLowerCase()
  return third === "" || LANGUAGE_HEADER_TOKENS.has(third)
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
  const lines = content.replace(/^﻿/, "").split(/\r\n|\r|\n/)

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim()
    if (line === "") return

    const fields = splitCsvLine(rawLine)
    if (index === 0 && looksLikeHeader(fields)) return

    const source = (fields[0] ?? "").trim()
    const target = (fields[1] ?? "").trim()
    const targetLanguage = (fields[2] ?? "").trim()

    if (source === "") {
      skipped.push({ line: index + 1, reason: "empty" })
      return
    }
    if (source.length > MAX_GLOSSARY_SOURCE_LENGTH || target.length > MAX_GLOSSARY_TARGET_LENGTH) {
      skipped.push({ line: index + 1, reason: "too-long" })
      return
    }

    rows.push(targetLanguage === "" ? { source, target } : { source, target, targetLanguage })
  })

  return { rows, skipped }
}

function escapeCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * Serialise to the same shape `parseGlossaryCsv` accepts, so an export
 * re-imports to an identical list. A header is written because spreadsheets
 * need one and the parser sniffs it back off.
 */
export function formatGlossaryCsv(rows: readonly ParsedGlossaryRow[]): string {
  const body = rows.map(
    (row) =>
      `${escapeCsvField(row.source)},${escapeCsvField(row.target)},${escapeCsvField(row.targetLanguage ?? "")}`,
  )
  return ["source,target,targetLanguage", ...body].join("\n")
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
