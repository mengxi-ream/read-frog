import { describe, it } from 'vitest'

// TODO: Re-enable sync tests after refactoring
describe('sync', () => {
  it.todo('should be implemented')
})

// import type { ModifiedConfigData } from '../sync'
// import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// import { configSchema } from '@/types/config/config'
// import { CONFIG_SCHEMA_VERSION, CONFIG_STORAGE_KEY, LAST_SYNCED_CONFIG_STORAGE_KEY } from '@/utils/constants/config'

// // Use vi.hoisted to define mocks before vi.mock hoisting
// const { mockStorage, mockMigrateConfig, mockLogger, mockApi, mockAuth } = vi.hoisted(() => ({
//   mockStorage: {
//     getItem: vi.fn(),
//     setItem: vi.fn(),
//     getMeta: vi.fn(),
//     setMeta: vi.fn(),
//   },
//   mockMigrateConfig: vi.fn(),
//   mockLogger: {
//     error: vi.fn(),
//     info: vi.fn(),
//     warn: vi.fn(),
//   },
//   mockApi: {
//     findFileInAppData: vi.fn(),
//     downloadFile: vi.fn(),
//     uploadFile: vi.fn(),
//   },
//   mockAuth: {
//     getValidAccessToken: vi.fn(),
//     getGoogleUserInfo: vi.fn(),
//   },
// }))

// vi.mock('wxt/utils/storage', () => ({
//   storage: mockStorage,
// }))

// vi.mock('@/utils/config/migration', () => ({
//   migrateConfig: mockMigrateConfig,
// }))

// vi.mock('@/utils/logger', () => ({
//   logger: mockLogger,
// }))

// vi.mock('../api', () => ({
//   findFileInAppData: mockApi.findFileInAppData,
//   downloadFile: mockApi.downloadFile,
//   uploadFile: mockApi.uploadFile,
// }))

// vi.mock('../auth', () => ({
//   getValidAccessToken: mockAuth.getValidAccessToken,
//   getGoogleUserInfo: mockAuth.getGoogleUserInfo,
// }))

// // Import after mocking - this is required for vi.mock to work properly
// // eslint-disable-next-line import/first
// import { syncConfig } from '../sync'

// // Test data factories
// const defaultProvidersConfig = [
//   {
//     id: 'test-read',
//     name: 'Test Read Provider',
//     enabled: true,
//     provider: 'openai' as const,
//     apiKey: 'test-key',
//     baseURL: 'https://api.openai.com/v1',
//     models: {
//       read: {
//         model: 'gpt-4o-mini' as const,
//         isCustomModel: false,
//         customModel: '',
//       },
//       translate: {
//         model: 'gpt-4o-mini' as const,
//         isCustomModel: false,
//         customModel: '',
//       },
//     },
//   },
//   {
//     id: 'test-translate',
//     name: 'Test Translate Provider',
//     enabled: true,
//     provider: 'google' as const,
//   },
// ]

// function createMockConfig(overrides: any = {}): any {
//   return {
//     language: {
//       detectedCode: 'eng',
//       sourceCode: 'auto',
//       targetCode: 'cmn',
//       level: 'intermediate',
//     },
//     providersConfig: overrides.providersConfig ?? defaultProvidersConfig,
//     read: { providerId: 'test-read' },
//     translate: {
//       providerId: 'test-translate',
//       mode: 'bilingual',
//       enableAIContentAware: false,
//       customPromptsConfig: {
//         promptId: null,
//         patterns: [],
//       },
//       node: { enabled: true, hotkey: 'Control' },
//       page: {
//         range: 'main',
//         autoTranslatePatterns: [],
//         autoTranslateLanguages: [],
//         shortcut: ['ctrl+shift+t'],
//         enableLLMDetection: false,
//       },
//       requestQueueConfig: {
//         capacity: 10,
//         rate: 2,
//       },
//       batchQueueConfig: {
//         maxCharactersPerBatch: 1000,
//         maxItemsPerBatch: 5,
//       },
//       translationNodeStyle: {
//         preset: 'default',
//         isCustom: false,
//         customCSS: null,
//       },
//     },
//     tts: { providerId: null, model: 'tts-1', voice: 'alloy', speed: 1 },
//     floatingButton: { enabled: true, position: 0.66, disabledFloatingButtonPatterns: [] },
//     selectionToolbar: { enabled: true, disabledSelectionToolbarPatterns: [] },
//     sideContent: { width: 500 },
//     betaExperience: { enabled: false },
//     contextMenu: { enabled: true },
//     ...overrides,
//   }
// }

