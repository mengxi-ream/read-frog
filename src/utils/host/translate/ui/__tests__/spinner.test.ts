// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { TRANSLATION_ERROR_CONTAINER_CLASS } from "@/utils/constants/dom-labels"
import { TranslationCancelledError } from "@/utils/request/cancellation"
import {
  cancelSpinnerAnimation,
  createLightweightSpinner,
  createSpinnerInside,
  getTranslatedTextAndRemoveSpinner,
  MAX_ANIMATED_SPINNERS,
} from "../spinner"

const { ensurePresetStylesMock } = vi.hoisted(() => ({
  ensurePresetStylesMock: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/host/translate/ui/style-injector", () => ({
  ensurePresetStyles: ensurePresetStylesMock,
}))

describe("spinner", () => {
  beforeEach(() => {
    document.head.innerHTML = ""
    document.body.innerHTML = ""
    ensurePresetStylesMock.mockReset()
    vi.restoreAllMocks()
  })

  it("ensures preset styles on the document before appending the spinner", () => {
    const wrapper = document.createElement("span")
    document.body.appendChild(wrapper)

    ensurePresetStylesMock.mockImplementation((root: Document | ShadowRoot) => {
      expect(root).toBe(document)
      expect(wrapper.querySelector(".read-frog-spinner")).toBeNull()

      const style = document.createElement("style")
      style.id = "read-frog-preset-styles"
      document.head.appendChild(style)
    })

    const spinner = createSpinnerInside(wrapper)

    expect(ensurePresetStylesMock).toHaveBeenCalledOnce()
    expect(document.head.querySelector("#read-frog-preset-styles")).not.toBeNull()
    expect(wrapper.lastElementChild).toBe(spinner)
    expect(spinner.className).toBe("read-frog-spinner")
  }, 10_000)

  it("ensures preset styles on the containing shadow root before appending the spinner", () => {
    const host = document.createElement("div")
    const shadow = host.attachShadow({ mode: "open" })
    const wrapper = document.createElement("span")
    shadow.appendChild(wrapper)

    ensurePresetStylesMock.mockImplementation((root: Document | ShadowRoot) => {
      expect(root).toBe(shadow)
      expect(wrapper.querySelector(".read-frog-spinner")).toBeNull()

      const style = document.createElement("style")
      style.id = "read-frog-preset-styles"
      shadow.appendChild(style)
    })

    const spinner = createSpinnerInside(wrapper)

    expect(ensurePresetStylesMock).toHaveBeenCalledOnce()
    expect(shadow.querySelector("#read-frog-preset-styles")).not.toBeNull()
    expect(wrapper.lastElementChild).toBe(spinner)
    expect(spinner.className).toBe("read-frog-spinner")
  }, 10_000)

  it("uses a thin gray spinner arc without a background ring", () => {
    const spinner = createLightweightSpinner(document)

    expect(spinner.style.borderTopColor).toBe("var(--read-frog-muted-foreground)")
    expect(spinner.style.borderRightColor).toBe("transparent")
    expect(spinner.style.borderBottomColor).toBe("transparent")
    expect(spinner.style.borderLeftColor).toBe("transparent")
    expect(spinner.style.borderTopWidth).toBe("1.5px")
  })

  it("keeps the gray segment visible when reduced motion is enabled", () => {
    Object.defineProperty(window, "matchMedia", {
      value: vi.fn<(...args: any[]) => any>().mockReturnValue({
        matches: true,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addListener: vi.fn<(...args: any[]) => any>(),
        removeListener: vi.fn<(...args: any[]) => any>(),
        addEventListener: vi.fn<(...args: any[]) => any>(),
        removeEventListener: vi.fn<(...args: any[]) => any>(),
        dispatchEvent: vi.fn<(...args: any[]) => any>(),
      }),
      configurable: true,
      writable: true,
    })

    const animateMock = vi.fn<(...args: any[]) => any>()
    Object.defineProperty(HTMLElement.prototype, "animate", {
      value: animateMock,
      configurable: true,
      writable: true,
    })

    const spinner = createLightweightSpinner(document)

    expect(animateMock).not.toHaveBeenCalled()
    expect(spinner.style.borderTopColor).toBe("var(--read-frog-muted-foreground)")
  })
})

