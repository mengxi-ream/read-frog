import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { ParsedGlossaryRow } from "../csv"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import { GLOSSARY_REVISION_KEY, MAX_GLOSSARY_TERMS } from "../../constants/glossary"
import { formatGlossaryCsv, parseGlossaryCsv } from "../csv"
import { importGlossaryRows } from "../repository"

/**
 * An in-memory stand-in for the two Dexie calls `importGlossaryRows` makes
 * against `glossaryTerm`, faithful enough that a destructive bug shows up as
 * missing DATA rather than only as a missing spy call: `delete()` really drops
 * the rows and `bulkPut()` really writes them, so "the list survived a refused
 * import" is asserted on the rows themselves.
 */
const dexie = vi.hoisted(() => {
  interface StoredTerm {
    id: string
    glossaryId: string
    matchKey: string
    targetLang: string
    source: string
    target: string
    caseSensitive: boolean
    enabled: boolean
    updatedAt: Date
  }

  const state = { rows: [] as StoredTerm[] }
  const bulkPutSpy = vi.fn<(records: StoredTerm[]) => void>()
  const deleteSpy = vi.fn<(glossaryId: string) => void>()
  const transactionSpy = vi.fn<(mode: string) => void>()

  const glossaryTerm = {
    async count() {
      return state.rows.length
    },
    async bulkPut(records: StoredTerm[]) {
      bulkPutSpy(records)
      for (const record of records) {
        const index = state.rows.findIndex((row) => row.id === record.id)
        if (index === -1) state.rows.push(record)
        else state.rows[index] = record
      }
    },
    where(index: string) {
      // The real table is indexed; a query on anything else would throw in
      // Dexie too rather than silently matching nothing.
      if (index !== "glossaryId") {
        throw new Error(`glossaryTerm test double has no index "${index}"`)
      }
      return {
        equals(glossaryId: string) {
          const matching = () => state.rows.filter((row) => row.glossaryId === glossaryId)
          return {
            async toArray() {
              return matching()
            },
            async count() {
              return matching().length
            },
            async delete() {
              deleteSpy(glossaryId)
              const deleted = matching().length
              state.rows = state.rows.filter((row) => row.glossaryId !== glossaryId)
              return deleted
            },
          }
        },
      }
    },
  }

  return {
    state,
    bulkPutSpy,
    deleteSpy,
    transactionSpy,
    db: {
      glossaryTerm,
      async transaction(mode: string, _table: unknown, body: () => Promise<void>) {
        transactionSpy(mode)
        return body()
      },
    },
  }
})

vi.mock("@/utils/db/dexie/db", () => ({ db: dexie.db }))

const GLOSSARY_ID = "glossary-under-test"
const OTHER_GLOSSARY_ID = "glossary-untouched"

function storedTerm(overrides: Partial<(typeof dexie.state.rows)[number]>) {
  return {
    id: "seed",
    glossaryId: GLOSSARY_ID,
    matchKey: "i:seed",
    targetLang: "cmn",
    source: "seed",
    target: "种子",
    caseSensitive: false,
    enabled: true,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  }
}

function identify(rows: readonly (typeof dexie.state.rows)[number][]) {
  return rows.map((row) => ({
    glossaryId: row.glossaryId,
    source: row.source,
    targetLang: row.targetLang,
  }))
}

function importRows(
  rows: readonly ParsedGlossaryRow[],
  mode: "merge" | "replace",
  fallbackLang: LangCodeISO6393 = "cmn",
  /** The import's checkbox, which only answers for rows carrying no column. */
  caseSensitive = false,
) {
  return importGlossaryRows(GLOSSARY_ID, rows, mode, caseSensitive, fallbackLang)
}

/** Exactly what `exportGlossaryCsv` writes for a set of stored rows. */
function exportedCsv(rows: readonly (typeof dexie.state.rows)[number][]) {
  return formatGlossaryCsv(
    rows.map((row) => ({
      source: row.source,
      target: row.target,
      targetLanguage: row.targetLang,
      caseSensitive: row.caseSensitive,
    })),
  )
}

