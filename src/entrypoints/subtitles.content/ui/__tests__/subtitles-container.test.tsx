// @vitest-environment jsdom
import { act, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { anchoredToastManager } from "@/components/ui/base-ui/toast"
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host"
import { showAnchoredSubtitlesToast, subtitlesAnchoredToastManager } from "@/utils/subtitles/toast"
import { SubtitlesContainer } from "../subtitles-container"

vi.mock("../../atoms", async () => {
  const { atom } = await import("jotai")
  return {
    subtitlesDisplayAtom: atom({ stateData: null, isVisible: false }),
    subtitlesShowContentAtom: atom(false),
    subtitlesShowStateAtom: atom(undefined),
  }
})
vi.mock("../../learning/word-lookup-card", () => ({ WordLookupCard: () => null }))
vi.mock("../state-message", () => ({ StateMessage: () => null }))
vi.mock("../subtitles-settings-panel", () => ({ SubtitlesSettingsPanel: () => null }))
vi.mock("../subtitles-ui-context", () => ({ useSubtitlesUI: () => ({ embedded: false }) }))
vi.mock("../subtitles-view", () => ({ SubtitlesView: () => null }))
vi.mock("../use-subtitles-custom-css", () => ({ useSubtitlesCustomCSS: () => {} }))

// The wrapper inside the player's shadow root
function renderContainer() {
  const wrapper = document.createElement("div")
  document.body.append(wrapper)
  render(
    <ShadowWrapperContext value={wrapper}>
      <SubtitlesContainer />
    </ShadowWrapperContext>,
  )
  return wrapper
}

// A control a toast can sit beside: jsdom lays nothing out
function createAnchor() {
  const anchor = document.createElement("button")
  anchor.getBoundingClientRect = () =>
    ({ x: 0, y: 0, top: 0, left: 0, right: 80, bottom: 24, width: 80, height: 24 }) as DOMRect
  document.body.append(anchor)
  return anchor
}

function getToastTitles(root: ParentNode) {
  return [...root.querySelectorAll('[data-slot="toast-title"]')].map((title) => title.textContent)
}

describe("SubtitlesContainer", () => {
  afterEach(() => {
    act(() => {
      anchoredToastManager.close()
      subtitlesAnchoredToastManager.close()
    })
    document.body.replaceChildren()
  })

  // Inside the player, a toast survives it going fullscreen
  it("renders the player's anchored toasts", () => {
    const wrapper = renderContainer()

    act(() => showAnchoredSubtitlesToast("Sign in to request AI subtitles", createAnchor()))

    expect(getToastTitles(wrapper)).toEqual(["Sign in to request AI subtitles"])
  })

  // The content runtime's parts share one `anchoredToastManager`, and the
  // page's anchored toasts, such as the floating button's, sit outside the player.
  it("leaves the page's anchored toasts out", () => {
    const wrapper = renderContainer()

    act(() => {
      anchoredToastManager.add({
        title: "Translation is on",
        positionerProps: { anchor: createAnchor() },
      })
    })

    expect(getToastTitles(wrapper)).toEqual([])
  })
})