// function createMockRemoteConfigData(overrides: Partial<ModifiedConfigData> = {}): ModifiedConfigData {
//   return {
//     config: createMockConfig(),
//     schemaVersion: CONFIG_SCHEMA_VERSION,
//     lastModifiedAt: Date.now(),
//     ...overrides,
//   }
// }

// function createMockGoogleDriveFile(overrides: Partial<{ id: string, name: string, mimeType: string, modifiedTime: string, size: string }> = {}) {
//   return {
//     id: 'test-file-id',
//     name: 'read-frog-config.json',
//     mimeType: 'application/json',
//     modifiedTime: new Date().toISOString(),
//     size: '1024',
//     ...overrides,
//   }
// }

// describe('googleDrive configuration sync', () => {
//   let safeParseSpy: ReturnType<typeof vi.spyOn>
//   let parseSpy: ReturnType<typeof vi.spyOn>

//   beforeEach(() => {
//     vi.resetAllMocks()

//     // Setup default mock implementations
//     mockAuth.getValidAccessToken.mockResolvedValue('test-access-token')
//     mockAuth.getGoogleUserInfo.mockResolvedValue({ email: 'test@example.com' })
//     mockStorage.getItem.mockResolvedValue(null)
//     mockStorage.setItem.mockResolvedValue(undefined)
//     mockStorage.getMeta.mockResolvedValue({ schemaVersion: CONFIG_SCHEMA_VERSION, lastModifiedAt: Date.now() })
//     mockStorage.setMeta.mockResolvedValue(undefined)
//     mockMigrateConfig.mockImplementation(async (config, _version) => config)
//     mockApi.findFileInAppData.mockResolvedValue(null)
//     mockApi.downloadFile.mockResolvedValue('{}')
//     mockApi.uploadFile.mockResolvedValue(createMockGoogleDriveFile())

//     // Mock configSchema.safeParse to return success by default
//     safeParseSpy = vi.spyOn(configSchema, 'safeParse').mockImplementation(data => ({
//       success: true,
//       data: data as any,
//     }))
//     // Mock configSchema.parse to return the data by default
//     parseSpy = vi.spyOn(configSchema, 'parse').mockImplementation(data => data as any)
//   })

//   afterEach(() => {
//     vi.useRealTimers()
//     safeParseSpy.mockRestore()
//     parseSpy.mockRestore()
//   })

//   describe('syncConfig integration tests', () => {
//     describe('first sync scenarios', () => {
//       it('should upload local config when no remote config exists', async () => {
//         const mockConfig = createMockConfig()
//         const localModifiedTime = Date.now() - 5000

//         mockStorage.getItem.mockResolvedValueOnce(mockConfig) // local config
//         mockStorage.getMeta
//           .mockResolvedValueOnce({ schemaVersion: CONFIG_SCHEMA_VERSION, lastModifiedAt: localModifiedTime }) // config meta
//           .mockResolvedValueOnce({ schemaVersion: CONFIG_SCHEMA_VERSION, lastModifiedAt: localModifiedTime }) // for updateSyncMetadata
//         mockApi.findFileInAppData.mockResolvedValue(null)
//         mockApi.uploadFile.mockResolvedValue(createMockGoogleDriveFile())

//         await syncConfig()

//         expect(mockApi.findFileInAppData).toHaveBeenCalledWith('read-frog-config.json')
//         expect(mockApi.uploadFile).toHaveBeenCalled()
//         // Check that lastSyncedConfig was saved with its meta
//         expect(mockStorage.setItem).toHaveBeenCalledWith(
//           `local:${LAST_SYNCED_CONFIG_STORAGE_KEY}`,
//           mockConfig,
//         )
//         expect(mockStorage.setMeta).toHaveBeenCalledWith(
//           `local:${LAST_SYNCED_CONFIG_STORAGE_KEY}`,
//           expect.objectContaining({
//             schemaVersion: CONFIG_SCHEMA_VERSION,
//             lastModifiedAt: localModifiedTime,
//           }),
//         )
//       })

//       it('should download remote config on first sync when remote exists', async () => {
//         const mockConfig = createMockConfig()
//         const mockRemoteData = createMockRemoteConfigData({
//           config: mockConfig,
//           lastModifiedAt: Date.now() - 1000,
//         })

//         mockStorage.getItem
//           .mockResolvedValueOnce(mockConfig) // local config
//           .mockResolvedValueOnce(null) // lastSyncedConfig (first sync)
//         mockStorage.getMeta
//           .mockResolvedValueOnce({ schemaVersion: CONFIG_SCHEMA_VERSION, lastModifiedAt: Date.now() - 5000 }) // config meta
//           .mockResolvedValueOnce(null) // lastSyncedConfig meta (first sync)
//           .mockResolvedValueOnce({ schemaVersion: CONFIG_SCHEMA_VERSION, lastModifiedAt: Date.now() - 5000 }) // for updateSyncMetadata
//         mockApi.findFileInAppData.mockResolvedValue(createMockGoogleDriveFile())
//         mockApi.downloadFile.mockResolvedValue(JSON.stringify(mockRemoteData))
//         mockMigrateConfig.mockResolvedValue(mockConfig)

