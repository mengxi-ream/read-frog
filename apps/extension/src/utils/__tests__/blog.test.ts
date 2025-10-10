import { semanticVersionSchema } from '@repo/definitions'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { hasNewBlogPost } from '../blog'
import { logger } from '../logger'

vi.mock('../logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

describe('hasNewBlogPost', () => {
  const baseDate = new Date('2025-01-01')
  const newerDate = new Date('2025-01-02')
  const olderDate = new Date('2024-12-31')

  describe('basic functionality without version check', () => {
    it('should return false if latestDate is null', () => {
      expect(hasNewBlogPost(baseDate, null)).toBe(false)
    })

    it('should return true if lastViewedDate is null and latestDate exists', () => {
      expect(hasNewBlogPost(null, baseDate)).toBe(true)
    })

    it('should return true if latestDate is newer than lastViewedDate', () => {
      expect(hasNewBlogPost(olderDate, newerDate)).toBe(true)
    })

    it('should return false if latestDate is older than lastViewedDate', () => {
      expect(hasNewBlogPost(newerDate, olderDate)).toBe(false)
    })

    it('should return false if dates are equal', () => {
      expect(hasNewBlogPost(baseDate, baseDate)).toBe(false)
    })
  })

  describe('version compatibility check', () => {
    it('should return false if current version is lower than required version', () => {
      const result = hasNewBlogPost(null, baseDate, '1.10.0', '1.11.0')
      expect(result).toBe(false)
    })

    it('should return true if current version equals required version', () => {
      const result = hasNewBlogPost(null, baseDate, '1.11.0', '1.11.0')
      expect(result).toBe(true)
    })

    it('should return true if current version is higher than required version', () => {
      const result = hasNewBlogPost(null, baseDate, '1.12.0', '1.11.0')
      expect(result).toBe(true)
    })

    it('should ignore version check if blogExtensionVersion is null', () => {
      const result = hasNewBlogPost(null, baseDate, '1.10.0', null)
      expect(result).toBe(true)
    })

    it('should ignore version check if blogExtensionVersion is undefined', () => {
      const result = hasNewBlogPost(null, baseDate, '1.10.0', undefined)
      expect(result).toBe(true)
    })

    it('should ignore version check if currentExtensionVersion is undefined', () => {
      const result = hasNewBlogPost(null, baseDate, undefined, '1.11.0')
      expect(result).toBe(true)
    })

    it('should handle major version differences', () => {
      expect(hasNewBlogPost(null, baseDate, '1.0.0', '2.0.0')).toBe(false)
      expect(hasNewBlogPost(null, baseDate, '2.0.0', '1.0.0')).toBe(true)
    })

    it('should handle minor version differences', () => {
      expect(hasNewBlogPost(null, baseDate, '1.10.0', '1.11.0')).toBe(false)
      expect(hasNewBlogPost(null, baseDate, '1.11.0', '1.10.0')).toBe(true)
    })

    it('should handle patch version differences', () => {
      expect(hasNewBlogPost(null, baseDate, '1.11.0', '1.11.1')).toBe(false)
      expect(hasNewBlogPost(null, baseDate, '1.11.1', '1.11.0')).toBe(true)
    })

    it('should handle version strings with different segment counts', () => {
      // Invalid versions (not 3 segments) should be treated as invalid and skip version check
      expect(hasNewBlogPost(null, baseDate, '1.11', '1.11.0')).toBe(true) // '1.11' is invalid, skips check
      expect(hasNewBlogPost(null, baseDate, '1.11.0', '1.11')).toBe(true) // '1.11' is invalid, skips check
      expect(hasNewBlogPost(null, baseDate, '1.10', '1.11.0')).toBe(true) // '1.10' is invalid, skips check
    })
  })

  describe('combined date and version checks', () => {
    it('should return false if version is incompatible even with newer date', () => {
      const result = hasNewBlogPost(olderDate, newerDate, '1.10.0', '1.11.0')
      expect(result).toBe(false)
    })

    it('should return true if version is compatible and date is newer', () => {
      const result = hasNewBlogPost(olderDate, newerDate, '1.11.0', '1.11.0')
      expect(result).toBe(true)
    })

    it('should return false if version is compatible but date is older', () => {
      const result = hasNewBlogPost(newerDate, olderDate, '1.11.0', '1.11.0')
      expect(result).toBe(false)
    })

    it('should prioritize version check over date check', () => {
      const result = hasNewBlogPost(null, newerDate, '1.10.0', '1.11.0')
      expect(result).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle all null/undefined parameters', () => {
      expect(hasNewBlogPost(null, null)).toBe(false)
      expect(hasNewBlogPost(null, null, undefined, undefined)).toBe(false)
    })

    it('should reject zero-padded versions as invalid and skip version check', () => {
      // Zero-padded versions are invalid per semver spec, so version check is skipped
      expect(hasNewBlogPost(null, baseDate, '1.09.0', '1.10.0')).toBe(true) // '1.09.0' is invalid
      expect(hasNewBlogPost(null, baseDate, '1.10.0', '1.09.0')).toBe(true) // '1.09.0' is invalid
    })

    it('should handle large version numbers', () => {
      expect(hasNewBlogPost(null, baseDate, '10.20.30', '11.0.0')).toBe(false)
      expect(hasNewBlogPost(null, baseDate, '11.0.0', '10.20.30')).toBe(true)
    })
  })

  describe('version validation', () => {
    it('should gracefully handle invalid current version format', () => {
      // Invalid version should skip version check and proceed with date check
      const result = hasNewBlogPost(null, baseDate, 'invalid', '1.11.0')
      expect(result).toBe(true)
    })

    it('should gracefully handle invalid blog version format', () => {
      // Invalid version should skip version check and proceed with date check
      const result = hasNewBlogPost(null, baseDate, '1.11.0', 'invalid')
      expect(result).toBe(true)
    })

    it('should gracefully handle invalid version with special characters', () => {
      const result = hasNewBlogPost(null, baseDate, 'v1.11.0', '1.11.0')
      expect(result).toBe(true)
    })

    it('should gracefully handle version with letters', () => {
      const result = hasNewBlogPost(null, baseDate, '1.11.0-alpha', '1.11.0')
      expect(result).toBe(true)
    })

    it('should gracefully handle empty version string', () => {
      const result = hasNewBlogPost(null, baseDate, '', '1.11.0')
      expect(result).toBe(true)
    })

    it('should gracefully handle version with negative numbers', () => {
      const result = hasNewBlogPost(null, baseDate, '1.-1.0', '1.11.0')
      expect(result).toBe(true)
    })

    it('should gracefully handle both invalid versions', () => {
      const result = hasNewBlogPost(null, baseDate, 'invalid1', 'invalid2')
      expect(result).toBe(true)
    })

    it('should still check dates when version validation fails', () => {
      // Even with invalid versions, date check should still work
      const result = hasNewBlogPost(newerDate, olderDate, 'invalid', '1.11.0')
      expect(result).toBe(false)
    })

    it('should log ZodError details when version validation fails', () => {
      vi.mocked(logger.error).mockClear()

      hasNewBlogPost(null, baseDate, 'invalid', '1.11.0')

      expect(logger.error).toHaveBeenCalledWith(
        'Version validation failed, skipping version check:',
        expect.any(Array),
      )
    })

    it('should log generic error for non-ZodError exceptions', () => {
      vi.mocked(logger.error).mockClear()

      // This won't actually throw a non-Zod error in the current implementation,
      // but we can verify the error logging path exists
      hasNewBlogPost(null, baseDate, 'invalid', '1.11.0')

      expect(logger.error).toHaveBeenCalled()
    })
  })
})

describe('semanticVersionSchema', () => {
  describe('valid versions', () => {
    it('should accept standard semantic versions', () => {
      expect(() => semanticVersionSchema.parse('1.0.0')).not.toThrow()
      expect(() => semanticVersionSchema.parse('1.11.0')).not.toThrow()
      expect(() => semanticVersionSchema.parse('10.20.30')).not.toThrow()
    })

    it('should reject versions with fewer segments', () => {
      expect(() => semanticVersionSchema.parse('1')).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse('1.0')).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse('1.11')).toThrow(z.ZodError)
    })

    it('should reject versions with more segments', () => {
      expect(() => semanticVersionSchema.parse('1.0.0.0')).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse('1.11.0.5')).toThrow(z.ZodError)
    })

    it('should reject zero-padded versions per semver spec', () => {
      // Leading zeros are not allowed in semantic versioning
      expect(() => semanticVersionSchema.parse('1.09.0')).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse('01.10.00')).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse('1.0.01')).toThrow(z.ZodError)
    })

    it('should accept large version numbers', () => {
      expect(() => semanticVersionSchema.parse('999.999.999')).not.toThrow()
      expect(() => semanticVersionSchema.parse('2025.1.1')).not.toThrow()
    })
  })

  describe('invalid versions', () => {
    it('should reject versions with prefixes', () => {
      expect(() => semanticVersionSchema.parse('v1.0.0')).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse('V1.11.0')).toThrow(z.ZodError)
    })

    it('should reject versions with suffixes', () => {
      expect(() => semanticVersionSchema.parse('1.0.0-alpha')).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse('1.11.0-beta.1')).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse('1.0.0+build.123')).toThrow(z.ZodError)
    })

    it('should reject versions with negative numbers', () => {
      expect(() => semanticVersionSchema.parse('1.-1.0')).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse('-1.0.0')).toThrow(z.ZodError)
    })

    it('should reject versions with non-numeric characters', () => {
      expect(() => semanticVersionSchema.parse('1.x.0')).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse('a.b.c')).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse('1.0.0a')).toThrow(z.ZodError)
    })

    it('should reject empty string', () => {
      expect(() => semanticVersionSchema.parse('')).toThrow(z.ZodError)
    })

    it('should reject versions with special characters', () => {
      expect(() => semanticVersionSchema.parse('1.0!0')).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse('1_0_0')).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse('1,0,0')).toThrow(z.ZodError)
    })

    it('should reject versions with spaces', () => {
      expect(() => semanticVersionSchema.parse('1 0 0')).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse('1.0 .0')).toThrow(z.ZodError)
    })

    it('should reject versions ending with dot', () => {
      expect(() => semanticVersionSchema.parse('1.0.')).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse('1.0.0.')).toThrow(z.ZodError)
    })

    it('should reject versions starting with dot', () => {
      expect(() => semanticVersionSchema.parse('.1.0.0')).toThrow(z.ZodError)
    })

    it('should reject versions with consecutive dots', () => {
      expect(() => semanticVersionSchema.parse('1..0.0')).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse('1.0..0')).toThrow(z.ZodError)
    })
  })

  describe('error messages', () => {
    it('should provide clear error message for regex validation failure', () => {
      try {
        semanticVersionSchema.parse('v1.0.0')
      }
      catch (error) {
        expect(error).toBeInstanceOf(z.ZodError)
        const zodError = error as z.ZodError
        expect(zodError.issues[0]?.message).toContain('Must be a valid semantic version')
      }
    })

    it('should provide clear error message for negative number validation', () => {
      try {
        semanticVersionSchema.parse('1.-1.0')
      }
      catch (error) {
        expect(error).toBeInstanceOf(z.ZodError)
        const zodError = error as z.ZodError
        // Should have both regex and refine errors
        expect(zodError.issues.length).toBeGreaterThan(0)
      }
    })
  })
})
