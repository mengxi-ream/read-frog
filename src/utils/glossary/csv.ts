import { MAX_GLOSSARY_SOURCE_LENGTH, MAX_GLOSSARY_TARGET_LENGTH } from "../constants/glossary"

export interface ParsedGlossaryRow {
  source: string
  target: string
}

export interface GlossaryCsvParseResult {
  rows: ParsedGlossaryRow[]
  /** 1-based line numbers that were dropped, with the reason, for the import summary. */
  skipped: Array<{ line: number; reason: "empty" | "too-long" }>
}

const HEADER_TOKENS = new Set(["source", "term", "original", "target", "translation"])

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
  return fields.slice(0, 2).every((field) => HEADER_TOKENS.has(field.trim().toLowerCase()))
}

/**
 * Parse `source,target`. Columns past the second are ignored rather than
 * rejected, so a file exported from another tool — or from a future version of
 * this one — still imports for the two columns we do understand.
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

    if (source === "") {
      skipped.push({ line: index + 1, reason: "empty" })
      return
    }
    if (source.length > MAX_GLOSSARY_SOURCE_LENGTH || target.length > MAX_GLOSSARY_TARGET_LENGTH) {
      skipped.push({ line: index + 1, reason: "too-long" })
      return
    }

    rows.push({ source, target })
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
  const body = rows.map((row) => `${escapeCsvField(row.source)},${escapeCsvField(row.target)}`)
  return ["source,target", ...body].join("\n")
}
