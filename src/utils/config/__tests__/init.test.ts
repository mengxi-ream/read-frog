import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { isAPIProviderConfig } from "@/types/config/provider"
import { CONFIG_SCHEMA_VERSION, DEFAULT_CONFIG } from "@/utils/constants/config"
import { MICROSOFT_TRANSLATE_PROVIDER_ID } from "@/utils/constants/providers"

const getItemMock = vi.fn<(...args: any[]) => any>()
const getMetaMock = vi.fn<(...args: any[]) => any>()
const setItemMock = vi.fn<(...args: any[]) => any>()
const setMetaMock = vi.fn<(...args: any[]) => any>()
const runMigrationMock = vi.fn<(...args: any[]) => any>()
const getPendingNotebaseSaveMock = vi.fn<(...args: any[]) => any>()
const clearPendingNotebaseSaveMock = vi.fn<(...args: any[]) => any>()
const isPendingNotebaseSaveExpiredMock = vi.fn<(...args: any[]) => any>()
const rebindPendingNotebaseSaveMock = vi.fn<(...args: any[]) => any>()
const setPendingNotebaseSaveMock = vi.fn<(...args: any[]) => any>()
const getPendingDictionaryRekeyedActionIdMock = vi.fn<(...args: any[]) => any>()
const migrateWithPendingDictionarySaveMock = vi.fn<(...args: any[]) => any>()
const loggerWarnMock = vi.fn<(...args: any[]) => any>()

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

vi.mock("@/utils/notebase/pending-save", () => ({
  clearPendingNotebaseSave: clearPendingNotebaseSaveMock,
  getPendingNotebaseSave: getPendingNotebaseSaveMock,
  isPendingNotebaseSaveExpired: isPendingNotebaseSaveExpiredMock,
  rebindPendingNotebaseSaveToMigratedDictionary: rebindPendingNotebaseSaveMock,
  setPendingNotebaseSave: setPendingNotebaseSaveMock,
}))

