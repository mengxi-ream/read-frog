import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v088-to-v089"

function cohereConfig(modelState: {
  model?: string
  isCustomModel?: boolean
  customModel?: string | null
}) {
  return {
    configSchemaVersion: 88,
    providersConfig: [
      {
        id: "cohere-default",
        name: "Cohere",
        enabled: true,
        provider: "cohere",
        model: {
          model: null,
          isCustomModel: false,
          customModel: null,
          ...modelState,
        },
      },
      {
        id: "openai-default",
        name: "OpenAI",
        enabled: true,
        provider: "openai",
        model: { model: "gpt-5.4-mini", isCustomModel: false, customModel: null },
      },
    ],
  }
}

describe("v088-to-v089 migration", () => {
  it.each([
    ["command-r-03-2024", "command-r-08-2024"],
    ["command-r", "command-r-08-2024"],
    ["command-r-plus-04-2024", "command-r-plus-08-2024"],
    ["command-r-plus", "command-r-plus-08-2024"],
    ["command", "command-r7b-12-2024"],
    ["command-nightly", "command-r7b-12-2024"],
    ["command-light", "command-r7b-12-2024"],
    ["command-light-nightly", "command-r7b-12-2024"],
  ])("migrates built-in deprecated Cohere model %s to %s", (deprecated, live) => {
    const migrated = migrate(
      cohereConfig({ model: deprecated, isCustomModel: false, customModel: null }),
    )

    expect(migrated.providersConfig[0].model).toEqual({
      model: live,
      isCustomModel: false,
      customModel: null,
    })
  })

  it.each([
    ["command-r-03-2024", "command-r-08-2024"],
    ["command-r", "command-r-08-2024"],
    ["command-r-plus-04-2024", "command-r-plus-08-2024"],
    ["command-r-plus", "command-r-plus-08-2024"],
    ["command", "command-r7b-12-2024"],
    ["command-nightly", "command-r7b-12-2024"],
    ["command-light", "command-r7b-12-2024"],
    ["command-light-nightly", "command-r7b-12-2024"],
  ])("migrates custom deprecated Cohere model %s to %s", (deprecated, live) => {
    const migrated = migrate(
      cohereConfig({ model: "command-r", isCustomModel: true, customModel: deprecated }),
    )

    expect(migrated.providersConfig[0].model).toEqual({
      model: live,
      isCustomModel: false,
      customModel: null,
    })
  })

  it("preserves an active custom Cohere model that is not deprecated", () => {
    const oldConfig = cohereConfig({
      model: "command",
      isCustomModel: true,
      customModel: "my-private-cohere-model",
    })
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated.providersConfig[0].model).toEqual({
      model: "command",
      isCustomModel: true,
      customModel: "my-private-cohere-model",
    })
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toEqual(migrated)
  })

  it("does not mutate other providers", () => {
    const oldConfig = cohereConfig({ model: "command", isCustomModel: false, customModel: null })
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated.providersConfig[1]).toEqual({
      id: "openai-default",
      name: "OpenAI",
      enabled: true,
      provider: "openai",
      model: { model: "gpt-5.4-mini", isCustomModel: false, customModel: null },
    })
    expect(oldConfig).toEqual(snapshot)
  })

  it("leaves malformed shapes unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate({})).toEqual({})
    expect(migrate({ providersConfig: null })).toEqual({ providersConfig: null })
    expect(migrate({ providersConfig: [null] })).toEqual({ providersConfig: [null] })
  })
})
