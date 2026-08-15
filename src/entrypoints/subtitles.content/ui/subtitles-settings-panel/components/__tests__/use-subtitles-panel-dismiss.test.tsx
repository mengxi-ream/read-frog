// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react"
import { createRef } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useSubtitlesPanelDismiss } from "../use-subtitles-panel-dismiss"

function mount(onClose: () => void, panel: HTMLElement) {
  const panelRef = createRef<HTMLElement>() as { current: HTMLElement | null }
  panelRef.current = panel
  return renderHook(() => useSubtitlesPanelDismiss({ enabled: true, onClose, panelRef }))
}

/** jsdom has no PointerEvent constructor; MouseEvent carries the same composedPath. */
function pressOn(target: Element) {
  target.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, composed: true }))
}

describe("useSubtitlesPanelDismiss", () => {
  afterEach(() => {
    cleanup()
    document.body.innerHTML = ""
  })

  it("closes on a press that lands outside the panel", () => {
    const panel = document.createElement("div")
    const outside = document.createElement("div")
    document.body.append(panel, outside)
    const onClose = vi.fn<() => void>()
    mount(onClose, panel)

    pressOn(outside)

    expect(onClose).toHaveBeenCalledOnce()
  })

  it("keeps the panel open for a press inside it", () => {
    const panel = document.createElement("div")
    const inside = document.createElement("button")
    panel.append(inside)
    document.body.append(panel)
    const onClose = vi.fn<() => void>()
    mount(onClose, panel)

    pressOn(inside)

    expect(onClose).not.toHaveBeenCalled()
  })

  // The anchored toast portals out of the panel, so it reads as "outside".
  // Dismissing here hides the toast's anchor mid-press, which turns the button
  // the press was aimed at invisible before its click can land.
  it("keeps the panel open for a press on the anchored toast", () => {
    const panel = document.createElement("div")
    const positioner = document.createElement("div")
    positioner.dataset.slot = "toast-positioner"
    const action = document.createElement("button")
    positioner.append(action)
    document.body.append(panel, positioner)
    const onClose = vi.fn<() => void>()
    mount(onClose, panel)

    pressOn(action)

    expect(onClose).not.toHaveBeenCalled()
  })
})
