// @vitest-environment jsdom

import type { ComponentProps } from "react"
import { act, fireEvent, render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { toastManager, ToastProvider } from "@/components/ui/base-ui/toast"

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

afterEach(() => {
  act(() => toastManager.close())
  shadowHost?.remove()
  shadowHost = null
})

describe("ToastProvider", () => {
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
