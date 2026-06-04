import { franc } from "franc"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { detectLanguageWithSource } from "../language"

vi.mock("franc", () => ({
  franc: vi.fn(),
}))

const mockFranc = vi.mocked(franc)

describe("detectLanguageWithSource", () => {
  beforeEach(() => {
    mockFranc.mockReset()
  })

  it("returns franc result when it is a supported language code", async () => {
    mockFranc.mockReturnValue("eng")

    await expect(detectLanguageWithSource("This is enough text to detect language.")).resolves.toEqual({
      code: "eng",
      source: "franc",
    })
  })

  it("falls back when franc returns an unsupported language code", async () => {
    mockFranc.mockReturnValue("vmw")

    await expect(detectLanguageWithSource("Eyi je oro ni ede Yoruba fun idanwo wiwa ede.")).resolves.toEqual({
      code: "und",
      source: "fallback",
    })
  })
})
