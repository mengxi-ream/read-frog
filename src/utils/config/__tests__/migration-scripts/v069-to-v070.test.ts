import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v069-to-v070"

describe("v069-to-v070 migration", () => {
  it("moves Bedrock connectionOptions.region to providerSpecificSettings.region", () => {
    const migrated = migrate({
      providersConfig: [
        {
          id: "bedrock-1",
          name: "Amazon Bedrock",
          enabled: true,
          provider: "bedrock",
          connectionOptions: {
            region: "us-west-2",
          },
        },
      ],
    })

    expect(migrated.providersConfig[0]).not.toHaveProperty("connectionOptions")
    expect(migrated.providersConfig[0].providerSpecificSettings).toEqual({
      region: "us-west-2",
    })
  })

  it("defaults missing or empty Bedrock region to us-east-1", () => {
    const migrated = migrate({
      providersConfig: [
        {
          id: "bedrock-missing",
          name: "Amazon Bedrock Missing",
          enabled: true,
          provider: "bedrock",
        },
        {
          id: "bedrock-empty",
          name: "Amazon Bedrock Empty",
          enabled: true,
          provider: "bedrock",
          connectionOptions: {
            region: "   ",
          },
        },
      ],
    })

    expect(migrated.providersConfig[0].providerSpecificSettings).toEqual({
      region: "us-east-1",
    })
    expect(migrated.providersConfig[1].providerSpecificSettings).toEqual({
      region: "us-east-1",
    })
  })

  it("removes stale settings from non-Bedrock providers", () => {
    const migrated = migrate({
      providersConfig: [
        {
          id: "openai-1",
          name: "OpenAI",
          enabled: true,
          provider: "openai",
          connectionOptions: {
            timeoutMs: 5000,
          },
          providerSpecificSettings: {
            region: "us-west-2",
          },
        },
      ],
    })

    expect(migrated.providersConfig[0]).not.toHaveProperty("connectionOptions")
    expect(migrated.providersConfig[0]).not.toHaveProperty("providerSpecificSettings")
  })

  it("preserves existing Bedrock providerSpecificSettings.region and removes unknown setting keys", () => {
    const migrated = migrate({
      providersConfig: [
        {
          id: "bedrock-1",
          name: "Amazon Bedrock",
          enabled: true,
          provider: "bedrock",
          connectionOptions: {
            region: "us-east-1",
          },
          providerSpecificSettings: {
            region: "eu-central-1",
            timeoutMs: 5000,
          },
        },
      ],
    })

    expect(migrated.providersConfig[0].providerSpecificSettings).toEqual({
      region: "eu-central-1",
    })
  })
})
