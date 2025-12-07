import type { ModifiedConfigData } from '../sync'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configSchema } from '@/types/config/config'
import { CONFIG_SCHEMA_VERSION, CONFIG_SCHEMA_VERSION_STORAGE_KEY, CONFIG_STORAGE_KEY, LAST_SYNC_TIME_STORAGE_KEY, LAST_SYNCED_CONFIG_SCHEMA_VERSION_STORAGE_KEY, LAST_SYNCED_CONFIG_STORAGE_KEY } from '@/utils/constants/config'

// Use vi.hoisted to define mocks before vi.mock hoisting
const { mockStorage, mockMigrateConfig, mockLogger, mockApi, mockAuth } = vi.hoisted(() => ({
  mockStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    getMeta: vi.fn(),
    setMeta: vi.fn(),
  },
  mockMigrateConfig: vi.fn(),
  mockLogger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  mockApi: {
    findFileInAppData: vi.fn(),
    downloadFile: vi.fn(),
    uploadFile: vi.fn(),
  },
  mockAuth: {
    getValidAccessToken: vi.fn(),
  },
}))

vi.mock('wxt/utils/storage', () => ({
  storage: mockStorage,
}))

vi.mock('@/utils/config/migration', () => ({
  migrateConfig: mockMigrateConfig,
}))

vi.mock('@/utils/logger', () => ({
  logger: mockLogger,
}))

vi.mock('../api', () => ({
  findFileInAppData: mockApi.findFileInAppData,
  downloadFile: mockApi.downloadFile,
  uploadFile: mockApi.uploadFile,
}))

vi.mock('../auth', () => ({
  getValidAccessToken: mockAuth.getValidAccessToken,
}))

// Import after mocking - this is required for vi.mock to work properly
// eslint-disable-next-line import/first
import { syncConfig, SyncMetadataCorruptedError } from '../sync'

// Test data factories
const defaultProvidersConfig = [
  {
    id: 'test-read',
    name: 'Test Read Provider',
    enabled: true,
    provider: 'openai' as const,
    apiKey: 'test-key',
    baseURL: 'https://api.openai.com/v1',
    models: {
      read: {
        model: 'gpt-4o-mini' as const,
        isCustomModel: false,
        customModel: '',
      },
      translate: {
        model: 'gpt-4o-mini' as const,
        isCustomModel: false,
        customModel: '',
      },
    },
  },
  {
    id: 'test-translate',
    name: 'Test Translate Provider',
    enabled: true,
    provider: 'google' as const,
  },
]

function createMockConfig(overrides: any = {}): any {
  return {
    language: {
      detectedCode: 'eng',
      sourceCode: 'auto',
      targetCode: 'cmn',
      level: 'intermediate',
    },
    providersConfig: overrides.providersConfig ?? defaultProvidersConfig,
    read: { providerId: 'test-read' },
    translate: {
      providerId: 'test-translate',
      mode: 'bilingual',
      enableAIContentAware: false,
      customPromptsConfig: {
        promptId: null,
        patterns: [],
      },
      node: { enabled: true, hotkey: 'Control' },
      page: {
        range: 'main',
        autoTranslatePatterns: [],
        autoTranslateLanguages: [],
        shortcut: ['ctrl+shift+t'],
        enableLLMDetection: false,
      },
      requestQueueConfig: {
        capacity: 10,
        rate: 2,
      },
      batchQueueConfig: {
        maxCharactersPerBatch: 1000,
        maxItemsPerBatch: 5,
      },
      translationNodeStyle: {
        preset: 'default',
        isCustom: false,
        customCSS: null,
      },
    },
    tts: { providerId: null, model: 'tts-1', voice: 'alloy', speed: 1 },
    floatingButton: { enabled: true, position: 0.66, disabledFloatingButtonPatterns: [] },
    selectionToolbar: { enabled: true, disabledSelectionToolbarPatterns: [] },
    sideContent: { width: 500 },
    betaExperience: { enabled: false },
    contextMenu: { enabled: true },
    ...overrides,
  }
}