//         await syncConfig()

//         expect(mockApi.downloadFile).toHaveBeenCalled()
//         expect(mockStorage.setItem).toHaveBeenCalledWith(`local:${CONFIG_STORAGE_KEY}`, mockConfig)
//         expect(mockStorage.setMeta).toHaveBeenCalledWith(
//           `local:${LAST_SYNCED_CONFIG_STORAGE_KEY}`,
//           expect.objectContaining({
//             schemaVersion: CONFIG_SCHEMA_VERSION,
//           }),
//         )
//       })
//     })

//     describe('remote newer scenarios', () => {
//       it('should download remote config when remote is newer', async () => {
//         const mockConfig = createMockConfig()
//         // Set timestamps: local older than remote, both older than lastSynced
//         const lastSyncedModifiedAt = 1000
//         const localModifiedTime = 500
//         const remoteLastModified = 2000
//         const mockRemoteData = createMockRemoteConfigData({
//           config: mockConfig,
//           lastModifiedAt: remoteLastModified,
//         })

//         mockStorage.getItem
//           .mockResolvedValueOnce(mockConfig) // local config
//           .mockResolvedValueOnce(mockConfig) // lastSyncedConfig
//         mockStorage.getMeta
//           .mockResolvedValueOnce({ schemaVersion: CONFIG_SCHEMA_VERSION, lastModifiedAt: localModifiedTime }) // config meta
//           .mockResolvedValueOnce({ schemaVersion: CONFIG_SCHEMA_VERSION, lastModifiedAt: lastSyncedModifiedAt, lastSyncedAt: Date.now(), email: 'test@example.com' }) // lastSyncedConfig meta
//         mockApi.findFileInAppData.mockResolvedValue(createMockGoogleDriveFile())
//         mockApi.downloadFile.mockResolvedValue(JSON.stringify(mockRemoteData))
//         mockMigrateConfig.mockResolvedValue(mockConfig)

//         await syncConfig()

//         expect(mockApi.downloadFile).toHaveBeenCalled()
//         expect(mockStorage.setItem).toHaveBeenCalledWith(`local:${CONFIG_STORAGE_KEY}`, mockConfig)
//         expect(mockStorage.setMeta).toHaveBeenCalledWith(
//           `local:${LAST_SYNCED_CONFIG_STORAGE_KEY}`,
//           expect.objectContaining({
//             schemaVersion: CONFIG_SCHEMA_VERSION,
//             email: 'test@example.com',
//           }),
//         )
//       })

//       it('should migrate remote config when remote has older schema version', async () => {
//         const mockOldConfig = createMockConfig()
//         const mockNewConfig = createMockConfig({ language: { ...mockOldConfig.language, targetCode: 'jpn' } })
//         const lastSyncedModifiedAt = 1000
//         const localModifiedTime = 500
//         const remoteLastModified = 2000
//         const mockRemoteData = createMockRemoteConfigData({
//           config: mockOldConfig,
//           schemaVersion: CONFIG_SCHEMA_VERSION - 1,
//           lastModifiedAt: remoteLastModified,
//         })

//         mockStorage.getItem
//           .mockResolvedValueOnce(mockOldConfig) // local config
//           .mockResolvedValueOnce(mockOldConfig) // lastSyncedConfig
//         mockStorage.getMeta
//           .mockResolvedValueOnce({ schemaVersion: CONFIG_SCHEMA_VERSION, lastModifiedAt: localModifiedTime }) // config meta
//           .mockResolvedValueOnce({ schemaVersion: CONFIG_SCHEMA_VERSION, lastModifiedAt: lastSyncedModifiedAt, lastSyncedAt: Date.now(), email: 'test@example.com' }) // lastSyncedConfig meta
//         mockApi.findFileInAppData.mockResolvedValue(createMockGoogleDriveFile())
//         mockApi.downloadFile.mockResolvedValue(JSON.stringify(mockRemoteData))
//         mockMigrateConfig.mockResolvedValue(mockNewConfig)

//         await syncConfig()

//         expect(mockMigrateConfig).toHaveBeenCalledWith(mockOldConfig, CONFIG_SCHEMA_VERSION - 1)
//         expect(mockStorage.setItem).toHaveBeenCalledWith(`local:${CONFIG_STORAGE_KEY}`, mockNewConfig)
//       })
//     })

