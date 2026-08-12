import type { LangCodeISO6393 } from "@read-frog/definitions"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { detectLanguage } from "@/utils/content/language"
import { MIN_LENGTH_FOR_SKIP_LANGUAGE_DETECTION, shouldSkipByLanguage } from "../translate-text"

// Mock detectLanguage
vi.mock("@/utils/content/language", () => ({
  detectLanguage: vi.fn<(...args: any[]) => any>(),
}))

const mockedDetect = vi.mocked(detectLanguage)

beforeEach(() => {
  mockedDetect.mockReset()
})

describe("shouldSkipByLanguage", () => {
  describe("basic skip logic", () => {
    it("should return true when detected language is in skipLanguages", async () => {
      mockedDetect.mockResolvedValueOnce("jpn")

      const japaneseText = "これは日本語のテストです。日本語で書かれたテキストです。"
      const skipLanguages: LangCodeISO6393[] = ["jpn"]

      const result = await shouldSkipByLanguage(japaneseText, skipLanguages)

      expect(result).toBe(true)
    })

    it("should return false when detected language is not in skipLanguages", async () => {
      mockedDetect.mockResolvedValueOnce("eng")

      const englishText = "This is a test written in English."
      const skipLanguages: LangCodeISO6393[] = ["jpn"]

      const result = await shouldSkipByLanguage(englishText, skipLanguages)

      expect(result).toBe(false)
    })

    it("should return false when skipLanguages is empty", async () => {
      mockedDetect.mockResolvedValueOnce("jpn")

      const japaneseText = "これは日本語のテストです。日本語で書かれたテキストです。"
      const skipLanguages: LangCodeISO6393[] = []

      const result = await shouldSkipByLanguage(japaneseText, skipLanguages)

      expect(result).toBe(false)
    })

    it("should return false when language cannot be detected", async () => {
      mockedDetect.mockResolvedValueOnce(null)

      const undetectableText = "12345 67890 !@#$%"
      const skipLanguages: LangCodeISO6393[] = ["jpn", "eng"]

      const result = await shouldSkipByLanguage(undetectableText, skipLanguages)

      expect(result).toBe(false)
    })
  })

  describe("detection options", () => {
    it("never routes a skip decision through an LLM", async () => {
      mockedDetect.mockResolvedValueOnce("jpn")

      const japaneseText = "これは日本語のテストです。日本語で書かれたテキストです。"
      const skipLanguages: LangCodeISO6393[] = ["jpn"]

      const result = await shouldSkipByLanguage(japaneseText, skipLanguages)

      // This runs once per paragraph. Routing it through an LLM cost one hosted
      // call per paragraph — hundreds per article — to avoid the occasional
      // redundant translation, against the same weekly pool that funds page
      // translation and subtitles.
      expect(mockedDetect).toHaveBeenCalledWith(japaneseText, {
        minLength: MIN_LENGTH_FOR_SKIP_LANGUAGE_DETECTION,
        enableLLM: false,
      })
      expect(result).toBe(true)
    })

    it("does not skip when detection comes back empty", async () => {
      mockedDetect.mockResolvedValueOnce(null)

      const japaneseText = "これは日本語のテストです。日本語で書かれたテキストです。"
      const skipLanguages: LangCodeISO6393[] = ["jpn"]

      // No verdict means translate it: withholding a translation on a guess is
      // the worse of the two errors.
      expect(await shouldSkipByLanguage(japaneseText, skipLanguages)).toBe(false)
      expect(mockedDetect).toHaveBeenCalled()
    })
  })
})
