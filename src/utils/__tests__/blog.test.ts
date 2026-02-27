import { semanticVersionSchema } from "@read-frog/definitions"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { hasNewBlogPost } from "../blog"

describe("hasNewBlogPost", () => {
  const baseDate = new Date("2025-01-01")
  const newerDate = new Date("2025-01-02")
  const olderDate = new Date("2024-12-31")

  describe("basic functionality without version check", () => {
    it("should return false if latestDate is null", () => {
      expect(hasNewBlogPost(baseDate, null)).toBe(false)
    })

    it("should return true if lastViewedDate is null and latestDate exists", () => {
      expect(hasNewBlogPost(null, baseDate)).toBe(true)
    })

    it("should return true if latestDate is newer than lastViewedDate", () => {
      expect(hasNewBlogPost(olderDate, newerDate)).toBe(true)
    })

    it("should return false if latestDate is older than lastViewedDate", () => {
      expect(hasNewBlogPost(newerDate, olderDate)).toBe(false)
    })

    it("should return false if dates are equal", () => {
      expect(hasNewBlogPost(baseDate, baseDate)).toBe(false)
    })
  })

  describe("edge cases", () => {
    it("should handle all null/undefined parameters", () => {
      expect(hasNewBlogPost(null, null)).toBe(false)
    })
  })
})

describe("semanticVersionSchema", () => {
  describe("valid versions", () => {
    it("should accept standard semantic versions", () => {
      expect(() => semanticVersionSchema.parse("1.0.0")).not.toThrow()
      expect(() => semanticVersionSchema.parse("1.11.0")).not.toThrow()
      expect(() => semanticVersionSchema.parse("10.20.30")).not.toThrow()
    })

    it("should reject versions with fewer segments", () => {
      expect(() => semanticVersionSchema.parse("1")).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse("1.0")).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse("1.11")).toThrow(z.ZodError)
    })

    it("should reject versions with more segments", () => {
      expect(() => semanticVersionSchema.parse("1.0.0.0")).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse("1.11.0.5")).toThrow(z.ZodError)
    })

    it("should reject zero-padded versions per semver spec", () => {
      // Leading zeros are not allowed in semantic versioning
      expect(() => semanticVersionSchema.parse("1.09.0")).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse("01.10.00")).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse("1.0.01")).toThrow(z.ZodError)
    })

    it("should accept large version numbers", () => {
      expect(() => semanticVersionSchema.parse("999.999.999")).not.toThrow()
      expect(() => semanticVersionSchema.parse("2025.1.1")).not.toThrow()
    })
  })

  describe("invalid versions", () => {
    it("should reject versions with prefixes", () => {
      expect(() => semanticVersionSchema.parse("v1.0.0")).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse("V1.11.0")).toThrow(z.ZodError)
    })

    it("should reject versions with suffixes", () => {
      expect(() => semanticVersionSchema.parse("1.0.0-alpha")).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse("1.11.0-beta.1")).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse("1.0.0+build.123")).toThrow(z.ZodError)
    })

    it("should reject versions with negative numbers", () => {
      expect(() => semanticVersionSchema.parse("1.-1.0")).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse("-1.0.0")).toThrow(z.ZodError)
    })

    it("should reject versions with non-numeric characters", () => {
      expect(() => semanticVersionSchema.parse("1.x.0")).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse("a.b.c")).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse("1.0.0a")).toThrow(z.ZodError)
    })

    it("should reject empty string", () => {
      expect(() => semanticVersionSchema.parse("")).toThrow(z.ZodError)
    })

    it("should reject versions with special characters", () => {
      expect(() => semanticVersionSchema.parse("1.0!0")).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse("1_0_0")).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse("1,0,0")).toThrow(z.ZodError)
    })

    it("should reject versions with spaces", () => {
      expect(() => semanticVersionSchema.parse("1 0 0")).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse("1.0 .0")).toThrow(z.ZodError)
    })

    it("should reject versions ending with dot", () => {
      expect(() => semanticVersionSchema.parse("1.0.")).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse("1.0.0.")).toThrow(z.ZodError)
    })

    it("should reject versions starting with dot", () => {
      expect(() => semanticVersionSchema.parse(".1.0.0")).toThrow(z.ZodError)
    })

    it("should reject versions with consecutive dots", () => {
      expect(() => semanticVersionSchema.parse("1..0.0")).toThrow(z.ZodError)
      expect(() => semanticVersionSchema.parse("1.0..0")).toThrow(z.ZodError)
    })
  })

  describe("error messages", () => {
    it("should provide clear error message for regex validation failure", () => {
      try {
        semanticVersionSchema.parse("v1.0.0")
      }
      catch (error) {
        expect(error).toBeInstanceOf(z.ZodError)
        const zodError = error as z.ZodError
        expect(zodError.issues[0]?.message).toContain("Must be a valid semantic version")
      }
    })

    it("should provide clear error message for negative number validation", () => {
      try {
        semanticVersionSchema.parse("1.-1.0")
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
