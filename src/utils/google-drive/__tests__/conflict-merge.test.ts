import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configSchema } from '@/types/config/config'
import { applyResolutions, detectConflicts } from '../conflict-merge'

// Simple test config factory - tests algorithm behavior, not specific Config fields
function createTestConfig(overrides: Record<string, unknown> = {}): any {
  return {
    primitive: 'base',
    number: 100,
    nested: {
      value: 'nested-value',
      deep: { flag: true, count: 5 },
    },
    array: [1, 2, 3],
    ...overrides,
  }
}

describe('conflict-merge', () => {
  describe('detectConflicts', () => {
    it('should detect no conflicts when all configs are identical', () => {
      const base = createTestConfig()
      const local = createTestConfig()
      const remote = createTestConfig()

      const result = detectConflicts(base, local, remote)

      expect(result.conflicts).toHaveLength(0)
      expect(result.draft).toEqual(base)
    })

    it('should detect conflict when only local changed', () => {
      const base = createTestConfig()
      const local = createTestConfig({ primitive: 'local-changed' })
      const remote = createTestConfig()

      const result = detectConflicts(base, local, remote)

      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0]).toEqual({
        path: ['primitive'],
        baseValue: 'base',
        localValue: 'local-changed',
        remoteValue: 'base',
      })
      // Draft keeps base value until resolved
      expect((result.draft as any).primitive).toBe('base')
    })

    it('should detect conflict when only remote changed', () => {
      const base = createTestConfig()
      const local = createTestConfig()
      const remote = createTestConfig({ primitive: 'remote-changed' })

      const result = detectConflicts(base, local, remote)

      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0]).toEqual({
        path: ['primitive'],
        baseValue: 'base',
        localValue: 'base',
        remoteValue: 'remote-changed',
      })
      // Draft keeps base value until resolved
      expect((result.draft as any).primitive).toBe('base')
    })

    it('should detect no conflict when both changed to same value', () => {
      const base = createTestConfig()
      const local = createTestConfig({ primitive: 'same-value' })
      const remote = createTestConfig({ primitive: 'same-value' })

      const result = detectConflicts(base, local, remote)

      expect(result.conflicts).toHaveLength(0)
      // Same change is auto-applied to draft
      expect((result.draft as any).primitive).toBe('same-value')
    })

    it('should detect conflict when both changed to different values', () => {
      const base = createTestConfig()
      const local = createTestConfig({ primitive: 'local-value' })
      const remote = createTestConfig({ primitive: 'remote-value' })

      const result = detectConflicts(base, local, remote)

      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0]).toEqual({
        path: ['primitive'],
        baseValue: 'base',
        localValue: 'local-value',
        remoteValue: 'remote-value',
      })
      // Draft keeps base value until resolved
      expect((result.draft as any).primitive).toBe('base')
    })

    it('should detect multiple conflicts at different paths', () => {
      const base = createTestConfig()
      const local = createTestConfig({
        primitive: 'local-primitive',
        number: 200,
      })
      const remote = createTestConfig({
        primitive: 'remote-primitive',
        number: 300,
      })

      const result = detectConflicts(base, local, remote)

      expect(result.conflicts).toHaveLength(2)
      expect(result.conflicts.find(c => c.path.join('.') === 'primitive')).toBeDefined()
      expect(result.conflicts.find(c => c.path.join('.') === 'number')).toBeDefined()
    })

    it('should handle array conflicts (arrays are atomic)', () => {
      const base = createTestConfig()
      const local = createTestConfig({ array: [1, 2, 3, 4] })
      const remote = createTestConfig({ array: [1, 2] })

      const result = detectConflicts(base, local, remote)

      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0]).toEqual({
        path: ['array'],
        baseValue: [1, 2, 3],
        localValue: [1, 2, 3, 4],
        remoteValue: [1, 2],
      })
    })

    it('should handle nested object conflicts', () => {
      const base = createTestConfig()
      const local = createTestConfig({
        nested: { ...base.nested, value: 'local-nested' },
      })
      const remote = createTestConfig({
        nested: { ...base.nested, value: 'remote-nested' },
      })

      const result = detectConflicts(base, local, remote)

      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].path).toEqual(['nested', 'value'])
    })

    it('should handle deeply nested object conflicts', () => {
      const base = createTestConfig()
      const local = createTestConfig({
        nested: {
          ...base.nested,
          deep: { ...base.nested.deep, count: 10 },
        },
      })
      const remote = createTestConfig({
        nested: {
          ...base.nested,
          deep: { ...base.nested.deep, count: 20 },
        },
      })

      const result = detectConflicts(base, local, remote)

      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].path).toEqual(['nested', 'deep', 'count'])
      expect(result.conflicts[0].baseValue).toBe(5)
      expect(result.conflicts[0].localValue).toBe(10)
      expect(result.conflicts[0].remoteValue).toBe(20)
    })

    it('should track one-sided changes from different sources as separate conflicts', () => {
      const base = createTestConfig()
      const local = createTestConfig({ primitive: 'local-only' })
      const remote = createTestConfig({ number: 999 })

      const result = detectConflicts(base, local, remote)

      // Both one-sided changes are tracked as conflicts
      expect(result.conflicts).toHaveLength(2)
      // Draft keeps base values until resolved
      expect((result.draft as any).primitive).toBe('base')
      expect((result.draft as any).number).toBe(100)
    })
  })

  describe('applyResolutions', () => {
    let safeParseSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      safeParseSpy = vi.spyOn(configSchema, 'safeParse').mockImplementation(data => ({
        success: true,
        data: data as any,
      }))
    })

    afterEach(() => {
      safeParseSpy.mockRestore()
    })

    it('should apply local resolution', () => {
      const base = createTestConfig()
      const local = createTestConfig({ primitive: 'local-value' })
      const remote = createTestConfig({ primitive: 'remote-value' })

      const diffResult = detectConflicts(base, local, remote)
      const resolutions = { primitive: 'local' as const }

      const result = applyResolutions(diffResult, resolutions)

      expect((result.config as any)?.primitive).toBe('local-value')
      expect(result.validationError).toBeNull()
    })

    it('should apply remote resolution', () => {
      const base = createTestConfig()
      const local = createTestConfig({ primitive: 'local-value' })
      const remote = createTestConfig({ primitive: 'remote-value' })

      const diffResult = detectConflicts(base, local, remote)
      const resolutions = { primitive: 'remote' as const }

      const result = applyResolutions(diffResult, resolutions)

      expect((result.config as any)?.primitive).toBe('remote-value')
      expect(result.validationError).toBeNull()
    })

    it('should apply multiple resolutions', () => {
      const base = createTestConfig()
      const local = createTestConfig({
        primitive: 'local-primitive',
        number: 200,
      })
      const remote = createTestConfig({
        primitive: 'remote-primitive',
        number: 300,
      })

      const diffResult = detectConflicts(base, local, remote)
      const resolutions = {
        primitive: 'local' as const,
        number: 'remote' as const,
      }

      const result = applyResolutions(diffResult, resolutions)

      expect((result.config as any)?.primitive).toBe('local-primitive')
      expect((result.config as any)?.number).toBe(300)
      expect(result.validationError).toBeNull()
    })

    it('should apply nested path resolutions', () => {
      const base = createTestConfig()
      const local = createTestConfig({
        nested: { ...base.nested, value: 'local-nested' },
      })
      const remote = createTestConfig({
        nested: { ...base.nested, value: 'remote-nested' },
      })

      const diffResult = detectConflicts(base, local, remote)
      const resolutions = { 'nested.value': 'remote' as const }

      const result = applyResolutions(diffResult, resolutions)

      expect((result.config as any)?.nested.value).toBe('remote-nested')
      expect(result.validationError).toBeNull()
    })

    it('should preserve base value when conflict is unresolved', () => {
      const base = createTestConfig()
      const local = createTestConfig({ primitive: 'local-value' })
      const remote = createTestConfig({ primitive: 'remote-value' })

      const diffResult = detectConflicts(base, local, remote)
      const resolutions = {} // No resolution provided

      const result = applyResolutions(diffResult, resolutions)

      // Draft keeps base value for unresolved conflicts
      expect((result.config as any)?.primitive).toBe('base')
      expect(result.validationError).toBeNull()
    })
  })
})
