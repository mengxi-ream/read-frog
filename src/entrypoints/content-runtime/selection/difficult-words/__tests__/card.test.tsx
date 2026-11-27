// @vitest-environment jsdom
import type { ReactNode } from "react"
import { act, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DifficultWordCard } from "../card"

interface RootProps {
  open: boolean
  pinned: boolean
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
vi.mock("@/components/custom-action/custom-action-panel", () => ({
  CustomActionPanel: {
    Root: ({ children }: { children: ReactNode }) => children,
    Header: () => null,
    Body: () => null,
    Footer: ({ children }: { children: ReactNode }) => children,
  },
}))
vi.mock("@/components/ui/selection-popover/review-due-tab", () => ({
  ReviewDueTab: () => null,
}))

function card(open: boolean, mountKey: number) {
  return (
    <DifficultWordCard
      open={open}
      anchor={open ? { x: 10, y: 20 } : null}
      mountKey={mountKey}
      onClose={() => {}}
      onKnown={() => {}}
      onSave={() => {}}
      isOverMark={() => false}
    />
  )
}

describe("difficultWordCard", () => {
  it("drops the pin when the card is closed from outside it", () => {
    const { rerender } = render(card(true, 1))
    act(() => popover.root?.onPinnedChange(true))
    expect(popover.root?.pinned).toBe(true)

    // Its word marked known: the session closes the card by its props alone.
    rerender(card(false, 0))
    expect(popover.root?.pinned).toBe(false)

    rerender(card(true, 2))
    expect(popover.root?.pinned).toBe(false)
  })

  it("keeps the pin from one word to the next while the card stays open", () => {
    const { rerender } = render(card(true, 1))
    act(() => popover.root?.onPinnedChange(true))

    rerender(card(true, 2))
    expect(popover.root?.pinned).toBe(true)
  })
})
