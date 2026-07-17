import { describe, expect, it } from "vitest"
import {
  isTranslationCancelledError,
  TRANSLATION_CANCELLED_ERROR_NAME,
  TranslationCancelledError,
} from "../cancellation"

describe("isTranslationCancelledError", () => {
  it("recognizes a same-realm instance", () => {
    expect(isTranslationCancelledError(new TranslationCancelledError("7:sess"))).toBe(true)
  })

  it("recognizes the messaging-boundary shape (plain Error carrying only the name)", () => {
    // @webext-core/messaging re-creates background rejections on the content
    // side via @aklinker1/zero-serialize-error as `Error(msg)` with `.name`
    // copied — the prototype (and thus instanceof) is lost. Detection MUST be
    // name-based; this pins that so a refactor to `instanceof` can't slip
    // through green (#1881).
    const crossBoundary = Object.assign(new Error("Translation request cancelled"), {
      name: TRANSLATION_CANCELLED_ERROR_NAME,
    })
    expect(crossBoundary).not.toBeInstanceOf(TranslationCancelledError)
    expect(isTranslationCancelledError(crossBoundary)).toBe(true)
  })

  it("rejects unrelated errors and non-errors", () => {
    expect(isTranslationCancelledError(new Error("boom"))).toBe(false)
    expect(isTranslationCancelledError({ name: TRANSLATION_CANCELLED_ERROR_NAME })).toBe(false)
    expect(isTranslationCancelledError(undefined)).toBe(false)
    expect(isTranslationCancelledError("cancelled")).toBe(false)
  })
})
