import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v082-to-v083"

describe("v082-to-v083 migration", () => {
  it("updates Ollama /api base URLs", () => {
    const migrated = migrate({
      providersConfig: [
        {
          id: "ollama-default",
          provider: "ollama",
          baseURL: "http://127.0.0.1:11434/api",
        },
        {
          id: "remote-ollama",
          provider: "ollama",
          baseURL: "http://192.168.1.105:11434/api/",
        },
      ],
    })

    expect(migrated.providersConfig[0]).toEqual({
      id: "ollama-default",
      provider: "ollama",
      baseURL: "http://127.0.0.1:11434/",
    })
    expect(migrated.providersConfig[1]).toEqual({
      id: "remote-ollama",
      provider: "ollama",
      baseURL: "http://192.168.1.105:11434/",
    })
  })

  it("leaves non-Ollama providers unchanged", () => {
    const oldProvider = {
      id: "openai-default",
      provider: "openai",
      baseURL: "https://api.openai.com/v1",
    }

    const migrated = migrate({ providersConfig: [oldProvider] })

    expect(migrated.providersConfig[0]).toBe(oldProvider)
  })
})
