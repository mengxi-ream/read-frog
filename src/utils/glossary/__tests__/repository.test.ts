import type { ParsedGlossaryRow } from "../csv"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import { GLOSSARY_REVISION_KEY, MAX_GLOSSARY_TERMS } from "../../constants/glossary"
import { formatGlossaryCsv, parseGlossaryCsv } from "../csv"
import { importGlossaryRows, loadGlossaryEntries } from "../repository"

/**
 * An in-memory stand-in for the Dexie calls `importGlossaryRows` and
 * `loadGlossaryEntries` make, faithful enough that a destructive bug shows up as
 * missing DATA rather than only as a missing spy call: `delete()` really drops
 * the rows and `bulkPut()` really writes them, so "the list survived a refused
 * import" is asserted on the rows themselves.
 *
 * `glossary.orderBy("createdAt")` really sorts, because the cross-glossary
 * precedence rule IS that order and a double that returned insertion order
 * would pass a test the product fails.
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

  interface StoredGlossary {
    id: string
    name: string
    description: string
    enabled: boolean
    matchPatterns: string[]
    createdAt: Date
    updatedAt: Date
  }

  const state = { rows: [] as StoredTerm[], glossaries: [] as StoredGlossary[] }
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

  const glossary = {
    orderBy(index: string) {
      if (index !== "createdAt") {
        throw new Error(`glossary test double has no index "${index}"`)
      }
      return {
        async toArray() {
          return [...state.glossaries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
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
      glossary,
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

function importRows(rows: readonly ParsedGlossaryRow[], mode: "merge" | "replace") {
  return importGlossaryRows(GLOSSARY_ID, rows, mode)
}

/** A row as `parseGlossaryCsv` now hands it over: every field present. */
function csvRow(
  source: string,
  target: string,
  overrides: Partial<ParsedGlossaryRow> = {},
): ParsedGlossaryRow {
  return { source, target, targetLanguage: "cmn", caseSensitive: false, ...overrides }
}

