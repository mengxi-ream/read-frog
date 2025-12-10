import type { ConfigMeta, ConfigValueAndMeta, LastSyncedConfigMeta, LastSyncedConfigValueAndMeta } from '@/types/config/meta'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getLastSyncedConfigAndMeta,
  getLocalConfigAndMeta,
  setLastSyncConfigAndMeta,
  setLocalConfigAndMeta,
} from '@/utils/config/storage'
import { getRemoteConfigAndMetaWithUserEmail, setRemoteConfigAndMeta } from '../storage'
import { syncConfig } from '../sync'

// Mock the storage modules
vi.mock('@/utils/config/storage', () => ({
  getLocalConfigAndMeta: vi.fn(),
  getLastSyncedConfigAndMeta: vi.fn(),
  setLocalConfigAndMeta: vi.fn(),
  setLastSyncConfigAndMeta: vi.fn(),
}))

vi.mock('../storage', () => ({
  getRemoteConfigAndMetaWithUserEmail: vi.fn(),
  setRemoteConfigAndMeta: vi.fn(),
}))

// Mock the logger
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Simple test config - just needs matching shape
interface TestConfig {
  setting1: string
  setting2: number
}

function createTestConfig(overrides: Partial<TestConfig> = {}): TestConfig {
  return {
    setting1: 'default',
    setting2: 100,
    ...overrides,
  }
}

function createConfigValueAndMeta(
  config: TestConfig,
  meta: Partial<ConfigMeta> = {},
): ConfigValueAndMeta {
  return {
    value: config as any,
    meta: {
      schemaVersion: 1,
      lastModifiedAt: 1000,
      ...meta,
    },
  }
}

function createLastSyncedConfigValueAndMeta(
  config: TestConfig,
  meta: Partial<LastSyncedConfigMeta> = {},
): LastSyncedConfigValueAndMeta {
  return {
    value: config as any,
    meta: {
      schemaVersion: 1,
      lastModifiedAt: 1000,
      lastSyncedAt: 1000,
      email: 'a@test.com',
      ...meta,
    },
  }
}

