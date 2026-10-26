// @vitest-environment jsdom
import type { ReactNode } from "react"
import { act, render } from "@testing-library/react"
import { Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_SUBTITLE_POSITION, SUBTITLES_BOX_CLASS } from "@/utils/constants/subtitles"
import {
  currentTimeMsAtom,
  sourceTrackAtom,
  subtitlesPositionAtom,
  subtitlesStore,
} from "../../atoms"
import { SubtitlesUIContext } from "../../ui/subtitles-ui-context"
import { lookUpAtom } from "../atoms"
import { WordLookupCard } from "../word-lookup-card"

interface RootProps {
  anchor: { x: number; y: number } | null
  pinned: boolean
  onPinnedChange: (pinned: boolean) => void
  onOpenChangeRequest: (
    open: boolean,
    details: { reason: string; event: Event; cancel: () => void },
  ) => void
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

/**
 * "one two three": words at 0, 2 and 4, with their right edges 100px apart and
 * their bottoms at 300px, in a subtitles box whose top is at 240px.
 */
function renderCard() {
  subtitlesStore.set(sourceTrackAtom, [{ text: "one two three", start: 0, end: 5000 }])
  subtitlesStore.set(currentTimeMsAtom, 1000)
  const box = document.createElement("div")
  box.className = SUBTITLES_BOX_CLASS
  box.getBoundingClientRect = () => ({ top: 240 }) as DOMRect
  const line = document.createElement("span")
  line.dataset.slot = "subtitle-line"
  for (const index of [0, 2, 4]) {
    const word = document.createElement("span")
    word.dataset.slot = "subtitle-word"
    word.dataset.index = String(index)
    word.getBoundingClientRect = () => ({ right: 100 + index * 50, bottom: 300 }) as DOMRect
    line.append(word)
  }
  box.append(line)
  document.body.append(box)
  render(
    <Provider store={subtitlesStore}>
      <SubtitlesUIContext value={{ getVideoElement: () => null } as never}>
        <WordLookupCard />
      </SubtitlesUIContext>
    </Provider>,
  )
  return line
}

function lookUp(index: number | null) {
  act(() => subtitlesStore.set(lookUpAtom, index))
}

describe("WordLookupCard", () => {
  afterEach(() => {
    lookUp(null)
    subtitlesStore.set(sourceTrackAtom, [])
    subtitlesStore.set(subtitlesPositionAtom, { ...DEFAULT_SUBTITLE_POSITION })
    document.body.replaceChildren()
  })

  it("opens above the subtitles at the looked-up word, and moves with each new word", () => {
    renderCard()

    lookUp(2)
    expect(popover.root?.anchor).toEqual({ x: 200, y: 240, above: true })

    lookUp(4)
    expect(popover.root?.anchor).toEqual({ x: 300, y: 240, above: true })
  })

  it("opens below the word when the subtitles sit at the top of the video", () => {
    subtitlesStore.set(subtitlesPositionAtom, { percent: 10, anchor: "top" })
    renderCard()

    lookUp(2)
    expect(popover.root?.anchor).toEqual({ x: 200, y: 300 })
  })

  it("stays put while pinned, and moves again on the first word after unpinning", () => {
    renderCard()
    lookUp(0)
    act(() => popover.root?.onPinnedChange(true))

    lookUp(2)
    expect(popover.root?.anchor).toEqual({ x: 100, y: 240, above: true })

    act(() => popover.root?.onPinnedChange(false))
    expect(popover.root?.anchor).toEqual({ x: 100, y: 240, above: true })

    lookUp(4)
    expect(popover.root?.anchor).toEqual({ x: 300, y: 240, above: true })
  })

  it("drops the pin when the lookup is closed from outside the card", () => {
    renderCard()
    lookUp(0)
    act(() => popover.root?.onPinnedChange(true))

    lookUp(null)

    expect(popover.root?.pinned).toBe(false)
  })

  it("stays open for a press on a subtitle word, but not elsewhere on the line", () => {
    const line = renderCard()
    lookUp(0)
    const press = (path: EventTarget[]) => {
      const cancel = vi.fn<() => void>()
      const event = new Event("pointerdown")
      vi.spyOn(event, "composedPath").mockReturnValue(path)
      popover.root?.onOpenChangeRequest(false, { reason: "outside-press", event, cancel })
      return cancel
    }

    expect(press([line.firstElementChild!, line, document.body])).toHaveBeenCalled()
    expect(press([line, document.body])).not.toHaveBeenCalled()
  })
})
