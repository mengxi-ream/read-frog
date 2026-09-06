import { createStore } from "jotai"
import { describe, expect, it } from "vitest"
import { subtitlesSidebarActiveSectionAtom, subtitlesSidebarOpenAtom } from "../atoms"
import { DEFAULT_SECTION_ID } from "../ui/subtitles-sidebar/sections"

describe("subtitles sidebar state", () => {
  it("starts closed on the default section", () => {
    const store = createStore()

    expect(store.get(subtitlesSidebarOpenAtom)).toBe(false)
    expect(store.get(subtitlesSidebarActiveSectionAtom)).toBe(DEFAULT_SECTION_ID)
  })

  it("toggles open independently of the active section", () => {
    const store = createStore()
    store.set(subtitlesSidebarOpenAtom, true)

    expect(store.get(subtitlesSidebarOpenAtom)).toBe(true)
    expect(store.get(subtitlesSidebarActiveSectionAtom)).toBe(DEFAULT_SECTION_ID)
  })
})
