import { describe, expect, it } from "vitest"
import { configSchema } from "@/types/config/config"
import { resolveModelId } from "@/utils/providers/model-id"
import { migrate } from "../../migration-scripts/v090-to-v091"
import { migrate as migrateToV092 } from "../../migration-scripts/v091-to-v092"
import { testSeries as v090TestSeries } from "../example/v090"

const RETIRED_TO_LIVE: Array<[string, string]> = [
  ["command-r", "command-r-08-2024"],
  ["command-r-03-2024", "command-r-08-2024"],
  ["command-r-plus", "command-r-plus-08-2024"],
  ["command-r-plus-04-2024", "command-r-plus-08-2024"],
  ["command", "command-a-03-2025"],
  ["command-nightly", "command-a-03-2025"],
  ["command-light", "command-a-03-2025"],
  ["command-light-nightly", "command-a-03-2025"],
]

function cohereConfig(modelState: {
  model?: string | null
  isCustomModel?: boolean
  customModel?: string | null
}) {
  return {
    configSchemaVersion: 90,
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

describe("v090-to-v091 migration", () => {
  it.each(RETIRED_TO_LIVE)("moves the selector off retired %s onto %s", (retired, live) => {
    const migrated = migrate(cohereConfig({ model: retired }))

    expect(migrated.providersConfig[0].model).toEqual({
      model: live,
      isCustomModel: false,
      customModel: null,
    })
  })

  it.each(RETIRED_TO_LIVE)(
    "moves an active custom model off retired %s onto %s",
    (retired, live) => {
      // Ticking "enter custom model" copies the selected id into customModel, so a
      // retired id is the common shape here rather than something hand-typed.
      const migrated = migrate(
        cohereConfig({ model: retired, isCustomModel: true, customModel: retired }),
      )

      expect(migrated.providersConfig[0].model).toEqual({
        model: live,
        isCustomModel: false,
        customModel: null,
      })
      expect(resolveModelId(migrated.providersConfig[0].model)).toBe(live)
    },
  )

  it("matches retired ids case-insensitively and ignores surrounding whitespace", () => {
    const migrated = migrate(
      cohereConfig({ model: "command-r-plus", isCustomModel: true, customModel: "  Command-R  " }),
    )

    expect(migrated.providersConfig[0].model).toEqual({
      model: "command-r-08-2024",
      isCustomModel: false,
      customModel: null,
    })
  })

  it.each(RETIRED_TO_LIVE)(
    "rewrites the dormant selector %s but keeps a still-usable custom model",
    (retired, live) => {
      const migrated = migrate(
        cohereConfig({
          model: retired,
          isCustomModel: true,
          customModel: "my-private-cohere-model",
        }),
      )

      // `model` is validated against the live enum even in custom mode, so the dormant
      // selector has to become a valid id or the whole config gets thrown away.
      expect(migrated.providersConfig[0].model).toEqual({
        model: live,
        isCustomModel: true,
        customModel: "my-private-cohere-model",
      })
      expect(resolveModelId(migrated.providersConfig[0].model)).toBe("my-private-cohere-model")
    },
  )

  it("leaves a Cohere provider that is already on a live model untouched", () => {
    const oldConfig = cohereConfig({
      model: "command-r-08-2024",
      isCustomModel: true,
      customModel: "my-private-cohere-model",
    })
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated.providersConfig[0].model).toEqual({
      model: "command-r-08-2024",
      isCustomModel: true,
      customModel: "my-private-cohere-model",
    })
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toEqual(migrated)
  })

  it("does not touch other providers", () => {
    const oldConfig = cohereConfig({ model: "command" })
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
    expect(migrate(cohereConfig({ model: "command", isCustomModel: true }))).toEqual(
      cohereConfig({ model: "command-a-03-2025", isCustomModel: true }),
    )
  })

  // A retired id anywhere in the provider entry makes `configSchema` reject the whole
  // config, and `initializeConfig` answers that by rebuilding from defaults — API keys,
  // custom prompts and site rules included. Run the migration over a real full config
  // to prove the output still parses.
  it.each(RETIRED_TO_LIVE)(
    "keeps a full config schema-valid after migrating retired %s",
    (retired) => {
      const baseConfig = v090TestSeries["complex-config-from-v020"]!.config

      const migrated = migrate({
        ...baseConfig,
        providersConfig: [
          ...baseConfig.providersConfig,
          {
            id: "cohere-default",
            name: "Cohere",
            enabled: true,
            provider: "cohere",
            model: { model: retired, isCustomModel: true, customModel: retired },
          },
        ],
      })

      // The current schema is v092, so finish the remaining migration step before
      // validating this v091 output against it.
      const parseResult = configSchema.safeParse(migrateToV092(migrated))
      expect(parseResult.success).toBe(true)
    },
  )
})