describe("importGlossaryRows — a round trip through the CSV", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dexie.state.rows = []
  })

  function seedMixedCaseList() {
    dexie.state.rows = [
      storedTerm({ id: "go", matchKey: "s:Go", source: "Go", target: "围棋", caseSensitive: true }),
      storedTerm({ id: "api", matchKey: "i:api", source: "api", target: "接口" }),
    ]
  }

  /**
   * The flow the product's own copy offers as the backup to take before an
   * irreversible delete. `caseSensitive` is half of `matchKey` (`s:` / `i:`), so
   * while the export dropped it, every case-sensitive term came back under the
   * other prefix, missed the row it came from, and was inserted BESIDE it: the
   * list doubled and the term quietly stopped honouring its case rule.
   */
  it("updates the rows it came from instead of inserting twins", async () => {
    seedMixedCaseList()
    const csv = exportedCsv(dexie.state.rows)

    // The checkbox says "not case sensitive" and must NOT win here: the file
    // names the flag per row, and that is the term's own identity.
    const result = await importRows(parseGlossaryCsv(csv).rows, "merge")

    expect(result).toMatchObject({ ok: true, added: 0, updated: 2 })
    expect(dexie.state.rows).toHaveLength(2)
    expect(dexie.state.rows.map((row) => row.matchKey).sort()).toEqual(["i:api", "s:Go"])
    expect(dexie.state.rows.find((row) => row.source === "Go")?.caseSensitive).toBe(true)
  })

  it("survives a second round trip without growing", async () => {
    seedMixedCaseList()
    await importRows(parseGlossaryCsv(exportedCsv(dexie.state.rows)).rows, "merge")
    await importRows(parseGlossaryCsv(exportedCsv(dexie.state.rows)).rows, "merge")
    expect(dexie.state.rows).toHaveLength(2)
  })

  it("still lets the import's checkbox answer for a file that carries no column", async () => {
    // Every file from another tool, and the shape the third column established.
    const { rows } = parseGlossaryCsv("Go,围棋")
    await importRows(rows, "merge", "cmn", true)
    expect(dexie.state.rows.map((row) => row.matchKey)).toEqual(["s:Go"])
    expect(dexie.state.rows[0]?.caseSensitive).toBe(true)
  })
})