function createMockRemoteConfigData(overrides: Partial<ModifiedConfigData> = {}): ModifiedConfigData {
  return {
    [CONFIG_STORAGE_KEY]: createMockConfig(),
    [CONFIG_SCHEMA_VERSION_STORAGE_KEY]: CONFIG_SCHEMA_VERSION,
    lastModified: Date.now(),
    ...overrides,
  }
}

function createMockGoogleDriveFile(overrides: Partial<{ id: string, name: string, mimeType: string, modifiedTime: string, size: string }> = {}) {
  return {
    id: 'test-file-id',
    name: 'read-frog-config.json',
    mimeType: 'application/json',
    modifiedTime: new Date().toISOString(),
    size: '1024',
    ...overrides,
  }
}

describe('googleDrive configuration sync', () => {
  let safeParseSpy: ReturnType<typeof vi.spyOn>
  let parseSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetAllMocks()

    // Setup default mock implementations
    mockAuth.getValidAccessToken.mockResolvedValue('test-access-token')
    mockStorage.getItem.mockResolvedValue(null)
    mockStorage.setItem.mockResolvedValue(undefined)
    mockStorage.getMeta.mockResolvedValue({ modifiedAt: Date.now() })
    mockStorage.setMeta.mockResolvedValue(undefined)
    mockMigrateConfig.mockImplementation(async (config, _version) => config)
    mockApi.findFileInAppData.mockResolvedValue(null)
    mockApi.downloadFile.mockResolvedValue('{}')
    mockApi.uploadFile.mockResolvedValue(createMockGoogleDriveFile())

    // Mock configSchema.safeParse to return success by default
    safeParseSpy = vi.spyOn(configSchema, 'safeParse').mockImplementation(data => ({
      success: true,
      data: data as any,
    }))
    // Mock configSchema.parse to return the data by default
    parseSpy = vi.spyOn(configSchema, 'parse').mockImplementation(data => data as any)
  })

  afterEach(() => {
    vi.useRealTimers()
    safeParseSpy.mockRestore()
    parseSpy.mockRestore()
  })

  describe('syncConfig integration tests', () => {
    describe('first sync scenarios', () => {
      it('should upload local config when no remote config exists', async () => {
        const mockConfig = createMockConfig()
        const localModifiedTime = Date.now() - 5000

        mockStorage.getItem
          .mockResolvedValueOnce(mockConfig) // local config
          .mockResolvedValueOnce(CONFIG_SCHEMA_VERSION) // local schema version
          .mockResolvedValueOnce(null) // No last sync time
        mockStorage.getMeta.mockResolvedValue({ modifiedAt: localModifiedTime })
        mockApi.findFileInAppData.mockResolvedValue(null)
        mockApi.uploadFile.mockResolvedValue(createMockGoogleDriveFile())

        await syncConfig()

        expect(mockApi.findFileInAppData).toHaveBeenCalledWith('read-frog-config.json')
        expect(mockApi.uploadFile).toHaveBeenCalled()
        expect(mockStorage.setItem).toHaveBeenCalledWith(
          expect.stringContaining(LAST_SYNC_TIME_STORAGE_KEY),
          expect.any(Number),
        )
        expect(mockStorage.setItem).toHaveBeenCalledWith(
          expect.stringContaining(LAST_SYNCED_CONFIG_STORAGE_KEY),
          mockConfig,
        )
        expect(mockStorage.setItem).toHaveBeenCalledWith(
          expect.stringContaining(LAST_SYNCED_CONFIG_SCHEMA_VERSION_STORAGE_KEY),
          CONFIG_SCHEMA_VERSION,
        )
      })

      it('should download remote config on first sync when remote exists', async () => {
        const mockConfig = createMockConfig()
        const mockRemoteData = createMockRemoteConfigData({
          [CONFIG_STORAGE_KEY]: mockConfig,
          lastModified: Date.now() - 1000,
        })

        mockStorage.getItem
          .mockResolvedValueOnce(mockConfig) // local config
          .mockResolvedValueOnce(CONFIG_SCHEMA_VERSION) // local schema version
          .mockResolvedValueOnce(null) // No last sync time (first sync)
          .mockResolvedValueOnce(null) // No last synced schema version (first sync)
          .mockResolvedValueOnce(null) // No last synced config (first sync)
        mockStorage.getMeta.mockResolvedValue({ modifiedAt: Date.now() - 5000 })
        mockApi.findFileInAppData.mockResolvedValue(createMockGoogleDriveFile())
        mockApi.downloadFile.mockResolvedValue(JSON.stringify(mockRemoteData))
        mockMigrateConfig.mockResolvedValue(mockConfig)

        await syncConfig()

        expect(mockApi.downloadFile).toHaveBeenCalled()
        expect(mockStorage.setItem).toHaveBeenCalledWith(`local:${CONFIG_STORAGE_KEY}`, mockConfig)
        expect(mockStorage.setItem).toHaveBeenCalledWith(
          expect.stringContaining(LAST_SYNCED_CONFIG_SCHEMA_VERSION_STORAGE_KEY),
          CONFIG_SCHEMA_VERSION,
        )
      })
    })

    describe('metadata corruption scenarios', () => {
      it('should throw SyncMetadataCorruptedError when lastSyncTime exists but lastSyncedConfig is missing', async () => {
        const mockConfig = createMockConfig()
        const mockRemoteData = createMockRemoteConfigData({
          [CONFIG_STORAGE_KEY]: mockConfig,
          lastModified: Date.now(),
        })

        mockStorage.getItem
          .mockResolvedValueOnce(mockConfig) // local config
          .mockResolvedValueOnce(CONFIG_SCHEMA_VERSION) // local schema version
          .mockResolvedValueOnce(Date.now()) // last sync time exists
          .mockResolvedValueOnce(CONFIG_SCHEMA_VERSION) // last synced schema version exists
          .mockResolvedValueOnce(null) // last synced config is missing (corrupted)
        mockStorage.getMeta.mockResolvedValue({ modifiedAt: Date.now() - 5000 })
        mockApi.findFileInAppData.mockResolvedValue(createMockGoogleDriveFile())
        mockApi.downloadFile.mockResolvedValue(JSON.stringify(mockRemoteData))
        mockMigrateConfig.mockResolvedValue(mockConfig)

        await expect(syncConfig()).rejects.toThrow(SyncMetadataCorruptedError)

        // Should have downloaded remote config and updated metadata before throwing
        expect(mockApi.downloadFile).toHaveBeenCalled()
        expect(mockStorage.setItem).toHaveBeenCalledWith(`local:${CONFIG_STORAGE_KEY}`, mockConfig)
        expect(mockStorage.setItem).toHaveBeenCalledWith(
          expect.stringContaining(LAST_SYNC_TIME_STORAGE_KEY),
          expect.any(Number),
        )
        expect(mockLogger.warn).toHaveBeenCalledWith('Last sync is invalid, applying remote config')
      })

      it('should throw SyncMetadataCorruptedError when lastSyncTime exists but lastSyncedConfigSchemaVersion is missing', async () => {
        const mockConfig = createMockConfig()
        const mockRemoteData = createMockRemoteConfigData({
          [CONFIG_STORAGE_KEY]: mockConfig,
          lastModified: Date.now(),
        })

        mockStorage.getItem
          .mockResolvedValueOnce(mockConfig) // local config
          .mockResolvedValueOnce(CONFIG_SCHEMA_VERSION) // local schema version
          .mockResolvedValueOnce(Date.now()) // last sync time exists
          .mockResolvedValueOnce(null) // last synced schema version is missing (corrupted)
          .mockResolvedValueOnce(mockConfig) // last synced config exists
        mockStorage.getMeta.mockResolvedValue({ modifiedAt: Date.now() - 5000 })
        mockApi.findFileInAppData.mockResolvedValue(createMockGoogleDriveFile())
        mockApi.downloadFile.mockResolvedValue(JSON.stringify(mockRemoteData))
        mockMigrateConfig.mockResolvedValue(mockConfig)

        await expect(syncConfig()).rejects.toThrow(SyncMetadataCorruptedError)

        // Should have downloaded remote config and updated metadata before throwing
        expect(mockApi.downloadFile).toHaveBeenCalled()
        expect(mockStorage.setItem).toHaveBeenCalledWith(`local:${CONFIG_STORAGE_KEY}`, mockConfig)
        expect(mockStorage.setItem).toHaveBeenCalledWith(
          expect.stringContaining(LAST_SYNC_TIME_STORAGE_KEY),
          expect.any(Number),
        )
        expect(mockLogger.warn).toHaveBeenCalledWith('Last sync is invalid, applying remote config')
      })

      it('should throw SyncMetadataCorruptedError when lastSyncTime exists but both other metadata are missing', async () => {
        const mockConfig = createMockConfig()
        const mockRemoteData = createMockRemoteConfigData({
          [CONFIG_STORAGE_KEY]: mockConfig,
          lastModified: Date.now(),
        })

        mockStorage.getItem
          .mockResolvedValueOnce(mockConfig) // local config
          .mockResolvedValueOnce(CONFIG_SCHEMA_VERSION) // local schema version
          .mockResolvedValueOnce(Date.now()) // last sync time exists
          .mockResolvedValueOnce(null) // last synced schema version is missing (corrupted)
          .mockResolvedValueOnce(null) // last synced config is missing (corrupted)
        mockStorage.getMeta.mockResolvedValue({ modifiedAt: Date.now() - 5000 })
        mockApi.findFileInAppData.mockResolvedValue(createMockGoogleDriveFile())
        mockApi.downloadFile.mockResolvedValue(JSON.stringify(mockRemoteData))
        mockMigrateConfig.mockResolvedValue(mockConfig)

        await expect(syncConfig()).rejects.toThrow(SyncMetadataCorruptedError)

        // Should have downloaded remote config and updated metadata before throwing
        expect(mockApi.downloadFile).toHaveBeenCalled()
        expect(mockStorage.setItem).toHaveBeenCalledWith(`local:${CONFIG_STORAGE_KEY}`, mockConfig)
        expect(mockStorage.setItem).toHaveBeenCalledWith(
          expect.stringContaining(LAST_SYNC_TIME_STORAGE_KEY),
          expect.any(Number),
        )
        expect(mockLogger.warn).toHaveBeenCalledWith('Last sync is invalid, applying remote config')
      })
    })

    describe('remote newer scenarios', () => {
      it('should download remote config when remote is newer', async () => {
        const mockConfig = createMockConfig()
        // Set timestamps to avoid conflict branch:
        // localChangedSinceSync = local.lastModified > lastSyncTime = false
        // remoteChangedSinceSync = remote.lastModified > lastSyncTime = false
        // Then compare: remote.lastModified > local.lastModified = true -> download
        const localModifiedTime = 1000
        const remoteLastModified = 2000
        const lastSyncTime = 3000 // lastSyncTime > both, so neither changed since sync
        const mockRemoteData = createMockRemoteConfigData({
          [CONFIG_STORAGE_KEY]: mockConfig,
          lastModified: remoteLastModified,
        })

        mockStorage.getItem
          .mockResolvedValueOnce(mockConfig) // local config
          .mockResolvedValueOnce(CONFIG_SCHEMA_VERSION) // local schema version
          .mockResolvedValueOnce(lastSyncTime) // last sync time
          .mockResolvedValueOnce(CONFIG_SCHEMA_VERSION) // last synced schema version
          .mockResolvedValueOnce(mockConfig) // last synced config
        mockStorage.getMeta.mockResolvedValue({ modifiedAt: localModifiedTime })
        mockApi.findFileInAppData.mockResolvedValue(createMockGoogleDriveFile())
        mockApi.downloadFile.mockResolvedValue(JSON.stringify(mockRemoteData))
        mockMigrateConfig.mockResolvedValue(mockConfig)

        await syncConfig()

        expect(mockApi.downloadFile).toHaveBeenCalled()
        expect(mockStorage.setItem).toHaveBeenCalledWith(`local:${CONFIG_STORAGE_KEY}`, mockConfig)
        expect(mockStorage.setItem).toHaveBeenCalledWith(
          expect.stringContaining(LAST_SYNCED_CONFIG_SCHEMA_VERSION_STORAGE_KEY),
          CONFIG_SCHEMA_VERSION,
        )
      })

      it('should migrate remote config when remote has older schema version', async () => {
        const mockOldConfig = createMockConfig()
        const mockNewConfig = createMockConfig({ language: { ...mockOldConfig.language, targetCode: 'jpn' } })
        // Set timestamps to avoid conflict branch and trigger download
        const localModifiedTime = 1000
        const remoteLastModified = 2000
        const lastSyncTime = 3000 // lastSyncTime > both, so neither changed since sync
        const mockRemoteData = createMockRemoteConfigData({
          [CONFIG_STORAGE_KEY]: mockOldConfig,
          [CONFIG_SCHEMA_VERSION_STORAGE_KEY]: CONFIG_SCHEMA_VERSION - 1,
          lastModified: remoteLastModified,
        })

        mockStorage.getItem
          .mockResolvedValueOnce(mockOldConfig) // local config
          .mockResolvedValueOnce(CONFIG_SCHEMA_VERSION) // local schema version
          .mockResolvedValueOnce(lastSyncTime) // last sync time
          .mockResolvedValueOnce(CONFIG_SCHEMA_VERSION) // last synced schema version
          .mockResolvedValueOnce(mockOldConfig) // last synced config
        mockStorage.getMeta.mockResolvedValue({ modifiedAt: localModifiedTime })
        mockApi.findFileInAppData.mockResolvedValue(createMockGoogleDriveFile())
        mockApi.downloadFile.mockResolvedValue(JSON.stringify(mockRemoteData))
        mockMigrateConfig.mockResolvedValue(mockNewConfig)

        await syncConfig()

        expect(mockMigrateConfig).toHaveBeenCalledWith(mockOldConfig, CONFIG_SCHEMA_VERSION - 1)
        expect(mockStorage.setItem).toHaveBeenCalledWith(`local:${CONFIG_STORAGE_KEY}`, mockNewConfig)
      })
    })

    describe('local newer scenarios', () => {
      it('should upload local config when local is newer', async () => {
        const mockConfig = createMockConfig()
        // Set timestamps to avoid conflict branch:
        // localChangedSinceSync = local.lastModified > lastSyncTime = false
        // remoteChangedSinceSync = remote.lastModified > lastSyncTime = false
        // Then compare: local.lastModified > remote.lastModified = true -> upload
        const localModifiedTime = 2000
        const remoteLastModified = 1000
        const lastSyncTime = 3000 // lastSyncTime > both, so neither changed since sync
        const mockRemoteData = createMockRemoteConfigData({
          [CONFIG_STORAGE_KEY]: mockConfig,
          lastModified: remoteLastModified,
        })

        mockStorage.getItem
          .mockResolvedValueOnce(mockConfig)
          .mockResolvedValueOnce(CONFIG_SCHEMA_VERSION)
          .mockResolvedValueOnce(lastSyncTime)
          .mockResolvedValueOnce(CONFIG_SCHEMA_VERSION)
          .mockResolvedValueOnce(mockConfig)
        mockStorage.getMeta.mockResolvedValue({ modifiedAt: localModifiedTime })
        mockApi.findFileInAppData.mockResolvedValue(createMockGoogleDriveFile())
        mockApi.downloadFile.mockResolvedValue(JSON.stringify(mockRemoteData))

        await syncConfig()

        expect(mockApi.uploadFile).toHaveBeenCalled()
        expect(mockStorage.setItem).toHaveBeenCalledWith(
          expect.stringContaining(LAST_SYNC_TIME_STORAGE_KEY),
          expect.any(Number),
        )
        expect(mockStorage.setItem).toHaveBeenCalledWith(
          expect.stringContaining(LAST_SYNCED_CONFIG_STORAGE_KEY),
          mockConfig,
        )
        expect(mockStorage.setItem).toHaveBeenCalledWith(
          expect.stringContaining(LAST_SYNCED_CONFIG_SCHEMA_VERSION_STORAGE_KEY),
          CONFIG_SCHEMA_VERSION,
        )
      })
    })

    describe('equal timestamps scenario', () => {
      it('should update sync time when timestamps are equal', async () => {
        const mockConfig = createMockConfig()
        // Set timestamps to avoid conflict branch:
        // localChangedSinceSync = local.lastModified > lastSyncTime = false
        // remoteChangedSinceSync = remote.lastModified > lastSyncTime = false
        // Then compare: local.lastModified == remote.lastModified -> no upload, just update sync time
        const sameTimestamp = 1000
        const lastSyncTime = 2000 // lastSyncTime > both, so neither changed since sync
        const mockRemoteData = createMockRemoteConfigData({
          [CONFIG_STORAGE_KEY]: mockConfig,
          lastModified: sameTimestamp,
        })

        mockStorage.getItem
          .mockResolvedValueOnce(mockConfig) // local config
          .mockResolvedValueOnce(CONFIG_SCHEMA_VERSION) // local schema version
          .mockResolvedValueOnce(lastSyncTime) // last sync time
          .mockResolvedValueOnce(CONFIG_SCHEMA_VERSION) // last synced schema version
          .mockResolvedValueOnce(mockConfig) // last synced config
        mockStorage.getMeta.mockResolvedValue({ modifiedAt: sameTimestamp })
        mockApi.findFileInAppData.mockResolvedValue(createMockGoogleDriveFile())
        mockApi.downloadFile.mockResolvedValue(JSON.stringify(mockRemoteData))

        await syncConfig()

        expect(mockApi.uploadFile).not.toHaveBeenCalled()
        expect(mockStorage.setItem).toHaveBeenCalledWith(
          expect.stringContaining(LAST_SYNC_TIME_STORAGE_KEY),
          expect.any(Number),
        )
        expect(mockStorage.setItem).toHaveBeenCalledWith(
          expect.stringContaining(LAST_SYNCED_CONFIG_SCHEMA_VERSION_STORAGE_KEY),
          CONFIG_SCHEMA_VERSION,
        )
      })
    })

    describe('migration scenarios', () => {
      it('should handle migration failures gracefully', async () => {
        const mockConfig = createMockConfig()
        const mockRemoteData = createMockRemoteConfigData({
          [CONFIG_STORAGE_KEY]: mockConfig,
          [CONFIG_SCHEMA_VERSION_STORAGE_KEY]: CONFIG_SCHEMA_VERSION - 1,
          lastModified: Date.now(),
        })

        mockStorage.getItem
          .mockResolvedValueOnce(mockConfig)
          .mockResolvedValueOnce(CONFIG_SCHEMA_VERSION)
          .mockResolvedValueOnce(null)
        mockStorage.getMeta.mockResolvedValue({ modifiedAt: Date.now() - 5000 })
        mockApi.findFileInAppData.mockResolvedValue(createMockGoogleDriveFile())
        mockApi.downloadFile.mockResolvedValue(JSON.stringify(mockRemoteData))
        mockMigrateConfig.mockRejectedValue(new Error('Migration failed'))

        await expect(syncConfig()).rejects.toThrow('Migration failed')
      })
    })
  })
})