describe('syncConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('1. First Login (No Previous Sync)', () => {
    it('1.1 should download when remote exists', async () => {
      const localConfig = createTestConfig({ setting1: 'local' })
      const remoteConfig = createTestConfig({ setting1: 'remote' })

      vi.mocked(getLocalConfigAndMeta).mockResolvedValue(
        createConfigValueAndMeta(localConfig, { lastModifiedAt: 1000 }),
      )
      vi.mocked(getLastSyncedConfigAndMeta).mockResolvedValue(null)
      vi.mocked(getRemoteConfigAndMetaWithUserEmail).mockResolvedValue({
        configValueAndMeta: createConfigValueAndMeta(remoteConfig, { lastModifiedAt: 2000 }),
        email: 'a@test.com',
      })

      const result = await syncConfig()

      expect(result).toEqual({ status: 'success', action: 'downloaded' })
      expect(setLocalConfigAndMeta).toHaveBeenCalledWith(remoteConfig, expect.any(Object))
      expect(setLastSyncConfigAndMeta).toHaveBeenCalledWith(
        remoteConfig,
        expect.objectContaining({ email: 'a@test.com' }),
      )
      expect(setRemoteConfigAndMeta).not.toHaveBeenCalled()
    })

    it('1.2 should upload when no remote exists', async () => {
      const localConfig = createTestConfig({ setting1: 'local' })

      vi.mocked(getLocalConfigAndMeta).mockResolvedValue(
        createConfigValueAndMeta(localConfig, { lastModifiedAt: 1000 }),
      )
      vi.mocked(getLastSyncedConfigAndMeta).mockResolvedValue(null)
      vi.mocked(getRemoteConfigAndMetaWithUserEmail).mockResolvedValue({
        configValueAndMeta: null,
        email: 'a@test.com',
      })

      const result = await syncConfig()

      expect(result).toEqual({ status: 'success', action: 'uploaded' })
      expect(setRemoteConfigAndMeta).toHaveBeenCalledWith(
        createConfigValueAndMeta(localConfig, { lastModifiedAt: 1000 }),
      )
      expect(setLastSyncConfigAndMeta).toHaveBeenCalledWith(
        localConfig,
        expect.objectContaining({ email: 'a@test.com' }),
      )
      expect(setLocalConfigAndMeta).not.toHaveBeenCalled()
    })
  })

  describe('2. Account Switch (User A � User B)', () => {
    it('2.1 should download when remote B exists', async () => {
      const localConfig = createTestConfig({ setting1: 'local-A' })
      const remoteBConfig = createTestConfig({ setting1: 'remote-B' })

      vi.mocked(getLocalConfigAndMeta).mockResolvedValue(
        createConfigValueAndMeta(localConfig, { lastModifiedAt: 2000 }),
      )
      vi.mocked(getLastSyncedConfigAndMeta).mockResolvedValue(
        createLastSyncedConfigValueAndMeta(localConfig, { email: 'a@test.com', lastModifiedAt: 1000 }),
      )
      vi.mocked(getRemoteConfigAndMetaWithUserEmail).mockResolvedValue({
        configValueAndMeta: createConfigValueAndMeta(remoteBConfig, { lastModifiedAt: 3000 }),
        email: 'b@test.com',
      })

      const result = await syncConfig()

      expect(result).toEqual({ status: 'success', action: 'downloaded' })
      expect(setLocalConfigAndMeta).toHaveBeenCalledWith(remoteBConfig, expect.any(Object))
      expect(setLastSyncConfigAndMeta).toHaveBeenCalledWith(
        remoteBConfig,
        expect.objectContaining({ email: 'b@test.com' }),
      )
      expect(setRemoteConfigAndMeta).not.toHaveBeenCalled()
    })

    it('2.2 should upload when no remote B exists', async () => {
      const localConfig = createTestConfig({ setting1: 'local-A' })

      vi.mocked(getLocalConfigAndMeta).mockResolvedValue(
        createConfigValueAndMeta(localConfig, { lastModifiedAt: 2000 }),
      )
      vi.mocked(getLastSyncedConfigAndMeta).mockResolvedValue(
        createLastSyncedConfigValueAndMeta(localConfig, { email: 'a@test.com', lastModifiedAt: 1000 }),
      )
      vi.mocked(getRemoteConfigAndMetaWithUserEmail).mockResolvedValue({
        configValueAndMeta: null,
        email: 'b@test.com',
      })

      const result = await syncConfig()

      expect(result).toEqual({ status: 'success', action: 'uploaded' })
      expect(setRemoteConfigAndMeta).toHaveBeenCalled()
      expect(setLastSyncConfigAndMeta).toHaveBeenCalledWith(
        localConfig,
        expect.objectContaining({ email: 'b@test.com' }),
      )
      expect(setLocalConfigAndMeta).not.toHaveBeenCalled()
    })
  })

  describe('3. Same Account Sync (User A continues)', () => {
    describe('3.1 Both Changed', () => {
      it('3.1.1 should return same-changes when content is identical', async () => {
        const baseConfig = createTestConfig({ setting1: 'base' })
        const changedConfig = createTestConfig({ setting1: 'changed' })

        vi.mocked(getLocalConfigAndMeta).mockResolvedValue(
          createConfigValueAndMeta(changedConfig, { lastModifiedAt: 2000 }),
        )
        vi.mocked(getLastSyncedConfigAndMeta).mockResolvedValue(
          createLastSyncedConfigValueAndMeta(baseConfig, { email: 'a@test.com', lastModifiedAt: 1000 }),
        )
        vi.mocked(getRemoteConfigAndMetaWithUserEmail).mockResolvedValue({
          configValueAndMeta: createConfigValueAndMeta(changedConfig, { lastModifiedAt: 2500 }),
          email: 'a@test.com',
        })

        const result = await syncConfig()

        expect(result).toEqual({ status: 'success', action: 'same-changes' })
        expect(setLocalConfigAndMeta).toHaveBeenCalled()
        expect(setRemoteConfigAndMeta).toHaveBeenCalled()
        expect(setLastSyncConfigAndMeta).toHaveBeenCalledWith(
          changedConfig,
          expect.objectContaining({ email: 'a@test.com' }),
        )
      })

      it('3.1.2 should return unresolved when content differs', async () => {
        const baseConfig = createTestConfig({ setting1: 'base' })
        const localConfig = createTestConfig({ setting1: 'local-changed' })
        const remoteConfig = createTestConfig({ setting1: 'remote-changed' })

        vi.mocked(getLocalConfigAndMeta).mockResolvedValue(
          createConfigValueAndMeta(localConfig, { lastModifiedAt: 2000 }),
        )
        vi.mocked(getLastSyncedConfigAndMeta).mockResolvedValue(
          createLastSyncedConfigValueAndMeta(baseConfig, { email: 'a@test.com', lastModifiedAt: 1000 }),
        )
        vi.mocked(getRemoteConfigAndMetaWithUserEmail).mockResolvedValue({
          configValueAndMeta: createConfigValueAndMeta(remoteConfig, { lastModifiedAt: 2500 }),
          email: 'a@test.com',
        })

        const result = await syncConfig()

        expect(result).toEqual({
          status: 'unresolved',
          data: {
            base: baseConfig,
            local: localConfig,
            remote: remoteConfig,
          },
        })
        // No storage modifications on conflict
        expect(setLocalConfigAndMeta).not.toHaveBeenCalled()
        expect(setRemoteConfigAndMeta).not.toHaveBeenCalled()
        expect(setLastSyncConfigAndMeta).not.toHaveBeenCalled()
      })
    })

    it('3.2 should download when only remote changed', async () => {
      const baseConfig = createTestConfig({ setting1: 'base' })
      const remoteConfig = createTestConfig({ setting1: 'remote-changed' })

      vi.mocked(getLocalConfigAndMeta).mockResolvedValue(
        createConfigValueAndMeta(baseConfig, { lastModifiedAt: 1000 }),
      )
      vi.mocked(getLastSyncedConfigAndMeta).mockResolvedValue(
        createLastSyncedConfigValueAndMeta(baseConfig, { email: 'a@test.com', lastModifiedAt: 1000 }),
      )
      vi.mocked(getRemoteConfigAndMetaWithUserEmail).mockResolvedValue({
        configValueAndMeta: createConfigValueAndMeta(remoteConfig, { lastModifiedAt: 2000 }),
        email: 'a@test.com',
      })

      const result = await syncConfig()

      expect(result).toEqual({ status: 'success', action: 'downloaded' })
      expect(setLocalConfigAndMeta).toHaveBeenCalledWith(remoteConfig, expect.any(Object))
      expect(setLastSyncConfigAndMeta).toHaveBeenCalled()
      expect(setRemoteConfigAndMeta).not.toHaveBeenCalled()
    })

    it('3.3 should upload when only local changed', async () => {
      const baseConfig = createTestConfig({ setting1: 'base' })
      const localConfig = createTestConfig({ setting1: 'local-changed' })

      vi.mocked(getLocalConfigAndMeta).mockResolvedValue(
        createConfigValueAndMeta(localConfig, { lastModifiedAt: 2000 }),
      )
      vi.mocked(getLastSyncedConfigAndMeta).mockResolvedValue(
        createLastSyncedConfigValueAndMeta(baseConfig, { email: 'a@test.com', lastModifiedAt: 1000 }),
      )
      vi.mocked(getRemoteConfigAndMetaWithUserEmail).mockResolvedValue({
        configValueAndMeta: createConfigValueAndMeta(baseConfig, { lastModifiedAt: 1000 }),
        email: 'a@test.com',
      })

      const result = await syncConfig()

      expect(result).toEqual({ status: 'success', action: 'uploaded' })
      expect(setRemoteConfigAndMeta).toHaveBeenCalled()
      expect(setLastSyncConfigAndMeta).toHaveBeenCalled()
      expect(setLocalConfigAndMeta).not.toHaveBeenCalled()
    })

    it('3.4 should return no-change when nothing changed', async () => {
      const config = createTestConfig({ setting1: 'unchanged' })

      vi.mocked(getLocalConfigAndMeta).mockResolvedValue(
        createConfigValueAndMeta(config, { lastModifiedAt: 1000 }),
      )
      vi.mocked(getLastSyncedConfigAndMeta).mockResolvedValue(
        createLastSyncedConfigValueAndMeta(config, { email: 'a@test.com', lastModifiedAt: 1000 }),
      )
      vi.mocked(getRemoteConfigAndMetaWithUserEmail).mockResolvedValue({
        configValueAndMeta: createConfigValueAndMeta(config, { lastModifiedAt: 1000 }),
        email: 'a@test.com',
      })

      const result = await syncConfig()

      expect(result).toEqual({ status: 'success', action: 'no-change' })
      // Only lastSyncedAt updated
      expect(setLastSyncConfigAndMeta).toHaveBeenCalled()
      expect(setLocalConfigAndMeta).not.toHaveBeenCalled()
      expect(setRemoteConfigAndMeta).not.toHaveBeenCalled()
    })

    describe('3.5 Remote Inaccessible (null remote)', () => {
      it('3.5.1 should upload when local changed', async () => {
        const baseConfig = createTestConfig({ setting1: 'base' })
        const localConfig = createTestConfig({ setting1: 'local-changed' })

        vi.mocked(getLocalConfigAndMeta).mockResolvedValue(
          createConfigValueAndMeta(localConfig, { lastModifiedAt: 2000 }),
        )
        vi.mocked(getLastSyncedConfigAndMeta).mockResolvedValue(
          createLastSyncedConfigValueAndMeta(baseConfig, { email: 'a@test.com', lastModifiedAt: 1000 }),
        )
        vi.mocked(getRemoteConfigAndMetaWithUserEmail).mockResolvedValue({
          configValueAndMeta: null,
          email: 'a@test.com',
        })

        const result = await syncConfig()

        expect(result).toEqual({ status: 'success', action: 'uploaded' })
        expect(setRemoteConfigAndMeta).toHaveBeenCalled()
        expect(setLastSyncConfigAndMeta).toHaveBeenCalled()
      })

      it('3.5.2 should return no-change when local unchanged', async () => {
        const config = createTestConfig({ setting1: 'unchanged' })

        vi.mocked(getLocalConfigAndMeta).mockResolvedValue(
          createConfigValueAndMeta(config, { lastModifiedAt: 1000 }),
        )
        vi.mocked(getLastSyncedConfigAndMeta).mockResolvedValue(
          createLastSyncedConfigValueAndMeta(config, { email: 'a@test.com', lastModifiedAt: 1000 }),
        )
        vi.mocked(getRemoteConfigAndMetaWithUserEmail).mockResolvedValue({
          configValueAndMeta: null,
          email: 'a@test.com',
        })

        const result = await syncConfig()

        expect(result).toEqual({ status: 'success', action: 'no-change' })
        expect(setLastSyncConfigAndMeta).toHaveBeenCalled()
        expect(setLocalConfigAndMeta).not.toHaveBeenCalled()
        expect(setRemoteConfigAndMeta).not.toHaveBeenCalled()
      })
    })
  })

  describe('4. Error Handling', () => {
    it('should return error status when getLocalConfigAndMeta throws', async () => {
      const testError = new Error('Local storage error')
      vi.mocked(getLocalConfigAndMeta).mockRejectedValue(testError)

      const result = await syncConfig()

      expect(result).toEqual({ status: 'error', error: testError })
    })

    it('should return error status when getRemoteConfigAndMetaWithUserEmail throws', async () => {
      const testError = new Error('Network error')
      vi.mocked(getLocalConfigAndMeta).mockResolvedValue(
        createConfigValueAndMeta(createTestConfig()),
      )
      vi.mocked(getLastSyncedConfigAndMeta).mockResolvedValue(null)
      vi.mocked(getRemoteConfigAndMetaWithUserEmail).mockRejectedValue(testError)

      const result = await syncConfig()

      expect(result).toEqual({ status: 'error', error: testError })
    })

    it('should wrap non-Error objects in Error', async () => {
      vi.mocked(getLocalConfigAndMeta).mockRejectedValue('string error')

      const result = await syncConfig()

      expect(result.status).toBe('error')
      expect((result as any).error).toBeInstanceOf(Error)
      expect((result as any).error.message).toBe('string error')
    })
  })
})
