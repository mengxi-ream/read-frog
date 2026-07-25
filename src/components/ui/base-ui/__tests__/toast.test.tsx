// @vitest-environment jsdom

import type { ComponentProps } from "react"
import { act, fireEvent, render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  anchoredToastManager,
  AnchoredToastProvider,
  toastManager,
  ToastProvider,
} from "@/components/ui/base-ui/toast"

let shadowHost: HTMLDivElement | null = null

function renderToastProvider(
  viewportProps?: ComponentProps<typeof ToastProvider>["viewportProps"],
) {
  shadowHost = document.createElement("div")
  document.body.append(shadowHost)
  const shadowRoot = shadowHost.attachShadow({ mode: "open" })

  render(<ToastProvider portalProps={{ container: shadowRoot }} viewportProps={viewportProps} />)

  return shadowRoot
}

function renderAnchoredToastProvider(
  props: Omit<ComponentProps<typeof AnchoredToastProvider>, "children" | "portalProps"> = {},
) {
  shadowHost = document.createElement("div")
  document.body.append(shadowHost)
  const shadowRoot = shadowHost.attachShadow({ mode: "open" })

  render(<AnchoredToastProvider portalProps={{ container: shadowRoot }} {...props} />)

  return shadowRoot
}

afterEach(() => {
  vi.useRealTimers()
  act(() => toastManager.close())
  act(() => anchoredToastManager.close())
  shadowHost?.remove()
  shadowHost = null
})

describe("ToastProvider", () => {
  it("auto-dismisses non-anchored toasts after five seconds by default", () => {
    vi.useFakeTimers()
    renderToastProvider()
    const onClose = vi.fn<() => void>()

    act(() => {
      toastManager.add({ onClose, title: "Default timeout" })
      vi.advanceTimersByTime(4999)
    })

    expect(onClose).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(onClose).toHaveBeenCalledOnce()
  })

  it("portals a bottom-right viewport into the requested shadow root", () => {
    const shadowRoot = renderToastProvider({
      className: "custom-viewport",
      id: "toast-viewport",
    })

    const viewport = shadowRoot.querySelector<HTMLElement>("#toast-viewport")
    expect(viewport).not.toBeNull()
    expect(viewport).toHaveAttribute("data-position", "bottom-right")
    expect(viewport).toHaveClass(
      "fixed",
      "notranslate",
      "font-sans",
      "antialiased",
      "custom-viewport",
    )
    expect(document.body.querySelector("[data-slot='toast-viewport']")).toBeNull()
  })

  it("renders the Coss status icon, title, description, and action", async () => {
    const shadowRoot = renderToastProvider()
    const onAction = vi.fn<() => void>()

    act(() => {
      for (const type of ["error", "info", "loading", "success", "warning"] as const) {
        toastManager.add({ title: `${type} title`, type })
      }

      toastManager.add({
        type: "success",
        title: "Saved",
        description: `Incorrect API key provided: ${"sk-proj-".padEnd(160, "*")}`,
        actionProps: { children: "Open", onClick: onAction },
      })
    })

    await waitFor(() => {
      expect(shadowRoot.textContent).toContain("Incorrect API key provided")
    })

    for (const type of ["error", "info", "loading", "success", "warning"] as const) {
      const toast = shadowRoot.querySelector(`[data-type='${type}']`)
      expect(toast?.querySelector("[data-slot='toast-icon'] svg")).not.toBeNull()
    }

    const action = shadowRoot.querySelector<HTMLButtonElement>("[data-slot='toast-action']")
    const content = shadowRoot.querySelector<HTMLElement>("[data-slot='toast-content']")
    const description = shadowRoot.querySelector<HTMLElement>("[data-slot='toast-description']")
    expect(content).toHaveClass("min-w-0")
    expect(description?.parentElement).toHaveClass("min-w-0", "flex-1")
    expect(description).toHaveClass("[overflow-wrap:anywhere]")
    expect(action).toHaveClass("shrink-0")
    expect(action).not.toBeNull()
    fireEvent.click(action!)
    expect(onAction).toHaveBeenCalledOnce()
  })

  it("replays alternating animations when a stable id is upserted", async () => {
    const shadowRoot = renderToastProvider()

    act(() => {
      toastManager.add({ id: "save-status", title: "Saved", type: "success" })
      toastManager.add({ id: "save-status", title: "Saved again", type: "success" })
    })

    await waitFor(() => {
      expect(shadowRoot.querySelector("[data-type='success']")).toHaveClass(
        "animate-toast-success-odd",
      )
    })

    act(() => {
      toastManager.add({ id: "save-status", title: "Saved once more", type: "success" })
    })

    await waitFor(() => {
      expect(shadowRoot.querySelector("[data-type='success']")).toHaveClass(
        "animate-toast-success-even",
      )
    })
    expect(shadowRoot.textContent).toContain("Saved once more")
  })
})

