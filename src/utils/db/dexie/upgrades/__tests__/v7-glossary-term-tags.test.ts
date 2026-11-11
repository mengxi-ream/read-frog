import { describe, expect, it } from "vitest"
import { TAG_BY_CODE as CONFIG_TAG_BY_CODE } from "@/utils/config/migration-scripts/v121-to-v122"
import { moveGlossaryTermsToTags, TAG_BY_CODE } from "../v7-glossary-term-tags"

const T0 = new Date("2026-01-01T00:00:00.000Z")
const T1 = new Date("2026-02-01T00:00:00.000Z")

function term(
  id: string,
  targetLang: string,
  updatedAt: Date | undefined = T0,
  matchKey = "i:apple",
) {
  return {
    id,
    glossaryId: "g",
    targetLang,
    matchKey,
    source: "apple",
    target: id,
    caseSensitive: false,
    enabled: true,
    updatedAt,
  }
}

describe("moveGlossaryTermsToTags", () => {
  it("moves a term written under an ISO 639-3 code to the language's tag", () => {
    const { kept, droppedIds } = moveGlossaryTermsToTags([
      term("a", "cmn"),
      term("b", "cmn-Hant"),
      term("c", "por", T0, "i:bus"),
    ])

    expect(kept.map((t) => [t.id, t.targetLang])).toEqual([
      ["a", "zh-Hans"],
      ["b", "zh-Hant"],
      ["c", "pt-BR"],
    ])
    expect(droppedIds).toEqual([])
  })

  it("leaves tags, the all-languages value and anything outside the table as they are", () => {
    const { kept } = moveGlossaryTermsToTags([
      term("a", "zh-Hans"),
      term("b", "yue", T0, "i:bus"),
      term("c", "all", T0, "i:frog"),
      term("d", "tok", T0, "i:toki"),
    ])

    expect(kept.map((t) => t.targetLang)).toEqual(["zh-Hans", "yue", "all", "tok"])
  })

  it("keeps the newer row of one term written under both spellings", () => {
    // An old build that synced with an upgraded device holds both rows; writing
    // both onto zh-Hans would abort the upgrade and leave the database closed.
    const coded = term("coded", "cmn", T0)
    const tagged = term("tagged", "zh-Hans", T1)

    expect(moveGlossaryTermsToTags([coded, tagged])).toEqual({
      kept: [tagged],
      droppedIds: ["coded"],
    })
    expect(moveGlossaryTermsToTags([tagged, coded])).toEqual({
      kept: [tagged],
      droppedIds: ["coded"],
    })
    expect(
      moveGlossaryTermsToTags([term("coded", "por", T1), term("tagged", "pt-BR", T0)]),
    ).toEqual({ kept: [term("coded", "pt-BR", T1)], droppedIds: ["tagged"] })
  })

  it("does not throw on a row without a valid date", () => {
    const { kept } = moveGlossaryTermsToTags([term("a", "cmn", undefined), term("b", "zh-Hans")])

    expect(kept).toHaveLength(1)
  })

  it("moves languages with the same frozen table as the config's v122 migration", () => {
    // Two frozen copies on purpose; a glossary row and the config must not
    // disagree about which tag a code became.
    expect(TAG_BY_CODE).toEqual(CONFIG_TAG_BY_CODE)
    expect(Object.keys(TAG_BY_CODE)).toHaveLength(179)
  })
})
