import { beforeEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import {
  getActiveGuideDictionaryNotebaseTrackingForAction,
  getGuideDictionaryNotebaseState,
  GUIDE_DICTIONARY_NOTEBASE_ACTION_ID,
  GUIDE_DICTIONARY_NOTEBASE_COMPLETED_STORAGE_KEY,
  GUIDE_DICTIONARY_NOTEBASE_SESSION_STORAGE_KEY,
  isGuideDictionaryNotebaseGuideUrl,
  markGuideDictionaryNotebaseCompleted,
  startGuideDictionaryNotebaseTracking,
} from "../dictionary-notebase"

const GUIDE_URL = "https://readfrog.app/guide/step-3"

function localKey(key: string) {
  return `local:${key}`
}

describe("Dictionary Notebase guide tracking", () => {
  const storageValues = new Map<string, unknown>()
  let storageSetItemMock: ReturnType<typeof vi.fn<(...args: any[]) => any>>
  let storageRemoveItemMock: ReturnType<typeof vi.fn<(...args: any[]) => any>>

  beforeEach(() => {
    storageValues.clear()
    storage.getItem = vi.fn<(...args: any[]) => any>((key: string) =>
      Promise.resolve(storageValues.get(key)),
    )
    storageSetItemMock = vi.fn<(...args: any[]) => any>((key: string, value: unknown) => {
      storageValues.set(key, value)
      return Promise.resolve()
    })
    storageRemoveItemMock = vi.fn<(...args: any[]) => any>((key: string) => {
      storageValues.delete(key)
      return Promise.resolve()
    })
    storage.setItem = storageSetItemMock
    storage.removeItem = storageRemoveItemMock
  })

  it("recognizes official guide step 3 routes by pathname suffix", () => {
    expect(isGuideDictionaryNotebaseGuideUrl(GUIDE_URL)).toBe(true)
    expect(isGuideDictionaryNotebaseGuideUrl("https://readfrog.app/guide/step-3/")).toBe(true)
    expect(isGuideDictionaryNotebaseGuideUrl("https://readfrog.app/en/guide/step-3")).toBe(true)
    expect(isGuideDictionaryNotebaseGuideUrl("https://readfrog.app/zh-Hant/guide/step-3")).toBe(
      true,
    )
    expect(
      isGuideDictionaryNotebaseGuideUrl(
        "https://readfrog.app/fr-CA/guide/step-3/?from=guide#dictionary",
      ),
    ).toBe(true)
    expect(isGuideDictionaryNotebaseGuideUrl("https://readfrog.app/docs/guide/step-3")).toBe(true)
    expect(isGuideDictionaryNotebaseGuideUrl("https://readfrog.app/guide/step-30")).toBe(false)
    expect(isGuideDictionaryNotebaseGuideUrl("https://readfrog.app/guide/step-3/details")).toBe(
      false,
    )
    expect(isGuideDictionaryNotebaseGuideUrl("https://example.com/guide/step-3")).toBe(false)
  })

  it("starts a short-lived tracking session only from guide step 3", async () => {
    await expect(
      startGuideDictionaryNotebaseTracking("https://readfrog.app/docs", 1_000),
    ).resolves.toEqual({ completed: false })
    expect(storageSetItemMock).not.toHaveBeenCalled()

    await expect(startGuideDictionaryNotebaseTracking(GUIDE_URL, 2_000)).resolves.toEqual({
      completed: false,
    })

    const tracking = storageValues.get(localKey(GUIDE_DICTIONARY_NOTEBASE_SESSION_STORAGE_KEY))
    expect(tracking).toMatchObject({
      actionId: GUIDE_DICTIONARY_NOTEBASE_ACTION_ID,
      sourceUrl: GUIDE_URL,
      startedAt: 2_000,
      expiresAt: 1_802_000,
    })
  })

  it("returns active tracking only for the default Dictionary action on guide step 3", async () => {
    await startGuideDictionaryNotebaseTracking(GUIDE_URL, 1_000)

    await expect(
      getActiveGuideDictionaryNotebaseTrackingForAction(
        GUIDE_DICTIONARY_NOTEBASE_ACTION_ID,
        GUIDE_URL,
        2_000,
      ),
    ).resolves.toMatchObject({
      actionId: GUIDE_DICTIONARY_NOTEBASE_ACTION_ID,
      sourceUrl: GUIDE_URL,
    })

    await expect(
      getActiveGuideDictionaryNotebaseTrackingForAction("custom-action", GUIDE_URL, 2_000),
    ).resolves.toBeNull()
    await expect(
      getActiveGuideDictionaryNotebaseTrackingForAction(
        GUIDE_DICTIONARY_NOTEBASE_ACTION_ID,
        "https://readfrog.app/docs",
        2_000,
      ),
    ).resolves.toBeNull()
  })

  it("marks the guide complete and clears the active tracking session", async () => {
    await startGuideDictionaryNotebaseTracking(GUIDE_URL, 1_000)

    await expect(
      markGuideDictionaryNotebaseCompleted(
        {
          trackingId: "tracking-1",
          actionId: GUIDE_DICTIONARY_NOTEBASE_ACTION_ID,
          notebaseId: "notebase-1",
          sourceUrl: GUIDE_URL,
        },
        3_000,
      ),
    ).resolves.toEqual({ completed: true })

    expect(
      storageValues.get(localKey(GUIDE_DICTIONARY_NOTEBASE_COMPLETED_STORAGE_KEY)),
    ).toMatchObject({
      completed: true,
      completedAt: 3_000,
      trackingId: "tracking-1",
      actionId: GUIDE_DICTIONARY_NOTEBASE_ACTION_ID,
      notebaseId: "notebase-1",
      sourceUrl: GUIDE_URL,
    })
    expect(storageRemoveItemMock).toHaveBeenCalledWith(
      localKey(GUIDE_DICTIONARY_NOTEBASE_SESSION_STORAGE_KEY),
    )
    await expect(getGuideDictionaryNotebaseState()).resolves.toEqual({ completed: true })
  })
})