describe("importGlossaryRows", () => {
  const storageValues = new Map<string, unknown>()

  // Vitest isolates the module registry per file, so swapping the methods on
  // the `storage` singleton stays inside this one — the same swap the guide
  // tracking tests make.
  beforeEach(() => {
    vi.clearAllMocks()
    dexie.state.rows = []
    storageValues.clear()
    storage.getItem = vi.fn<(...args: any[]) => any>((key: string) =>
      Promise.resolve(storageValues.get(key) ?? null),
    )
    storage.setItem = vi.fn<(...args: any[]) => any>((key: string, value: unknown) => {
      storageValues.set(key, value)
      return Promise.resolve()
    })
  })

  /** Nothing was written and no page was told to recompile its matcher. */
  function expectNothingHappened() {
    expect(dexie.transactionSpy).not.toHaveBeenCalled()
    expect(dexie.deleteSpy).not.toHaveBeenCalled()
    expect(dexie.bulkPutSpy).not.toHaveBeenCalled()
    expect(storageValues.get(GLOSSARY_REVISION_KEY)).toBeUndefined()
  }

  describe("refuses a file it can keep nothing from", () => {
    /**
     * The regression this guards: replace mode used to delete the whole
     * glossary, insert the empty record list, and report success. This is the
     * one table holding text the user typed, and there is no undo.
     */
    it("keeps the list when every row names a language we do not know", async () => {
      dexie.state.rows = [
        storedTerm({ id: "keep-gpu", matchKey: "i:gpu", source: "GPU", target: "显卡" }),
        storedTerm({ id: "keep-cpu", matchKey: "i:cpu", source: "CPU", target: "处理器" }),
      ]

      // BCP 47 tags, not the ISO 639-3 codes the extension files terms under.
      const result = await importRows(
        [
          { source: "GPU", target: "显卡", targetLanguage: "zh-CN" },
          { source: "CPU", target: "处理器", targetLanguage: "en" },
        ],
        "replace",
      )

      expect(result).toEqual({
        ok: false,
        added: 0,
        updated: 0,
        duplicatesInFile: 0,
        unknownLanguage: 2,
        reason: "no-valid-rows",
      })
      expect(dexie.state.rows.map((row) => row.id)).toEqual(["keep-gpu", "keep-cpu"])
      expectNothingHappened()
    })

    /** A third-party export whose third column is a note, not a language. */
    it("keeps the list when the third column was never a language", async () => {
      dexie.state.rows = [storedTerm({ id: "keep-gpu", matchKey: "i:gpu", source: "GPU" })]

      const result = await importRows(
        [
          { source: "Acheron", target: "", targetLanguage: "proper noun" },
          { source: "Helldiver", target: "地狱潜兵", targetLanguage: "keep original" },
        ],
        "replace",
      )

      expect(result.ok).toBe(false)
      expect(result.reason).toBe("no-valid-rows")
      expect(result.unknownLanguage).toBe(2)
      expect(dexie.state.rows.map((row) => row.id)).toEqual(["keep-gpu"])
      expectNothingHappened()
    })

    /**
     * Merge mode deletes nothing, so the damage there is smaller — but writing
     * zero records and bumping the revision still makes every open page throw
     * away a compiled matcher for an import that did nothing.
     */
    it("refuses the same file in merge mode too", async () => {
      dexie.state.rows = [storedTerm({ id: "keep-gpu", matchKey: "i:gpu", source: "GPU" })]

      const result = await importRows(
        [
          { source: "GPU", target: "显卡", targetLanguage: "zh-CN" },
          { source: "CPU", target: "处理器", targetLanguage: "en" },
        ],
        "merge",
      )

      expect(result.ok).toBe(false)
      expect(result.reason).toBe("no-valid-rows")
      expect(dexie.state.rows.map((row) => row.id)).toEqual(["keep-gpu"])
      expectNothingHappened()
    })

    /** The guard is "nothing survived", not "an unknown language appeared". */
    it("keeps the list when every row's source is blank", async () => {
      dexie.state.rows = [storedTerm({ id: "keep-gpu", matchKey: "i:gpu", source: "GPU" })]

      const result = await importRows(
        [
          { source: "   ", target: "显卡" },
          { source: "", target: "处理器" },
        ],
        "replace",
      )

      expect(result.ok).toBe(false)
      expect(result.reason).toBe("no-valid-rows")
      expect(result.unknownLanguage).toBe(0)
      expect(dexie.state.rows.map((row) => row.id)).toEqual(["keep-gpu"])
      expectNothingHappened()
    })
  })

  describe("does not over-trigger", () => {
    it("imports the valid rows of a partially valid file", async () => {
      dexie.state.rows = [
        storedTerm({ id: "replaced", matchKey: "i:gpu", source: "GPU" }),
        storedTerm({ id: "other", glossaryId: OTHER_GLOSSARY_ID, source: "elsewhere" }),
      ]

      const result = await importRows(
        [
          { source: "GPU", target: "显卡", targetLanguage: "zh-CN" },
          { source: "Helldiver", target: "地狱潜兵", targetLanguage: "cmn" },
        ],
        "replace",
      )

      expect(result).toEqual({
        ok: true,
        added: 1,
        updated: 0,
        duplicatesInFile: 0,
        unknownLanguage: 1,
      })
      expect(dexie.deleteSpy).toHaveBeenCalledWith(GLOSSARY_ID)
      expect(dexie.transactionSpy).toHaveBeenCalledWith("rw")
      expect(identify(dexie.state.rows)).toEqual([
        { glossaryId: OTHER_GLOSSARY_ID, source: "elsewhere", targetLang: "cmn" },
        { glossaryId: GLOSSARY_ID, source: "Helldiver", targetLang: "cmn" },
      ])
      expect(storageValues.get(GLOSSARY_REVISION_KEY)).toBe(1)
    })

    /**
     * The invariant is "never delete without inserting", so it does not matter
     * whether the file was empty or every row was dropped — a replace that would
     * write nothing is refused either way. Clearing a list on purpose goes
     * through `deleteAllGlossaryTerms`, behind its own confirm.
     */
    it("refuses an empty file in replace mode rather than clearing the glossary", async () => {
      dexie.state.rows = [
        storedTerm({ id: "kept", matchKey: "i:gpu", source: "GPU" }),
        storedTerm({ id: "other", glossaryId: OTHER_GLOSSARY_ID, source: "elsewhere" }),
      ]

      const result = await importRows([], "replace")

      expect(result).toEqual({
        ok: false,
        added: 0,
        updated: 0,
        duplicatesInFile: 0,
        unknownLanguage: 0,
        reason: "no-valid-rows",
      })
      expect(dexie.state.rows.map((row) => row.id)).toEqual(["kept", "other"])
      expect(dexie.transactionSpy).not.toHaveBeenCalled()
      expect(storageValues.get(GLOSSARY_REVISION_KEY)).toBeUndefined()
    })

    it("imports a two-column file under the language chosen for the import", async () => {
      const result = await importRows(
        [
          { source: "GPU", target: "显卡" },
          { source: "CPU", target: "处理器" },
        ],
        "merge",
        "jpn",
      )

      expect(result).toEqual({
        ok: true,
        added: 2,
        updated: 0,
        duplicatesInFile: 0,
        unknownLanguage: 0,
      })
      expect(identify(dexie.state.rows)).toEqual([
        { glossaryId: GLOSSARY_ID, source: "GPU", targetLang: "jpn" },
        { glossaryId: GLOSSARY_ID, source: "CPU", targetLang: "jpn" },
      ])
      expect(dexie.state.rows.map((row) => row.matchKey)).toEqual(["i:gpu", "i:cpu"])
      expect(storageValues.get(GLOSSARY_REVISION_KEY)).toBe(1)
    })
  })

  /** The older whole-file refusal, which the new one is modelled on. */
  it("still refuses an import that would overflow the cap, reporting by how much", async () => {
    dexie.state.rows = Array.from({ length: MAX_GLOSSARY_TERMS - 1 }, (_, index) =>
      storedTerm({
        id: `filler-${index}`,
        glossaryId: OTHER_GLOSSARY_ID,
        matchKey: `i:filler-${index}`,
        source: `filler-${index}`,
      }),
    )

    const result = await importRows(
      [
        { source: "GPU", target: "显卡" },
        { source: "CPU", target: "处理器" },
      ],
      "merge",
    )

    expect(result).toEqual({
      ok: false,
      added: 0,
      updated: 0,
      duplicatesInFile: 0,
      unknownLanguage: 0,
      reason: "overflow",
      overflowBy: 1,
    })
    expect(dexie.state.rows).toHaveLength(MAX_GLOSSARY_TERMS - 1)
    expectNothingHappened()
  })
})
