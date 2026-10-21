// @vitest-environment jsdom

import type { ReactNode } from "react"
import { act, render } from "@testing-library/react"
import { atom } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { toastManager } from "@/components/ui/base-ui/toast"
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

vi.mock("../side/components/floating-button", () => ({
  default: () => null,
}))

function createShadowRoot() {
  const shadowHost = document.createElement("div")
  document.body.append(shadowHost)
  return shadowHost.attachShadow({ mode: "open" })
}

function getToastTitles(shadowRoot: ShadowRoot) {
  return [...shadowRoot.querySelectorAll('[data-slot="toast-title"]')].map(
    (title) => title.textContent,
  )
}

afterEach(() => {
  act(() => toastManager.close())
  document.body.replaceChildren()
})

describe("content runtime toasts", () => {
  // The parts share one module instance, so the selection and side UIs see the
  // same toastManager: a provider in each would render every toast twice.
  it("renders a corner toast once, in the selection UI, with the side UI mounted too", () => {
    const selectionShadowRoot = createShadowRoot()
    const sideShadowRoot = createShadowRoot()
    render(
      <SelectionApp
        uiContainer={document.createElement("div")}
        portalContainer={selectionShadowRoot}
      />,
    )
    render(<SideApp portalContainer={sideShadowRoot} />)

    act(() => {
      toastManager.add({ title: "Saved to Notebase", type: "success" })
    })

    expect(getToastTitles(selectionShadowRoot)).toEqual(["Saved to Notebase"])
    expect(getToastTitles(sideShadowRoot)).toEqual([])
  })
})
