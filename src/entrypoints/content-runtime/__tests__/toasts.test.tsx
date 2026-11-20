// @vitest-environment jsdom

import type { ReactNode } from "react"
import { act, render } from "@testing-library/react"
import { atom } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { anchoredToastManager, toastManager } from "@/components/ui/base-ui/toast"
import { mountSubtitlesToast } from "@/entrypoints/subtitles.content/renderer/mount-subtitles-toast"
import { showAnchoredSubtitlesToast, subtitlesAnchoredToastManager } from "@/utils/subtitles/toast"
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

vi.mock("../selection/built-in-ai-prompt-dialog", () => ({
  BuiltInAiPromptDialog: () => null,
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

function renderSelectionApp(portalContainer: HTMLElement) {
  return render(
    <SelectionApp uiContainer={document.createElement("div")} portalContainer={portalContainer} />,
  )
}

let cleanupSubtitlesToast: (() => void) | undefined

// The corner toast host the subtitles mount on a video page
async function mountSubtitlesCornerToasts() {
  await act(async () => {
    cleanupSubtitlesToast = mountSubtitlesToast()
  })
}

function getSubtitlesCornerToastTitles() {
  const shadowRoot = document.getElementById("read-frog-subtitles-toast-host")?.shadowRoot
  return shadowRoot ? getToastTitles(shadowRoot) : []
}

// A control a toast can sit beside: jsdom lays nothing out
function createAnchor() {
  const anchor = document.createElement("button")
  anchor.getBoundingClientRect = () =>
    ({ x: 0, y: 0, top: 0, left: 0, right: 80, bottom: 24, width: 80, height: 24 }) as DOMRect
  document.body.append(anchor)
  return anchor
}

afterEach(() => {
  act(() => {
    toastManager.close()
    anchoredToastManager.close()
    subtitlesAnchoredToastManager.close()
  })
  act(() => cleanupSubtitlesToast?.())
  cleanupSubtitlesToast = undefined
  document.body.replaceChildren()
})

describe("content runtime toasts", () => {
  // The parts share one module instance, so the selection and side UIs see the
  // same toastManager: a provider in each would render every toast twice.
  it("renders a corner toast once, in the selection UI, with the side UI mounted too", () => {
    const selection = createThemedWrapper()
    const side = createThemedWrapper()
    renderSelectionApp(selection.wrapper)
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
    renderSelectionApp(selection.wrapper)

    act(() => {
      toastManager.add({ title: "Saved to Notebase", type: "success" })
    })

    const toast = selection.shadowRoot.querySelector('[data-slot="toast"]')
    expect(toast?.closest(".dark")).toBe(selection.wrapper)
  })

  // On a video site the subtitles run beside the selection UI, which renders
  // the corner toasts, theirs among them. Each part loads on its own, so the
  // subtitles can mount first.
  it("renders a corner toast once on a video page, in the selection UI", async () => {
    await mountSubtitlesCornerToasts()
    const selection = createThemedWrapper()
    renderSelectionApp(selection.wrapper)

    act(() => {
      toastManager.add({ title: "Subtitles unavailable", type: "error" })
    })

    expect(getToastTitles(selection.shadowRoot)).toEqual(["Subtitles unavailable"])
    expect(getSubtitlesCornerToastTitles()).toEqual([])
  })

  // An embedded player's frame runs the subtitles alone
  it("renders the corner toasts in the subtitles' host in a frame without the selection UI", async () => {
    await mountSubtitlesCornerToasts()

    act(() => {
      toastManager.add({ title: "Subtitles unavailable", type: "error" })
    })

    expect(getSubtitlesCornerToastTitles()).toEqual(["Subtitles unavailable"])
  })

  it("renders the corner toasts in the subtitles' host once the selection UI is gone", async () => {
    await mountSubtitlesCornerToasts()
    const { unmount } = renderSelectionApp(createThemedWrapper().wrapper)
    unmount()

    act(() => {
      toastManager.add({ title: "Subtitles unavailable", type: "error" })
    })

    expect(getSubtitlesCornerToastTitles()).toEqual(["Subtitles unavailable"])
  })

  // The player renders its anchored toasts inside it, so they survive it going
  // fullscreen; the page's, such as the floating button's, render in the side UI.
  it("keeps the player's anchored toasts out of the page's", () => {
    const side = createThemedWrapper()
    render(<SideApp portalContainer={side.wrapper} />)
    const anchor = createAnchor()

    act(() => {
      showAnchoredSubtitlesToast("Sign in to request AI subtitles", anchor)
      anchoredToastManager.add({ title: "Translation is on", positionerProps: { anchor } })
    })

    expect(getToastTitles(side.shadowRoot)).toEqual(["Translation is on"])
  })
})
