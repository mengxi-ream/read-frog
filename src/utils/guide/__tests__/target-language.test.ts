import { describe, expect, it } from "vitest"
import { resolveGuideTargetLanguage } from "../target-language"

describe("resolveGuideTargetLanguage", () => {
  it("passes through a valid ISO 639-3 code", () => {
    expect(resolveGuideTargetLanguage({ langCodeISO6393: "cmn" })).toBe("cmn")
    expect(resolveGuideTargetLanguage({ langCodeISO6393: "eng" })).toBe("eng")
  })

  it("returns null when the code is missing", () => {
    expect(resolveGuideTargetLanguage({})).toBeNull()
    expect(resolveGuideTargetLanguage({ langCodeISO6393: undefined })).toBeNull()
    expect(resolveGuideTargetLanguage({ langCodeISO6393: null })).toBeNull()
  })

  it("returns null for invalid codes and non-object payloads", () => {
    expect(resolveGuideTargetLanguage({ langCodeISO6393: "zz" })).toBeNull()
    expect(resolveGuideTargetLanguage({ langCodeISO6393: "english" })).toBeNull()
    expect(resolveGuideTargetLanguage({ langCodeISO6393: 42 })).toBeNull()
    expect(resolveGuideTargetLanguage(null)).toBeNull()
    expect(resolveGuideTargetLanguage(undefined)).toBeNull()
    expect(resolveGuideTargetLanguage("cmn")).toBeNull()
  })
})