//     describe('local newer scenarios', () => {
//       it('should upload local config when local is newer', async () => {
//         const mockConfig = createMockConfig()
//         // Set timestamps: local newer than remote, both newer than lastSynced so no conflict
//         const lastSyncedModifiedAt = 1000
//         const localModifiedTime = 3000
//         const remoteLastModified = 2000
//         const mockRemoteData = createMockRemoteConfigData({
//           config: mockConfig,
//           lastModifiedAt: remoteLastModified,
//         })

//         mockStorage.getItem
//           .mockResolvedValueOnce(mockConfig) // local config
//           .mockResolvedValueOnce(mockConfig) // lastSyncedConfig
//         mockStorage.getMeta
//           .mockResolvedValueOnce({ schemaVersion: CONFIG_SCHEMA_VERSION, lastModifiedAt: localModifiedTime }) // config meta
//           .mockResolvedValueOnce({ schemaVersion: CONFIG_SCHEMA_VERSION, lastModifiedAt: lastSyncedModifiedAt, lastSyncedAt: Date.now(), email: 'test@example.com' }) // lastSyncedConfig meta
//         mockApi.findFileInAppData.mockResolvedValue(createMockGoogleDriveFile())
//         mockApi.downloadFile.mockResolvedValue(JSON.stringify(mockRemoteData))

//         await syncConfig()

//         expect(mockApi.uploadFile).toHaveBeenCalled()
//         expect(mockStorage.setItem).toHaveBeenCalledWith(
//           `local:${LAST_SYNCED_CONFIG_STORAGE_KEY}`,
//           mockConfig,
//         )
//         expect(mockStorage.setMeta).toHaveBeenCalledWith(
//           `local:${LAST_SYNCED_CONFIG_STORAGE_KEY}`,
//           expect.objectContaining({
//             schemaVersion: CONFIG_SCHEMA_VERSION,
//             email: 'test@example.com',
//           }),
//         )
//       })
//     })

//     describe('equal timestamps scenario', () => {
//       it('should update sync metadata when timestamps are equal', async () => {
//         const mockConfig = createMockConfig()
//         // Neither local nor remote changed since last sync
//         const lastSyncedModifiedAt = 3000
//         const sameTimestamp = 1000
//         const mockRemoteData = createMockRemoteConfigData({
//           config: mockConfig,
//           lastModifiedAt: sameTimestamp,
//         })

//         mockStorage.getItem
//           .mockResolvedValueOnce(mockConfig) // local config
//           .mockResolvedValueOnce(mockConfig) // lastSyncedConfig
//         mockStorage.getMeta
//           .mockResolvedValueOnce({ schemaVersion: CONFIG_SCHEMA_VERSION, lastModifiedAt: sameTimestamp }) // config meta
//           .mockResolvedValueOnce({ schemaVersion: CONFIG_SCHEMA_VERSION, lastModifiedAt: lastSyncedModifiedAt, lastSyncedAt: Date.now(), email: 'test@example.com' }) // lastSyncedConfig meta
//         mockApi.findFileInAppData.mockResolvedValue(createMockGoogleDriveFile())
//         mockApi.downloadFile.mockResolvedValue(JSON.stringify(mockRemoteData))

//         await syncConfig()

//         expect(mockApi.uploadFile).not.toHaveBeenCalled()
//         expect(mockStorage.setMeta).toHaveBeenCalledWith(
//           `local:${LAST_SYNCED_CONFIG_STORAGE_KEY}`,
//           expect.objectContaining({
//             schemaVersion: CONFIG_SCHEMA_VERSION,
//           }),
//         )
//       })
//     })

//     describe('migration scenarios', () => {
//       it('should handle migration failures gracefully', async () => {
//         const mockConfig = createMockConfig()
//         const mockRemoteData = createMockRemoteConfigData({
//           config: mockConfig,
//           schemaVersion: CONFIG_SCHEMA_VERSION - 1,
//           lastModifiedAt: Date.now(),
//         })

//         mockStorage.getItem
//           .mockResolvedValueOnce(mockConfig) // local config
//           .mockResolvedValueOnce(null) // lastSyncedConfig (first sync)
//         mockStorage.getMeta
//           .mockResolvedValueOnce({ schemaVersion: CONFIG_SCHEMA_VERSION, lastModifiedAt: Date.now() - 5000 }) // config meta
//           .mockResolvedValueOnce(null) // lastSyncedConfig meta (first sync)
//         mockApi.findFileInAppData.mockResolvedValue(createMockGoogleDriveFile())
//         mockApi.downloadFile.mockResolvedValue(JSON.stringify(mockRemoteData))
//         mockMigrateConfig.mockRejectedValue(new Error('Migration failed'))

//         await expect(syncConfig()).rejects.toThrow('Migration failed')
//       })
//     })
//   })
// })
