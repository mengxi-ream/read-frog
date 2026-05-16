import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v070-to-v071"

function deeplxProvider(overrides: Record<string, any> = {}) {
  return {
    id: "deeplx-1",
    name: "DeepLX",
    enabled: true,
    provider: "deeplx",
    ...overrides,
  }
}

describe("v070-to-v071 migration", () => {
  it("defaults missing and empty DeepLX baseURL to the explicit api.deeplx.org placeholder endpoint", () => {
    const migrated = migrate({
      providersConfig: [
        deeplxProvider(),
        deeplxProvider({ id: "deeplx-empty", baseURL: "" }),
        deeplxProvider({ id: "deeplx-blank", baseURL: "   " }),
      ],
    })

    expect(migrated.providersConfig).toEqual([
      deeplxProvider({ baseURL: "https://api.deeplx.org/{{apiKey}}/translate" }),
      deeplxProvider({ id: "deeplx-empty", baseURL: "https://api.deeplx.org/{{apiKey}}/translate" }),
      deeplxProvider({ id: "deeplx-blank", baseURL: "https://api.deeplx.org/{{apiKey}}/translate" }),
    ])
  })

  it("rewrites the old api.deeplx.org implicit special case to the placeholder endpoint", () => {
    const migrated = migrate({
      providersConfig: [
        deeplxProvider({ baseURL: "https://api.deeplx.org", apiKey: "abc" }),
        deeplxProvider({ id: "deeplx-slash", baseURL: "https://api.deeplx.org/" }),
      ],
    })

    expect(migrated.providersConfig[0]).toMatchObject({
      apiKey: "abc",
      baseURL: "https://api.deeplx.org/{{apiKey}}/translate",
    })
    expect(migrated.providersConfig[1]).toMatchObject({
      baseURL: "https://api.deeplx.org/{{apiKey}}/translate",
    })
  })

  it("materializes old host-only URL construction with and without API keys", () => {
    const migrated = migrate({
      providersConfig: [
        deeplxProvider({ baseURL: "https://deeplx.vercel.app" }),
        deeplxProvider({ id: "with-key", baseURL: "https://deeplx.example.com/api", apiKey: "abc" }),
      ],
    })

    expect(migrated.providersConfig[0].baseURL).toBe("https://deeplx.vercel.app/translate")
    expect(migrated.providersConfig[1]).toMatchObject({
      apiKey: "abc",
      baseURL: "https://deeplx.example.com/api/{{apiKey}}/translate",
    })
  })

  it("migrates query token URLs and appends /translate to paths that previously relied on runtime construction", () => {
    const migrated = migrate({
      providersConfig: [
        deeplxProvider({ baseURL: "https://host.example/translate?token=abc" }),
        deeplxProvider({ id: "host-only", baseURL: "https://host.example?token=abc" }),
        deeplxProvider({ id: "path", baseURL: "https://host.example/api?foo=1&token=abc/&bar=2#frag" }),
      ],
    })

    expect(migrated.providersConfig[0]).toMatchObject({
      apiKey: "abc",
      baseURL: "https://host.example/translate?token={{apiKey}}",
    })
    expect(migrated.providersConfig[1]).toMatchObject({
      apiKey: "abc",
      baseURL: "https://host.example/translate?token={{apiKey}}",
    })
    expect(migrated.providersConfig[2]).toMatchObject({
      apiKey: "abc",
      baseURL: "https://host.example/api/translate?foo=1&token={{apiKey}}&bar=2#frag",
    })
  })

  it("preserves query token URLs when the existing API key conflicts or token params are ambiguous", () => {
    const conflictingProvider = deeplxProvider({
      baseURL: "https://host.example/translate?token=abc",
      apiKey: "different",
    })
    const duplicateProvider = deeplxProvider({
      id: "duplicate-token",
      baseURL: "https://host.example/translate?token=abc&token=def",
    })

    const migrated = migrate({
      providersConfig: [conflictingProvider, duplicateProvider],
    })

    expect(migrated.providersConfig).toEqual([conflictingProvider, duplicateProvider])
  })

  it("migrates existing placeholders to explicit /translate endpoints", () => {
    const migrated = migrate({
      providersConfig: [
        deeplxProvider({ baseURL: "https://host.example/{{apiKey}}" }),
        deeplxProvider({ id: "query", baseURL: "https://host.example?token={{apiKey}}" }),
        deeplxProvider({ id: "subdomain", baseURL: "https://{{apiKey}}.host.example" }),
        deeplxProvider({ id: "complete", baseURL: "https://host.example/{{apiKey}}/translate" }),
      ],
    })

    expect(migrated.providersConfig[0].baseURL).toBe("https://host.example/{{apiKey}}/translate")
    expect(migrated.providersConfig[1].baseURL).toBe("https://host.example/translate?token={{apiKey}}")
    expect(migrated.providersConfig[2].baseURL).toBe("https://{{apiKey}}.host.example/translate")
    expect(migrated.providersConfig[3].baseURL).toBe("https://host.example/{{apiKey}}/translate")
  })

  it("migrates safely identified path tokens and preserves ambiguous path tokens", () => {
    const genericPathToken = deeplxProvider({
      baseURL: "https://host.example/abc/translate",
    })
    const migrated = migrate({
      providersConfig: [
        genericPathToken,
        deeplxProvider({ id: "deeplx-org-token", baseURL: "https://api.deeplx.org/abc/translate" }),
        deeplxProvider({ id: "confirmed-token", baseURL: "https://host.example/api/abc/translate", apiKey: "abc" }),
      ],
    })

    expect(migrated.providersConfig[0]).toEqual(genericPathToken)
    expect(migrated.providersConfig[1]).toMatchObject({
      apiKey: "abc",
      baseURL: "https://api.deeplx.org/{{apiKey}}/translate",
    })
    expect(migrated.providersConfig[2]).toMatchObject({
      apiKey: "abc",
      baseURL: "https://host.example/api/{{apiKey}}/translate",
    })
  })

  it("preserves complete endpoints, invalid base URLs, non-string base URLs, and non-DeepLX providers", () => {
    const providersConfig = [
      deeplxProvider({ baseURL: "https://host.example/translate" }),
      deeplxProvider({ id: "subdomain-token", baseURL: "https://abc.host.example/translate" }),
      deeplxProvider({ id: "invalid", baseURL: "not-a-url" }),
      deeplxProvider({ id: "non-string", baseURL: 123 }),
      {
        id: "openai-1",
        name: "OpenAI",
        enabled: true,
        provider: "openai",
        baseURL: "https://host.example",
      },
    ]

    const migrated = migrate({ providersConfig })

    expect(migrated.providersConfig).toEqual(providersConfig)
  })

  it("is idempotent", () => {
    const config = {
      providersConfig: [
        deeplxProvider({ baseURL: "https://host.example?token=abc" }),
        deeplxProvider({ id: "host-only", baseURL: "https://host.example", apiKey: "abc" }),
        deeplxProvider({ id: "placeholder", baseURL: "https://{{apiKey}}.host.example" }),
      ],
    }

    const migrated = migrate(config)

    expect(migrate(migrated)).toEqual(migrated)
  })

  it("returns malformed config shapes unchanged", () => {
    const config = { providersConfig: null }
    expect(migrate(config)).toBe(config)
  })
})
