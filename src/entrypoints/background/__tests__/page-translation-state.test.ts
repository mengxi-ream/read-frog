import { beforeEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import { getTranslationStateKey } from "@/utils/constants/storage-keys"
import {
  isAutoTranslationSuppressed,
  isPageTranslationStateInUrlScope,
  setPageTranslationEnabled,
} from "../page-translation-state"

const storageSetItemMock = vi.fn<(...args: any[]) => any>()

describe("setPageTranslationEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.setItem = storageSetItemMock
    storageSetItemMock.mockResolvedValue(undefined)
  })

  it("stores the origin scope when enabling with a URL", async () => {
    await setPageTranslationEnabled(42, true, "https://example.com/articles/1")

    expect(storageSetItemMock).toHaveBeenCalledWith(getTranslationStateKey(42), {
      enabled: true,
      origin: "https://example.com",
    })
  })

  it("stores a bare enable without a URL", async () => {
    await setPageTranslationEnabled(42, true)

    expect(storageSetItemMock).toHaveBeenCalledWith(getTranslationStateKey(42), { enabled: true })
  })

  it("records a scoped user refusal for user-initiated disables", async () => {
    await setPageTranslationEnabled(42, false, "https://example.com/articles/1", true)

    expect(storageSetItemMock).toHaveBeenCalledWith(getTranslationStateKey(42), {
      enabled: false,
      userDisabled: true,
      origin: "https://example.com",
    })
  })

  it("stores a bare disable for programmatic disables", async () => {
    await setPageTranslationEnabled(42, false, "https://example.com/articles/1")

    expect(storageSetItemMock).toHaveBeenCalledWith(getTranslationStateKey(42), { enabled: false })
  })

  it("stores a bare disable when a user-initiated disable has no scopable origin", async () => {
    await setPageTranslationEnabled(42, false, "file:///Users/me/report.html", true)

    expect(storageSetItemMock).toHaveBeenCalledWith(getTranslationStateKey(42), { enabled: false })
  })
})

describe("isAutoTranslationSuppressed", () => {
  const userDisabledState = {
    enabled: false,
    userDisabled: true,
    origin: "https://example.com",
  }

  it("suppresses when the user refused this origin", () => {
    expect(isAutoTranslationSuppressed(userDisabledState, "https://example.com/other")).toBe(true)
  })

  it("does not suppress a different origin", () => {
    expect(isAutoTranslationSuppressed(userDisabledState, "https://other.example.net/page")).toBe(
      false,
    )
  })

  it("does not suppress on bare disabled state", () => {
    expect(isAutoTranslationSuppressed({ enabled: false }, "https://example.com/a")).toBe(false)
  })

  it("does not suppress on enabled state", () => {
    expect(
      isAutoTranslationSuppressed(
        { enabled: true, origin: "https://example.com" },
        "https://example.com/a",
      ),
    ).toBe(false)
  })

  it("does not suppress without state or URL", () => {
    expect(isAutoTranslationSuppressed(null, "https://example.com/a")).toBe(false)
    expect(isAutoTranslationSuppressed(userDisabledState, undefined)).toBe(false)
  })
})

describe("isPageTranslationStateInUrlScope", () => {
  it("is unaffected by the userDisabled marker", () => {
    expect(
      isPageTranslationStateInUrlScope(
        { enabled: false, userDisabled: true, origin: "https://example.com" },
        "https://example.com/a",
      ),
    ).toBe(false)
    expect(
      isPageTranslationStateInUrlScope(
        { enabled: true, origin: "https://example.com" },
        "https://example.com/a",
      ),
    ).toBe(true)
  })
})
