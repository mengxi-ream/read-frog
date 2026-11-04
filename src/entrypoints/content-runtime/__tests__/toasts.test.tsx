// @vitest-environment jsdom

import type { ReactNode } from "react"
import { act, render } from "@testing-library/react"
import { atom } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { toastManager } from "@/components/ui/base-ui/toast"
import { applyTheme } from "@/utils/theme"
import SelectionApp from "../selection/app"
import SideApp from "../side/app"

vi.mock("@/utils/atoms/config", () => ({
  configFieldsAtomMap: { selectionToolbar: atom({ opacity: 100 }) },
}))

vi.mock("../selection/input-translation", () => ({
  useInputTranslation: () => {},
}))

vi.mock("../selection/use-context-menu-read-aloud", () => ({
  useContextMenuReadAloud: () => {},
}))

vi.mock("../selection/selection-toolbar", () => ({
  SelectionToolbar: () => null,
}))

vi.mock("../selection/selection-toolbar/custom-action-button/provider", () => ({
  SelectionCustomActionProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("../selection/selection-toolbar/speak-button", () => ({
  SelectionSpeechProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("../selection/selection-toolbar/translate-button/provider", () => ({
  SelectionTranslationProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("../selection/annotation/provider", () => ({
  AnnotationProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("../selection/annotation/mode-pill", () => ({
  AnnotationModePill: () => null,
}))

vi.mock("../side/components/floating-button", () => ({
  default: () => null,
}))

// Each UI mounts into a wrapper inside its shadow root, which ThemeProvider
// gives the theme class.
function createThemedWrapper(theme: "light" | "dark" = "light") {
  const shadowHost = document.createElement("div")
  document.body.append(shadowHost)
  const shadowRoot = shadowHost.attachShadow({ mode: "open" })
  const wrapper = document.createElement("div")
  applyTheme(wrapper, theme)
  shadowRoot.append(wrapper)
  return { shadowRoot, wrapper }
}

function getToastTitles(root: ParentNode) {
  return [...root.querySelectorAll('[data-slot="toast-title"]')].map((title) => title.textContent)
}

afterEach(() => {
  act(() => toastManager.close())
  document.body.replaceChildren()
})

describe("content runtime toasts", () => {
  // The parts share one module instance, so the selection and side UIs see the
  // same toastManager: a provider in each would render every toast twice.
  it("renders a corner toast once, in the selection UI, with the side UI mounted too", () => {
    const selection = createThemedWrapper()
    const side = createThemedWrapper()
    render(
      <SelectionApp
        uiContainer={document.createElement("div")}
        portalContainer={selection.wrapper}
      />,
    )
    render(<SideApp portalContainer={side.wrapper} />)

    act(() => {
      toastManager.add({ title: "Saved to Notebase", type: "success" })
    })

    expect(getToastTitles(selection.shadowRoot)).toEqual(["Saved to Notebase"])
    expect(getToastTitles(side.shadowRoot)).toEqual([])
  })

  // The theme tokens live on the wrapper's `.dark` class. Portalled to the
  // shadow root itself, a toast sat beside the wrapper and stayed light.
  it("renders a corner toast under the UI's theme class", () => {
    const selection = createThemedWrapper("dark")
    render(
      <SelectionApp
        uiContainer={document.createElement("div")}
        portalContainer={selection.wrapper}
      />,
    )

    act(() => {
      toastManager.add({ title: "Saved to Notebase", type: "success" })
    })

    const toast = selection.shadowRoot.querySelector('[data-slot="toast"]')
    expect(toast?.closest(".dark")).toBe(selection.wrapper)
  })
})
