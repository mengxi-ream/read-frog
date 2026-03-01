import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { isAPIProviderConfig } from "@/types/config/provider"
import { CONFIG_SCHEMA_VERSION, DEFAULT_CONFIG } from "@/utils/constants/config"

const getItemMock = vi.fn()
const getMetaMock = vi.fn()
const setItemMock = vi.fn()
const setMetaMock = vi.fn()
const runMigrationMock = vi.fn()
const loggerWarnMock = vi.fn()

vi.mock("#imports", () => ({
  storage: {
    getItem: getItemMock,
    getMeta: getMetaMock,
    setItem: setItemMock,
    setMeta: setMetaMock,
  },
}))

vi.mock("wxt/utils/storage", () => ({
  storage: {
    getItem: getItemMock,
    getMeta: getMetaMock,
    setItem: setItemMock,
    setMeta: setMetaMock,
  },
}))

vi.mock("../migration", () => ({
  runMigration: runMigrationMock,
}))

vi.mock("@/utils/logger", () => ({
  logger: {
    warn: loggerWarnMock,
  },
}))

function buildStableConfig(): Config {
  const config = structuredClone(DEFAULT_CONFIG)
  // In DEV mode, beta experience is enabled. Keep it true so no extra write is introduced.
  config.betaExperience.enabled = true
  config.providersConfig = config.providersConfig.map((providerConfig) => {
    if (!isAPIProviderConfig(providerConfig)) {
      return providerConfig
    }

    const apiKeyEnvName = `WXT_${providerConfig.provider.toUpperCase()}_API_KEY`
    const envApiKey = import.meta.env[apiKeyEnvName] as string | undefined
    if (!envApiKey) {
      return providerConfig
    }

    return {
      ...providerConfig,
      apiKey: envApiKey,
    }
  })
  return config
}

describe("initializeConfig", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    setItemMock.mockResolvedValue(undefined)
    setMetaMock.mockResolvedValue(undefined)
    runMigrationMock.mockImplementation(async (_nextVersion: number, config: Config) => config)
  })

  it("does not write when config and meta are already up to date", async () => {
    const config = buildStableConfig()
    getItemMock.mockResolvedValueOnce(config)
    getMetaMock.mockResolvedValueOnce({
      schemaVersion: CONFIG_SCHEMA_VERSION,
      lastModifiedAt: 123,
    })

    const { initializeConfig } = await import("../init")
    await initializeConfig()

    expect(runMigrationMock).not.toHaveBeenCalled()
    expect(setItemMock).not.toHaveBeenCalled()
    expect(setMetaMock).not.toHaveBeenCalled()
  })

  it("writes config and meta when config is missing", async () => {
    getItemMock.mockResolvedValueOnce(null)
    getMetaMock.mockResolvedValueOnce(null)

    const { initializeConfig } = await import("../init")
    await initializeConfig()

    expect(setItemMock).toHaveBeenCalledTimes(1)
    expect(setItemMock).toHaveBeenCalledWith("local:config", expect.any(Object))
    expect(setMetaMock).toHaveBeenCalledTimes(1)
    expect(setMetaMock).toHaveBeenCalledWith("local:config", expect.objectContaining({
      schemaVersion: CONFIG_SCHEMA_VERSION,
      lastModifiedAt: expect.any(Number),
    }))
  })

  it("runs migration and persists migrated config once", async () => {
    const config = buildStableConfig()
    const migrated = {
      ...config,
      contextMenu: {
        ...config.contextMenu,
        enabled: false,
      },
    }

    getItemMock.mockResolvedValueOnce(config)
    getMetaMock.mockResolvedValueOnce({
      schemaVersion: CONFIG_SCHEMA_VERSION - 1,
      lastModifiedAt: 888,
    })
    runMigrationMock.mockResolvedValueOnce(migrated)

    const { initializeConfig } = await import("../init")
    await initializeConfig()

    expect(runMigrationMock).toHaveBeenCalledWith(CONFIG_SCHEMA_VERSION, config)
    expect(setItemMock).toHaveBeenCalledTimes(1)
    expect(setItemMock).toHaveBeenCalledWith("local:config", migrated)
    expect(setMetaMock).toHaveBeenCalledTimes(1)
    expect(setMetaMock).toHaveBeenCalledWith("local:config", {
      schemaVersion: CONFIG_SCHEMA_VERSION,
      lastModifiedAt: 888,
    })
  })

  it("only updates meta when config is unchanged but lastModifiedAt is missing", async () => {
    const config = buildStableConfig()
    getItemMock.mockResolvedValueOnce(config)
    getMetaMock.mockResolvedValueOnce({
      schemaVersion: CONFIG_SCHEMA_VERSION,
    })

    const { initializeConfig } = await import("../init")
    await initializeConfig()

    expect(setItemMock).not.toHaveBeenCalled()
    expect(setMetaMock).toHaveBeenCalledTimes(1)
    expect(setMetaMock).toHaveBeenCalledWith("local:config", expect.objectContaining({
      schemaVersion: CONFIG_SCHEMA_VERSION,
      lastModifiedAt: expect.any(Number),
    }))
  })
})
