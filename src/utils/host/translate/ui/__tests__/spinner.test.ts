// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"

const { ensurePresetStylesMock } = vi.hoisted(() => ({
  ensurePresetStylesMock: vi.fn(),
}))

vi.mock("@/utils/host/translate/ui/style-injector", () => ({
  ensurePresetStyles: ensurePresetStylesMock,
}))

describe("spinner", () => {
  beforeEach(() => {
    document.head.innerHTML = ""
    document.body.innerHTML = ""
    ensurePresetStylesMock.mockReset()
  })

  it("ensures preset styles on the document before appending the spinner", async () => {
    const wrapper = document.createElement("span")
    document.body.appendChild(wrapper)

    ensurePresetStylesMock.mockImplementation((root: Document | ShadowRoot) => {
      expect(root).toBe(document)
      expect(wrapper.querySelector(".read-frog-spinner")).toBeNull()

      const style = document.createElement("style")
      style.id = "read-frog-preset-styles"
      document.head.appendChild(style)
    })

    const { createSpinnerInside } = await import("../spinner")
    const spinner = createSpinnerInside(wrapper)

    expect(ensurePresetStylesMock).toHaveBeenCalledOnce()
    expect(document.head.querySelector("#read-frog-preset-styles")).not.toBeNull()
    expect(wrapper.lastElementChild).toBe(spinner)
    expect(spinner.className).toBe("read-frog-spinner")
  })

  it("ensures preset styles on the containing shadow root before appending the spinner", async () => {
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

    const { createSpinnerInside } = await import("../spinner")
    const spinner = createSpinnerInside(wrapper)

    expect(ensurePresetStylesMock).toHaveBeenCalledOnce()
    expect(shadow.querySelector("#read-frog-preset-styles")).not.toBeNull()
    expect(wrapper.lastElementChild).toBe(spinner)
    expect(spinner.className).toBe("read-frog-spinner")
  })
})
