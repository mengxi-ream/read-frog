import { afterEach, describe, expect, it, vi } from "vitest"
import {
  CancelledScopeRegistry,
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

describe("cancelledScopeRegistry", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("remembers exact cancelled scopes", () => {
    const registry = new CancelledScopeRegistry()
    registry.markScope("7:session-a")

    expect(registry.has("7:session-a")).toBe(true)
    expect(registry.has("7:session-b")).toBe(false)
    expect(registry.has("8:session-a")).toBe(false)
  })

  it("matches tab-close prefixes against every session of that tab", () => {
    const registry = new CancelledScopeRegistry()
    registry.markPrefix("7:")

    expect(registry.has("7:session-a")).toBe(true)
    expect(registry.has("7:session-b")).toBe(true)
    expect(registry.has("8:session-a")).toBe(false)
  })

  it("expires entries after the TTL", () => {
    vi.useFakeTimers()
    const registry = new CancelledScopeRegistry(1_000)
    registry.markScope("7:old")

    vi.advanceTimersByTime(2_000)
    // Pruning happens on write; a new mark evicts the expired entry.
    registry.markScope("7:new")

    expect(registry.has("7:old")).toBe(false)
    expect(registry.has("7:new")).toBe(true)
  })

  it("evicts the oldest entries beyond the size cap", () => {
    const registry = new CancelledScopeRegistry(60_000, 2)
    registry.markScope("7:a")
    registry.markScope("7:b")
    registry.markScope("7:c")

    expect(registry.has("7:a")).toBe(false)
    expect(registry.has("7:b")).toBe(true)
    expect(registry.has("7:c")).toBe(true)
  })
})
