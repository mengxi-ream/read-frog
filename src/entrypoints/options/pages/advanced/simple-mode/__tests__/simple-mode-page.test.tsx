// @vitest-environment jsdom

import { render } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { FEATURE_IDS } from "@/utils/features"
import { buildSimpleModeRowRoute, getSimpleModeRowId, SIMPLE_MODE_PATH } from "@/utils/navigation"
import { SimpleModePage } from ".."
import { SEARCH_ITEMS } from "../../../../command-palette/search-items"
import { buildSectionSearch } from "../../../../command-palette/section-scroll"

const { configAtom, writeConfigAtom } = vi.hoisted(() => ({
  configAtom: {},
  writeConfigAtom: {},
}))

vi.mock("jotai", () => ({
  useAtomValue: (atom: object) => {
    if (atom !== configAtom) {
      throw new Error("Unexpected atom")
    }
    return DEFAULT_CONFIG
  },
  useSetAtom: (atom: object) => {
    if (atom !== writeConfigAtom) {
      throw new Error("Unexpected atom")
    }
    return vi.fn<() => Promise<void>>()
  },
}))

vi.mock("@/utils/atoms/config", () => ({ configAtom, writeConfigAtom }))

// Part of the accent outline the page draws around the row a link pointed at.
const HIGHLIGHT = "outline-accent/8"

function renderAt(entry: string) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <SimpleModePage />
    </MemoryRouter>,
  )
}

function highlightedRows() {
  return FEATURE_IDS.filter((id) =>
    document.getElementById(getSimpleModeRowId(id))?.classList.contains(HIGHLIGHT),
  )
}

describe("simple mode page", () => {
  it("opens at its list of switches from its search result, with no row highlighted", () => {
    const item = SEARCH_ITEMS.find((searchItem) => searchItem.route === SIMPLE_MODE_PATH)!

    renderAt(`${item.route}${buildSectionSearch(item.sectionId)}`)

    // The search scrolls to it.
    expect(document.getElementById(item.sectionId)).toBeInTheDocument()
    expect(highlightedRows()).toEqual([])
  })

  it("highlights the row that a link to a feature's switch points at", () => {
    renderAt(buildSimpleModeRowRoute("videoSubtitles"))

    expect(highlightedRows()).toEqual(["videoSubtitles"])
  })
})