/** Exactly what `exportGlossaryCsv` writes for a set of stored rows. */
function exportedCsv(rows: readonly (typeof dexie.state.rows)[number][]) {
  return formatGlossaryCsv(
    rows.map<ParsedGlossaryRow>((row) => ({
      source: row.source,
      target: row.target,
      targetLanguage: row.targetLang as ParsedGlossaryRow["targetLanguage"],
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
    const parsed = parseGlossaryCsv(csv)
    if (!parsed.ok) throw new Error("export did not re-parse")
    const result = await importRows(parsed.rows, "merge")

    expect(result).toMatchObject({ ok: true, added: 0, updated: 2 })
    expect(dexie.state.rows).toHaveLength(2)
    expect(dexie.state.rows.map((row) => row.matchKey).sort()).toEqual(["i:api", "s:Go"])
    expect(dexie.state.rows.find((row) => row.source === "Go")?.caseSensitive).toBe(true)
  })

  function reimport() {
    const parsed = parseGlossaryCsv(exportedCsv(dexie.state.rows))
    if (!parsed.ok) throw new Error("export did not re-parse")
    return importRows(parsed.rows, "merge")
  }

  it("survives a second round trip without growing", async () => {
    seedMixedCaseList()
    await reimport()
    await reimport()
    expect(dexie.state.rows).toHaveLength(2)
  })

  /**
   * The file is the only thing that answers this now. The import screen used to
   * carry a checkbox and a language picker for rows that named neither, which
   * meant one file could land under two different keys depending on controls
   * the user had to think about; `parseGlossaryCsv` requires the columns
   * instead, so a row that reaches here has already said which key it wants.
   */
  it("takes the case rule from the row, under the key the file asked for", async () => {
    await importRows([csvRow("Go", "围棋", { caseSensitive: true })], "merge")
    expect(dexie.state.rows.map((stored) => stored.matchKey)).toEqual(["s:Go"])
    expect(dexie.state.rows[0]?.caseSensitive).toBe(true)
  })

  it("files a row under the language the file names, not a default", async () => {
    await importRows([csvRow("Go", "囲碁", { targetLanguage: "jpn" })], "merge")
    expect(dexie.state.rows[0]?.targetLang).toBe("jpn")
  })

  /**
   * The language column is what carries a row's target language home, so a row
   * belonging to every language has to survive the trip like any other. If the
   * token came back unrecognised the row would be dropped; if it came back as a
   * language the row would land beside its original under a different key.
   */
  it("brings an all-languages row back as one", async () => {
    dexie.state.rows = [
      storedTerm({
        id: "react",
        matchKey: "i:react",
        source: "React",
        target: "",
        targetLang: "all",
      }),
    ]
    const csv = exportedCsv(dexie.state.rows)
    expect(csv).toContain(",all,")

    const parsed = parseGlossaryCsv(csv)
    if (!parsed.ok) throw new Error("export did not re-parse")
    const result = await importRows(parsed.rows, "merge")

    expect(result).toMatchObject({ ok: true, added: 0, updated: 1 })
    expect(identify(dexie.state.rows)).toEqual([
      { glossaryId: GLOSSARY_ID, source: "React", targetLang: "all" },
    ])
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
     *
     * Through the real parser, because that is now the first line of defence:
     * BCP 47 tags are not the ISO 639-3 codes terms are filed under, so every
     * row is dropped before the importer sees it and `rows` arrives empty.
     */
    it("keeps the list when every row names a language we do not know", async () => {
      dexie.state.rows = [
        storedTerm({ id: "keep-gpu", matchKey: "i:gpu", source: "GPU", target: "显卡" }),
        storedTerm({ id: "keep-cpu", matchKey: "i:cpu", source: "CPU", target: "处理器" }),
      ]

      const parsed = parseGlossaryCsv(
        "source,target,targetLanguage,caseSensitive\nGPU,显卡,zh-CN,false\nCPU,处理器,en,false",
      )
      if (!parsed.ok) throw new Error("header should have been accepted")
      expect(parsed.rows).toEqual([])
      expect(parsed.skipped.map((skip) => skip.reason)).toEqual([
        "unknown-language",
        "unknown-language",
      ])

      const result = await importRows(parsed.rows, "replace")

      expect(result).toMatchObject({ ok: false, reason: "no-valid-rows" })
      expect(dexie.state.rows.map((row) => row.id)).toEqual(["keep-gpu", "keep-cpu"])
      expectNothingHappened()
    })

    /**
     * Merge mode deletes nothing, so the damage there is smaller — but writing
     * zero records and bumping the revision still makes every open page throw
     * away a compiled matcher for an import that did nothing.
     */
    it("refuses the same file in merge mode too", async () => {
      dexie.state.rows = [storedTerm({ id: "keep-gpu", matchKey: "i:gpu", source: "GPU" })]

      const result = await importRows([], "merge")

      expect(result.ok).toBe(false)
      expect(result.reason).toBe("no-valid-rows")
      expect(dexie.state.rows.map((row) => row.id)).toEqual(["keep-gpu"])
      expectNothingHappened()
    })

    /** The guard is "nothing survived", not "an unknown language appeared". */
    it("keeps the list when every row's source is blank", async () => {
      dexie.state.rows = [storedTerm({ id: "keep-gpu", matchKey: "i:gpu", source: "GPU" })]

      const result = await importRows([csvRow("   ", "显卡"), csvRow("", "处理器")], "replace")

      expect(result.ok).toBe(false)
      expect(result.reason).toBe("no-valid-rows")
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

      // Through the parser, because that is where "partially valid" now lives:
      // the first row names a BCP 47 tag and is dropped, the second survives.
      const parsed = parseGlossaryCsv(
        "source,target,targetLanguage,caseSensitive\nGPU,显卡,zh-CN,false\nHelldiver,地狱潜兵,cmn,false",
      )
      if (!parsed.ok) throw new Error("header should have been accepted")
      expect(parsed.skipped.map((skip) => skip.reason)).toEqual(["unknown-language"])

      const result = await importRows(parsed.rows, "replace")

      expect(result).toEqual({
        ok: true,
        added: 1,
        updated: 0,
        duplicatesInFile: 0,
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
        reason: "no-valid-rows",
      })
      expect(dexie.state.rows.map((row) => row.id)).toEqual(["kept", "other"])
      expect(dexie.transactionSpy).not.toHaveBeenCalled()
      expect(storageValues.get(GLOSSARY_REVISION_KEY)).toBeUndefined()
    })

    it("files each row under the language its own row names", async () => {
      const result = await importRows(
        [
          csvRow("GPU", "显卡", { targetLanguage: "jpn" }),
          csvRow("CPU", "处理器", { targetLanguage: "jpn" }),
        ],
        "merge",
      )

      expect(result).toEqual({
        ok: true,
        added: 2,
        updated: 0,
        duplicatesInFile: 0,
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

    const result = await importRows([csvRow("GPU", "显卡"), csvRow("CPU", "处理器")], "merge")

    expect(result).toEqual({
      ok: false,
      added: 0,
      updated: 0,
      duplicatesInFile: 0,
      reason: "overflow",
      overflowBy: 1,
    })
    expect(dexie.state.rows).toHaveLength(MAX_GLOSSARY_TERMS - 1)
    expectNothingHappened()
  })
})

describe("loadGlossaryEntries — which wording a page gets", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dexie.state.rows = []
    dexie.state.glossaries = []
  })

  function storedGlossary(id: string, createdAt: string) {
    return {
      id,
      name: id,
      description: "",
      enabled: true,
      // Empty = every site, so `url` never has to be passed here.
      matchPatterns: [] as string[],
      createdAt: new Date(createdAt),
      updatedAt: new Date(createdAt),
    }
  }

  function wordings(entries: readonly { source: string; target: string }[]) {
    return entries.map((entry) => `${entry.source}=>${entry.target}`).sort()
  }

  /**
   * The keep-the-original case, which is the feature's headline ask: an empty
   * translation is an instruction to leave the word alone, and that is true in
   * every language. Filed under one language it stopped firing the moment the
   * user switched target language, with nothing on screen to say so.
   */
  it("sends an all-languages row to every language", async () => {
    dexie.state.glossaries = [storedGlossary("only", "2026-01-01")]
    dexie.state.rows = [
      storedTerm({
        id: "react",
        glossaryId: "only",
        matchKey: "i:react",
        source: "React",
        target: "",
        targetLang: "all",
      }),
    ]

    expect(wordings(await loadGlossaryEntries("cmn"))).toEqual(["React=>"])
    expect(wordings(await loadGlossaryEntries("jpn"))).toEqual(["React=>"])
  })

  it("still keeps a wording written for another language out", async () => {
    dexie.state.glossaries = [storedGlossary("only", "2026-01-01")]
    dexie.state.rows = [
      storedTerm({
        id: "go-jpn",
        glossaryId: "only",
        matchKey: "i:go",
        source: "Go",
        target: "囲碁",
        targetLang: "jpn",
      }),
    ]

    expect(await loadGlossaryEntries("cmn")).toEqual([])
    expect(wordings(await loadGlossaryEntries("jpn"))).toEqual(["Go=>囲碁"])
  })

  /**
   * Both rows are legal and both apply, so something has to decide. The specific
   * one does: the user wrote it for this language on purpose, while the
   * all-languages row is the fallback they wrote for the rest.
   */
  it("lets a wording written for this language beat the all-languages one", async () => {
    dexie.state.glossaries = [storedGlossary("only", "2026-01-01")]
    dexie.state.rows = [
      storedTerm({
        id: "go-all",
        glossaryId: "only",
        matchKey: "i:go",
        source: "Go",
        target: "",
        targetLang: "all",
      }),
      storedTerm({
        id: "go-cmn",
        glossaryId: "only",
        matchKey: "i:go",
        source: "Go",
        target: "围棋",
        targetLang: "cmn",
      }),
    ]

    expect(wordings(await loadGlossaryEntries("cmn"))).toEqual(["Go=>围棋"])
    expect(wordings(await loadGlossaryEntries("jpn"))).toEqual(["Go=>"])
  })

  /**
   * The rule cannot depend on which order the rows come back in. Dexie returns
   * them by index, which is not an order the user chose or can see, so without
   * the sort this is a coin flip that lands differently on two machines.
   */
  it("decides the same way whichever order the rows are stored in", async () => {
    dexie.state.glossaries = [storedGlossary("only", "2026-01-01")]
    dexie.state.rows = [
      storedTerm({
        id: "go-cmn",
        glossaryId: "only",
        matchKey: "i:go",
        source: "Go",
        target: "围棋",
        targetLang: "cmn",
      }),
      storedTerm({
        id: "go-all",
        glossaryId: "only",
        matchKey: "i:go",
        source: "Go",
        target: "",
        targetLang: "all",
      }),
    ]

    expect(wordings(await loadGlossaryEntries("cmn"))).toEqual(["Go=>围棋"])
  })

  /**
   * The precedence added above lives INSIDE one glossary's own group. Across
   * glossaries the older rule stands — the later glossary wins, because that is
   * the order the list is shown in — and an all-languages row in a later
   * glossary must not lose to a specific row in an earlier one.
   */
  it("keeps the later glossary winning, whichever language each row names", async () => {
    dexie.state.glossaries = [
      storedGlossary("older", "2026-01-01"),
      storedGlossary("newer", "2026-02-01"),
    ]
    dexie.state.rows = [
      storedTerm({
        id: "old-cmn",
        glossaryId: "older",
        matchKey: "i:go",
        source: "Go",
        target: "围棋",
        targetLang: "cmn",
      }),
      storedTerm({
        id: "new-all",
        glossaryId: "newer",
        matchKey: "i:go",
        source: "Go",
        target: "",
        targetLang: "all",
      }),
    ]

    expect(wordings(await loadGlossaryEntries("cmn"))).toEqual(["Go=>"])
  })

  it("drops a disabled all-languages row like any other", async () => {
    dexie.state.glossaries = [storedGlossary("only", "2026-01-01")]
    dexie.state.rows = [
      storedTerm({
        id: "off",
        glossaryId: "only",
        matchKey: "i:react",
        source: "React",
        target: "",
        targetLang: "all",
        enabled: false,
      }),
    ]

    expect(await loadGlossaryEntries("cmn")).toEqual([])
  })
})
