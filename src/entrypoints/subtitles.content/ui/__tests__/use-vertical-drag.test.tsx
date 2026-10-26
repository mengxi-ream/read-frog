// @vitest-environment jsdom
import { act, render } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { subtitlesHoveredAtom } from "../../learning/atoms"
import { SubtitlesUIContext } from "../subtitles-ui-context"
import { useVerticalDrag } from "../use-vertical-drag"

vi.mock("@/utils/atoms/config", async () => {
  const { atom } = await import("jotai")
  return { configFieldsAtomMap: { videoSubtitles: atom(DEFAULT_CONFIG.videoSubtitles) } }
})

const controls = vi.hoisted(() => ({ setVisible: (_visible: boolean) => {} }))

// Controls 50px tall that start out shown, in a 500px player: 10% of its height.
vi.mock("../use-controls-visible", async () => {
  const { useState } = await import("react")
  return {
    useControlsInfo: () => {
      const [controlsVisible, setVisible] = useState(true)
      // oxlint-disable-next-line react/globals -- test double hands its setter to the test
      controls.setVisible = setVisible
      return { controlsVisible, controlsHeight: 50 }
    },
  }
})

function SubtitlesBox() {
  const { refs, positionStyle } = useVerticalDrag()
  return (
    // oxlint-disable-next-line react/refs -- the ref object is handed to the ref prop; nothing reads .current here
    <div ref={refs.window}>
      {/* oxlint-disable-next-line react/refs -- the ref object is handed to the ref prop; nothing reads .current here */}
      <div ref={refs.container} data-testid="box" style={positionStyle}>
        {/* oxlint-disable-next-line react/refs -- the ref object is handed to the ref prop; nothing reads .current here */}
        <div ref={refs.handle} />
      </div>
    </div>
  )
}

/** Mounts the box the way the subtitles do: in a shadow root whose host sits in the player. */
function renderBox(store: ReturnType<typeof createStore>) {
  const player = document.createElement("div")
  player.getBoundingClientRect = () =>
    ({ top: 0, left: 0, right: 800, bottom: 500, width: 800, height: 500 }) as DOMRect
  const host = document.createElement("div")
  player.append(host)
  document.body.append(player)
  const mount = document.createElement("div")
  host.attachShadow({ mode: "open" }).append(mount)

  render(
    <Provider store={store}>
      <SubtitlesUIContext value={{} as React.ContextType<typeof SubtitlesUIContext>}>
        <SubtitlesBox />
      </SubtitlesUIContext>
    </Provider>,
    { container: mount },
  )
  return mount.querySelector<HTMLElement>('[data-testid="box"]')!
}

describe("useVerticalDrag", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.replaceChildren()
  })

  it("stays where it was shown while held, even when the controls appear as the pointer arrives", () => {
    const store = createStore()
    const box = renderBox(store)
    act(() => controls.setVisible(false))

    act(() => {
      store.set(subtitlesHoveredAtom, true)
      controls.setVisible(true)
    })
    expect(box.style.bottom).toBe("10%")

    act(() => store.set(subtitlesHoveredAtom, false))
    expect(box.style.bottom).toBe("20%")
  })
})