vi.mock("../migration-scripts/v087-to-v088", () => ({
  getPendingDictionaryRekeyedActionId: getPendingDictionaryRekeyedActionIdMock,
  migrateWithPendingDictionarySave: migrateWithPendingDictionarySaveMock,
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
    getPendingNotebaseSaveMock.mockResolvedValue(null)
    clearPendingNotebaseSaveMock.mockResolvedValue(undefined)
    isPendingNotebaseSaveExpiredMock.mockReturnValue(false)
    rebindPendingNotebaseSaveMock.mockImplementation((_config: Config, pending: unknown) => pending)
    setPendingNotebaseSaveMock.mockResolvedValue(undefined)
    getPendingDictionaryRekeyedActionIdMock.mockReturnValue(null)
    migrateWithPendingDictionarySaveMock.mockImplementation((config: Config) => config)
  })

  function translateProviderIdsOf(config: Config) {
    return [
      config.translate.providerId,
      config.selectionToolbar.features.translate.providerId,
      config.inputTranslation.providerId,
      config.videoSubtitles.providerId,
    ]
  }

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
    const freshConfig = setItemMock.mock.calls[0]?.[1] as Config
    for (const providerId of ["openai-default", "deepseek-default", "atlascloud-default"]) {
      expect(freshConfig.providersConfig.find((provider) => provider.id === providerId)).toEqual(
        expect.objectContaining({ description: expect.any(String) }),
      )
    }
    expect(setMetaMock).toHaveBeenCalledTimes(1)
    expect(setMetaMock).toHaveBeenCalledWith(
      "local:config",
      expect.objectContaining({
        schemaVersion: CONFIG_SCHEMA_VERSION,
        lastModifiedAt: expect.any(Number),
      }),
    )
  })

  it("starts every translate feature on the globally reachable Microsoft default", async () => {
    getItemMock.mockResolvedValueOnce(null)
    getMetaMock.mockResolvedValueOnce(null)

    const { initializeConfig } = await import("../init")
    const { isFreshInstall } = await initializeConfig()

    expect(isFreshInstall).toBe(true)
    const freshConfig = setItemMock.mock.calls[0]?.[1] as Config
    expect(translateProviderIdsOf(freshConfig)).toEqual([
      MICROSOFT_TRANSLATE_PROVIDER_ID,
      MICROSOFT_TRANSLATE_PROVIDER_ID,
      MICROSOFT_TRANSLATE_PROVIDER_ID,
      MICROSOFT_TRANSLATE_PROVIDER_ID,
    ])
  })

  it("does not report a fresh install when a stored config is reused", async () => {
    const config = buildStableConfig()
    getItemMock.mockResolvedValueOnce(config)
    getMetaMock.mockResolvedValueOnce({
      schemaVersion: CONFIG_SCHEMA_VERSION,
      lastModifiedAt: 123,
    })

    const { initializeConfig } = await import("../init")
    const { isFreshInstall } = await initializeConfig()

    expect(isFreshInstall).toBe(false)
  })

  it("reports a fresh install when an unparseable config is rebuilt", async () => {
    getItemMock.mockResolvedValueOnce({ not: "a config" })
    getMetaMock.mockResolvedValueOnce({
      schemaVersion: CONFIG_SCHEMA_VERSION,
      lastModifiedAt: 123,
    })

    const { initializeConfig } = await import("../init")
    const { isFreshInstall } = await initializeConfig()

    expect(isFreshInstall).toBe(true)
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

  it("uses the pending-save-aware v088 migration during local startup", async () => {
    const config = buildStableConfig()
    const pending = {
      actionId: "default-dictionary",
      outputSchemaFingerprint: "legacy-schema",
    }
    const migrated = {
      ...config,
      contextMenu: {
        ...config.contextMenu,
        enabled: false,
      },
    }
    const reboundPending = {
      ...pending,
      actionId: "migrated-default-dictionary",
    }

    getItemMock.mockResolvedValueOnce(config)
    getMetaMock.mockResolvedValueOnce({
      schemaVersion: CONFIG_SCHEMA_VERSION - 1,
      lastModifiedAt: 888,
    })
    getPendingNotebaseSaveMock.mockResolvedValueOnce(pending)
    getPendingDictionaryRekeyedActionIdMock.mockReturnValueOnce("migrated-default-dictionary")
    migrateWithPendingDictionarySaveMock.mockReturnValueOnce(migrated)
    rebindPendingNotebaseSaveMock.mockReturnValueOnce(reboundPending)

    const { initializeConfig } = await import("../init")
    await initializeConfig()

    expect(runMigrationMock).not.toHaveBeenCalled()
    expect(getPendingDictionaryRekeyedActionIdMock).toHaveBeenCalledWith(config, pending)
    expect(migrateWithPendingDictionarySaveMock).toHaveBeenCalledWith(config, pending)
    expect(rebindPendingNotebaseSaveMock).toHaveBeenCalledWith(
      migrated,
      pending,
      "migrated-default-dictionary",
    )
    expect(setPendingNotebaseSaveMock).toHaveBeenCalledWith(reboundPending)
    expect(setItemMock).toHaveBeenCalledWith("local:config", migrated)
  })

  it("ignores and best-effort clears an expired pending save before migration", async () => {
    const config = buildStableConfig()
    const pending = {
      actionId: "default-dictionary",
      outputSchemaFingerprint: "legacy-schema",
    }
    getItemMock.mockResolvedValueOnce(config)
    getMetaMock.mockResolvedValueOnce({
      schemaVersion: CONFIG_SCHEMA_VERSION - 1,
      lastModifiedAt: 888,
    })
    getPendingNotebaseSaveMock.mockResolvedValueOnce(pending)
    isPendingNotebaseSaveExpiredMock.mockReturnValueOnce(true)
    clearPendingNotebaseSaveMock.mockRejectedValueOnce(new Error("storage unavailable"))

    const { initializeConfig } = await import("../init")
    await initializeConfig()

    expect(clearPendingNotebaseSaveMock).toHaveBeenCalledOnce()
    expect(migrateWithPendingDictionarySaveMock).not.toHaveBeenCalled()
    expect(getPendingDictionaryRekeyedActionIdMock).not.toHaveBeenCalled()
    expect(runMigrationMock).toHaveBeenCalledWith(CONFIG_SCHEMA_VERSION, config)
    expect(loggerWarnMock).toHaveBeenCalledWith(
      "Failed to clear expired pending Notebase save during config initialization",
      expect.any(Error),
    )
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
    expect(setMetaMock).toHaveBeenCalledWith(
      "local:config",
      expect.objectContaining({
        schemaVersion: CONFIG_SCHEMA_VERSION,
        lastModifiedAt: expect.any(Number),
      }),
    )
  })
})