describe("spinner animation registry (#1881)", () => {
  // jsdom has no WAAPI: install a fake Element.animate returning a
  // cancellable handle so the registry/cap logic is observable.
  const createdAnimations: { cancel: ReturnType<typeof vi.fn> }[] = []
  const animateMock = vi.fn<() => Animation>(() => {
    const animation = { cancel: vi.fn<() => void>() }
    createdAnimations.push(animation)
    return animation as unknown as Animation
  })

  // Spinners created per test, cancelled afterwards so the module-level
  // active-animation counter never leaks between tests.
  let createdSpinners: HTMLElement[] = []

  function makeSpinner(): HTMLElement {
    const spinner = createLightweightSpinner(document)
    createdSpinners.push(spinner)
    return spinner
  }

  beforeEach(() => {
    createdSpinners.forEach((spinner) => cancelSpinnerAnimation(spinner))
    createdSpinners = []
    createdAnimations.length = 0
    animateMock.mockClear()
    Object.defineProperty(HTMLElement.prototype, "animate", {
      value: animateMock,
      configurable: true,
      writable: true,
    })
    // The reduced-motion test above redefines window.matchMedia persistently;
    // force motion back on for this block.
    Object.defineProperty(window, "matchMedia", {
      value: vi.fn<(...args: any[]) => any>().mockReturnValue({ matches: false }),
      configurable: true,
      writable: true,
    })
  })

  it("cancels the stored animation directly instead of calling getAnimations", () => {
    const spinner = makeSpinner()
    expect(animateMock).toHaveBeenCalledTimes(1)

    const getAnimations = vi.fn<() => Animation[]>(() => [])
    spinner.getAnimations = getAnimations

    cancelSpinnerAnimation(spinner)
    expect(createdAnimations[0].cancel).toHaveBeenCalledTimes(1)
    expect(getAnimations).not.toHaveBeenCalled()

    // Second cancel: registry entry is gone — falls back to getAnimations.
    cancelSpinnerAnimation(spinner)
    expect(getAnimations).toHaveBeenCalledTimes(1)
    expect(createdAnimations[0].cancel).toHaveBeenCalledTimes(1)
  })

  it("caps concurrent animations and reopens slots after cancellation", () => {
    for (let i = 0; i < MAX_ANIMATED_SPINNERS; i++) {
      makeSpinner()
    }
    expect(animateMock).toHaveBeenCalledTimes(MAX_ANIMATED_SPINNERS)

    // Above the cap: static muted ring, no new animation.
    const overCap = makeSpinner()
    expect(animateMock).toHaveBeenCalledTimes(MAX_ANIMATED_SPINNERS)
    expect(overCap.style.borderTopColor).toBe("var(--read-frog-muted-foreground)")

    // Cancelling one frees a slot for the next spinner.
    cancelSpinnerAnimation(createdSpinners[0])
    makeSpinner()
    expect(animateMock).toHaveBeenCalledTimes(MAX_ANIMATED_SPINNERS + 1)
  })

  it("swallows TranslationCancelledError silently even when isCurrent stays true", async () => {
    const wrapper = document.createElement("span")
    document.body.append(wrapper)
    const spinner = makeSpinner()
    wrapper.append(spinner)

    const result = await getTranslatedTextAndRemoveSpinner(
      [],
      "source text",
      spinner,
      wrapper,
      () => true,
      "plain",
      () => Promise.reject(new TranslationCancelledError("7:session")),
    )

    expect(result).toBeUndefined()
    expect(wrapper.querySelector(`.${TRANSLATION_ERROR_CONTAINER_CLASS}`)).toBeNull()
    expect(spinner.isConnected).toBe(false)
    expect(createdAnimations[0].cancel).toHaveBeenCalled()

    wrapper.remove()
  })
})
