import type { SyncedGlossary, SyncedTerm } from "../document"
import { describe, expect, it } from "vitest"
import {
  formatGlossaryDocument,
  GLOSSARY_SYNC_SCHEMA_VERSION,
  parseGlossaryDocument,
} from "../document"

const glossary: SyncedGlossary = {
  id: "g",
  name: "Work",
  description: "terms for work",
  enabled: true,
  matchPatterns: ["*.example.com"],
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-02-01T00:00:00.000Z"),
}

const term: SyncedTerm = {
  id: "t",
  glossaryId: "g",
  matchKey: "s:Go",
  targetLang: "cmn",
  source: "Go",
  target: "围棋",
  caseSensitive: true,
  enabled: false,
  updatedAt: new Date("2026-02-02T00:00:00.000Z"),
}

describe("the sync document", () => {
  it("round-trips every field, dates included", () => {
    const parsed = parseGlossaryDocument(
      formatGlossaryDocument({ glossaries: [glossary], terms: [term] }),
    )
    expect(parsed).toEqual({
      ok: true,
      document: {
        schemaVersion: GLOSSARY_SYNC_SCHEMA_VERSION,
        glossaries: [glossary],
        terms: [term],
      },
    })
  })

  /**
   * A newer build may file a term under a value this one has never heard of —
   * `all` is the first. Rejecting the document over it would turn a
   * forward-compatible field into a sync that refuses to run, and dropping the
   * field would delete that term's language on every older device.
   */
  it("preserves a target language it does not recognise", () => {
    const exotic = { ...term, targetLang: "a-value-from-the-future" }
    const parsed = parseGlossaryDocument(
      formatGlossaryDocument({ glossaries: [glossary], terms: [exotic] }),
    )
    expect(parsed.ok && parsed.document.terms[0]?.targetLang).toBe("a-value-from-the-future")
  })

  /**
   * The distinction the config sync does not make. Read as an empty document,
   * an unreadable file says every row in the base was deleted remotely — which
   * wipes the glossary and then uploads the wipe.
   */
  it("reports a file it cannot read, rather than an empty glossary", () => {
    expect(parseGlossaryDocument("not json at all")).toEqual({ ok: false, reason: "malformed" })
    expect(parseGlossaryDocument("{}")).toEqual({ ok: false, reason: "malformed" })
    expect(parseGlossaryDocument(JSON.stringify({ schemaVersion: 1, glossaries: [] }))).toEqual({
      ok: false,
      reason: "malformed",
    })
  })

  it("refuses a row missing a field it cannot invent", () => {
    const content = JSON.stringify({
      schemaVersion: 1,
      glossaries: [],
      terms: [{ id: "t", glossaryId: "g", matchKey: "i:go", source: "Go" }],
    })
    expect(parseGlossaryDocument(content)).toEqual({ ok: false, reason: "malformed" })
  })

  /**
   * Stops rather than merging what it understands: a merge that silently drops a
   * field it has never heard of would upload the result and destroy that field
   * on every device, including the newer one that wrote it.
   */
  it("stops at a document written by a newer version", () => {
    const content = JSON.stringify({
      schemaVersion: GLOSSARY_SYNC_SCHEMA_VERSION + 1,
      glossaries: [],
      terms: [],
    })
    expect(parseGlossaryDocument(content)).toEqual({ ok: false, reason: "version-too-new" })
  })

  it("accepts an empty document, which is a glossary someone emptied", () => {
    const parsed = parseGlossaryDocument(formatGlossaryDocument({ glossaries: [], terms: [] }))
    expect(parsed.ok && parsed.document).toEqual({
      schemaVersion: GLOSSARY_SYNC_SCHEMA_VERSION,
      glossaries: [],
      terms: [],
    })
  })
})
