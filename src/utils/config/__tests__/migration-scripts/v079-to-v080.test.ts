import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v079-to-v080"

describe("v079-to-v080 migration", () => {
  it("migrates old xAI Grok selections to current Grok 4.20 0309 models", () => {
    const migrated = migrate({
      providersConfig: [
        {
          id: "xai-non-reasoning",
          provider: "xai",
          model: {
            model: "grok-4.20-non-reasoning",
            isCustomModel: false,
            customModel: "stale-xai-custom",
          },
        },
        {
          id: "xai-reasoning",
          provider: "xai",
          model: {
            model: "grok-4.20-reasoning",
            isCustomModel: false,
            customModel: null,
          },
        },
        {
          id: "xai-code",
          provider: "xai",
          model: {
            model: "grok-4.3",
            isCustomModel: true,
            customModel: "grok-code-fast-1",
          },
        },
      ],
    })

    expect(migrated.providersConfig[0].model).toEqual({
      model: "grok-4.20-0309-non-reasoning",
      isCustomModel: false,
      customModel: null,
    })
    expect(migrated.providersConfig[1].model).toEqual({
      model: "grok-4.20-0309-reasoning",
      isCustomModel: false,
      customModel: null,
    })
    expect(migrated.providersConfig[2].model).toEqual({
      model: "grok-4.20-0309-non-reasoning",
      isCustomModel: false,
      customModel: null,
    })
  })

  it("leaves unrelated providers, custom xAI models, and current dated Grok models untouched", () => {
    const migrated = migrate({
      providersConfig: [
        {
          id: "azure-default",
          provider: "azure",
          model: {
            model: "grok-code-fast-1",
            isCustomModel: false,
            customModel: null,
          },
        },
        {
          id: "xai-private-custom",
          provider: "xai",
          model: {
            model: "grok-4.3",
            isCustomModel: true,
            customModel: "private-xai-model",
          },
        },
        {
          id: "xai-current-dated",
          provider: "xai",
          model: {
            model: "grok-4.20-0309-non-reasoning",
            isCustomModel: false,
            customModel: "grok-code-fast-1",
          },
        },
        {
          id: "openai-default",
          provider: "openai",
          model: {
            model: "gpt-5.4-mini",
            isCustomModel: false,
            customModel: null,
          },
        },
      ],
    })

    expect(migrated.providersConfig[0].model).toEqual({
      model: "grok-code-fast-1",
      isCustomModel: false,
      customModel: null,
    })
    expect(migrated.providersConfig[1].model).toEqual({
      model: "grok-4.3",
      isCustomModel: true,
      customModel: "private-xai-model",
    })
    expect(migrated.providersConfig[2].model).toEqual({
      model: "grok-4.20-0309-non-reasoning",
      isCustomModel: false,
      customModel: "grok-code-fast-1",
    })
    expect(migrated.providersConfig[3].model).toEqual({
      model: "gpt-5.4-mini",
      isCustomModel: false,
      customModel: null,
    })
  })
})