describe("AnchoredToastProvider", () => {
  it("auto-dismisses anchored toasts after three seconds by default", () => {
    vi.useFakeTimers()
    renderAnchoredToastProvider()
    const anchor = document.createElement("button")
    const onClose = vi.fn<() => void>()
    document.body.append(anchor)

    act(() => {
      anchoredToastManager.add({
        onClose,
        positionerProps: { anchor },
        title: "Anchored default timeout",
      })
      vi.advanceTimersByTime(2999)
    })

    expect(onClose).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(onClose).toHaveBeenCalledOnce()
    anchor.remove()
  })

  it("portals a tooltip-style toast into the requested shadow root", async () => {
    const shadowRoot = renderAnchoredToastProvider()
    const anchor = document.createElement("button")
    document.body.append(anchor)

    act(() => {
      anchoredToastManager.add({
        actionProps: { children: "Ignored action" },
        data: { tooltipStyle: true },
        description: "Ignored description",
        positionerProps: { anchor, sideOffset: 6 },
        title: "Copied!",
      })
    })

    await waitFor(() => {
      expect(shadowRoot.textContent).toContain("Copied!")
    })

    const viewport = shadowRoot.querySelector("[data-slot='toast-viewport-anchored']")
    const positioner = shadowRoot.querySelector("[data-slot='toast-positioner']")
    expect(viewport).toHaveClass("notranslate", "font-sans", "antialiased")
    expect(positioner).toHaveClass(
      "z-[2147483647]",
      "max-w-[min(22.5rem,var(--available-width))]",
      "data-anchor-hidden:invisible",
    )
    expect(shadowRoot.textContent).not.toContain("Ignored description")
    expect(shadowRoot.textContent).not.toContain("Ignored action")
    expect(document.body.querySelector("[data-slot='toast-viewport-anchored']")).toBeNull()

    anchor.remove()
  })

  it("renders full status content with actions and long-string wrapping", async () => {
    const shadowRoot = renderAnchoredToastProvider()
    const anchor = document.createElement("button")
    document.body.append(anchor)
    const onAction = vi.fn<() => void>()

    act(() => {
      for (const type of ["error", "info", "loading", "success", "warning"] as const) {
        anchoredToastManager.add({
          id: `anchored-${type}`,
          positionerProps: { anchor },
          title: `${type} title`,
          type,
        })
      }
      anchoredToastManager.add({
        actionProps: { children: "Open", onClick: onAction },
        description: "sk-proj-".padEnd(160, "*"),
        id: "anchored-long-content",
        positionerProps: { anchor },
        title: "Long content",
        type: "error",
      })
    })

    await waitFor(() => {
      expect(shadowRoot.textContent).toContain("Long content")
    })

    for (const type of ["error", "info", "loading", "success", "warning"] as const) {
      const toast = shadowRoot.querySelector(`[data-type='${type}']`)
      expect(toast?.querySelector("[data-slot='toast-icon'] svg")).not.toBeNull()
    }

    const longToast = [...shadowRoot.querySelectorAll("[data-slot='toast-popup']")].find(
      (element) => element.textContent?.includes("Long content"),
    )
    const content = longToast?.querySelector("[data-slot='toast-content']")
    const description = longToast?.querySelector("[data-slot='toast-description']")
    const action = longToast?.querySelector<HTMLButtonElement>("[data-slot='toast-action']")
    expect(content).toHaveClass("min-w-0")
    expect(description).toHaveClass("[overflow-wrap:anywhere]")
    expect(action).toHaveClass("shrink-0")
    fireEvent.click(action!)
    expect(onAction).toHaveBeenCalledOnce()

    anchor.remove()
  })

  it("does not show a toast for a missing or disconnected anchor", async () => {
    const shadowRoot = renderAnchoredToastProvider()
    const disconnectedAnchor = document.createElement("button")

    act(() => {
      anchoredToastManager.add({ id: "missing-anchor", title: "Missing" })
      anchoredToastManager.add({
        id: "disconnected-anchor",
        positionerProps: { anchor: disconnectedAnchor },
        title: "Disconnected",
      })
    })

    await waitFor(() => {
      expect(shadowRoot.querySelector("[data-slot='toast-viewport-anchored']")).not.toBeNull()
    })
    expect(shadowRoot.querySelector("[data-slot='toast-positioner']")).toBeNull()
  })

  it("replays alternating animations when a stable anchored id is upserted", async () => {
    const shadowRoot = renderAnchoredToastProvider({ limit: 3 })
    const anchor = document.createElement("button")
    document.body.append(anchor)

    act(() => {
      anchoredToastManager.add({
        id: "anchored-save-status",
        positionerProps: { anchor },
        title: "Saved",
        type: "success",
      })
      anchoredToastManager.add({
        id: "anchored-save-status",
        positionerProps: { anchor },
        title: "Saved again",
        type: "success",
      })
    })

    await waitFor(() => {
      expect(shadowRoot.querySelector("[data-slot='toast-popup']")).toHaveClass(
        "animate-toast-success-odd",
      )
    })

    act(() => {
      anchoredToastManager.add({
        id: "anchored-save-status",
        positionerProps: { anchor },
        title: "Saved once more",
        type: "success",
      })
    })

    await waitFor(() => {
      expect(shadowRoot.querySelector("[data-slot='toast-popup']")).toHaveClass(
        "animate-toast-success-even",
      )
    })
    expect(shadowRoot.textContent).toContain("Saved once more")

    anchor.remove()
  })
})
