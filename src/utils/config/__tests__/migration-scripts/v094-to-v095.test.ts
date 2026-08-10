import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v094-to-v095"

function configWith() {
  return {
    translate: {
      providerId: "microsoft-translate-default",
      mode: "bilingual",
      page: { range: "main" },
    },
    selectionToolbar: {
      features: {
        translate: { enabled: true, providerId: "microsoft-translate-default" },
      },
    },
    language: { targetCode: "cmn" },
  }
}

describe("v094 to v095 migration", () => {
  it("renames the top-level translate section to pageTranslation", () => {
    const oldConfig = configWith()

    const result = migrate(oldConfig)

    expect(result.pageTranslation).toEqual(oldConfig.translate)
    expect("translate" in result).toBe(false)
  })

  it("keeps the selection toolbar translate feature under its old name", () => {
    const result = migrate(configWith())

    expect(result.selectionToolbar.features.translate).toEqual({
      enabled: true,
      providerId: "microsoft-translate-default",
    })
  })

  it("leaves the rest of the config untouched", () => {
    const oldConfig = configWith()
    const snapshot = structuredClone(oldConfig)

    const result = migrate(oldConfig)

    const { translate, ...restOfSnapshot } = snapshot
    expect(result).toEqual({ ...restOfSnapshot, pageTranslation: translate })
    expect(oldConfig).toEqual(snapshot)
  })

  it("drops the stale old section when the new key already exists", () => {
    const oldConfig = {
      ...configWith(),
      pageTranslation: { providerId: "openai-default" },
    }

    const result = migrate(oldConfig)

    expect(result.pageTranslation).toEqual({ providerId: "openai-default" })
    expect("translate" in result).toBe(false)
  })

  it("is idempotent", () => {
    const once = migrate(configWith())
    const twice = migrate(once)

    expect(twice).toBe(once)
  })

  it.each([
    ["null", null],
    ["a non-object", "config"],
    ["an array", []],
    ["a config without a translate section", { language: { targetCode: "cmn" } }],
  ])("returns %s unchanged", (_label, oldConfig) => {
    expect(migrate(oldConfig)).toBe(oldConfig)
  })
})
