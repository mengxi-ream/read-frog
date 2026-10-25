// @vitest-environment jsdom
import type { ReactNode } from "react"
import { act, render } from "@testing-library/react"
import { Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { subtitlesStore } from "../../atoms"
import { SubtitlesUIContext } from "../../ui/subtitles-ui-context"
import { lookUpAtom } from "../atoms"
import { WordLookupCard } from "../word-lookup-card"

interface RootProps {
  anchor: { x: number; y: number } | null
  onPinnedChange: (pinned: boolean) => void
  children: ReactNode
}

const popover = vi.hoisted(() => ({ root: null as RootProps | null }))

vi.mock("@/components/ui/selection-popover", () => ({
  SelectionPopover: {
    Root: (props: RootProps) => {
      popover.root = props
      return props.children
    },
    Content: ({ children }: { children: ReactNode }) => children,
  },
}))
vi.mock("@/components/custom-action/custom-action-panel", () => ({ CustomActionPanel: () => null }))
vi.mock("@/components/custom-action/save-to-notebase-dialog-host", () => ({
  SaveToNotebaseDialogHost: () => null,
}))
vi.mock("@/components/providers/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("../use-top-layer-portal-container", () => ({
  useTopLayerPortalContainer: () => document.body,
}))

function word(index: number, rect: { right: number; bottom: number }) {
  const element = document.createElement("span")
  element.dataset.slot = "subtitle-word"
  element.dataset.index = String(index)
  element.getBoundingClientRect = () => ({ ...rect }) as DOMRect
  return element
}

function renderCard() {
  document.body.append(word(0, { right: 40, bottom: 300 }), word(2, { right: 120, bottom: 300 }))
  render(
    <Provider store={subtitlesStore}>
      <SubtitlesUIContext
        value={
          { getVideoElement: () => null } as unknown as React.ContextType<typeof SubtitlesUIContext>
        }
      >
        <WordLookupCard />
      </SubtitlesUIContext>
    </Provider>,
  )
}

describe("WordLookupCard", () => {
  afterEach(() => {
    act(() => subtitlesStore.set(lookUpAtom, null))
    document.body.replaceChildren()
    popover.root = null
  })

  it("opens below the looked-up word, at its bottom-right corner", () => {
    renderCard()

    act(() => subtitlesStore.set(lookUpAtom, { start: 2, end: 2 }))

    expect(popover.root?.anchor).toEqual({ x: 120, y: 300 })
  })

  it("stays where it was pinned when another word is looked up", () => {
    renderCard()
    act(() => subtitlesStore.set(lookUpAtom, { start: 0, end: 0 }))
    act(() => popover.root?.onPinnedChange(true))

    act(() => subtitlesStore.set(lookUpAtom, { start: 2, end: 2 }))

    expect(popover.root?.anchor).toEqual({ x: 40, y: 300 })
  })
})
