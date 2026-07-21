// @vitest-environment jsdom
import type { SelectionRangeSnapshot } from "../../utils"
import type { ModalDialogHostController } from "../modal-dialog-host"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NOTRANSLATE_CLASS } from "@/utils/constants/dom-labels"
import {
  calibrateModalDialogHostSlot,
  createModalDialogHostController,
  createModalDialogHostSlot,
  findSelectionModalDialog,
  MODAL_DIALOG_HOST_SLOT_ATTRIBUTE,
} from "../modal-dialog-host"

function createRange(
  startContainer: Node,
  endContainer: Node = startContainer,
): SelectionRangeSnapshot {
  return {
    startContainer,
    startOffset: 0,
    endContainer,
    endOffset: endContainer.textContent?.length ?? 0,
  }
}

function createActiveDialog() {
  const dialog = document.createElement("dialog")
  let active = true
  const matches = dialog.matches.bind(dialog)

  dialog.open = true
  document.body.append(dialog)
  vi.spyOn(dialog, "matches").mockImplementation((selector) =>
    selector === ":modal" ? active : matches(selector),
  )

  return {
    dialog,
    setActive: (value: boolean) => {
      active = value
    },
  }
}

describe("modal dialog host placement", () => {
  let animationFrameCallbacks: Map<number, FrameRequestCallback>
  let nextAnimationFrameId: number
  let scrollXDescriptor: PropertyDescriptor | undefined
  let scrollYDescriptor: PropertyDescriptor | undefined
  const controllers: ModalDialogHostController[] = []

  beforeEach(() => {
    animationFrameCallbacks = new Map()
    nextAnimationFrameId = 1
    scrollXDescriptor = Object.getOwnPropertyDescriptor(window, "scrollX")
    scrollYDescriptor = Object.getOwnPropertyDescriptor(window, "scrollY")
    Object.defineProperty(window, "scrollX", { configurable: true, value: 0 })
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 })
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      const id = nextAnimationFrameId
      nextAnimationFrameId += 1
      animationFrameCallbacks.set(id, callback)
      return id
    })
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      animationFrameCallbacks.delete(id)
    })
  })

  afterEach(() => {
    for (const controller of controllers) {
      controller.dispose()
    }
    controllers.length = 0
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    if (scrollXDescriptor) {
      Object.defineProperty(window, "scrollX", scrollXDescriptor)
    } else {
      Reflect.deleteProperty(window, "scrollX")
    }
    if (scrollYDescriptor) {
      Object.defineProperty(window, "scrollY", scrollYDescriptor)
    } else {
      Reflect.deleteProperty(window, "scrollY")
    }
    document.documentElement.innerHTML = "<head></head><body></body>"
  })

  const trackController = (host: HTMLElement) => {
    const controller = createModalDialogHostController(host)
    controllers.push(controller)
    return controller
  }

  const flushAnimationFrames = () => {
    const callbacks = [...animationFrameCallbacks.values()]
    animationFrameCallbacks.clear()
    callbacks.forEach((callback) => callback(performance.now()))
  }

  const flushMutationSync = async () => {
    await Promise.resolve()
    flushAnimationFrames()
    await Promise.resolve()
  }

  it("finds the native modal shared by every selection boundary", () => {
    const { dialog } = createActiveDialog()
    const first = document.createTextNode("First")
    const second = document.createTextNode("Second")
    dialog.append(first, second)

    expect(findSelectionModalDialog([createRange(first), createRange(second)])).toBe(dialog)
  })

  it("walks across a shadow root to find the native modal", () => {
    const { dialog } = createActiveDialog()
    const shadowHost = document.createElement("fixture-shadow-host")
    const shadow = shadowHost.attachShadow({ mode: "open" })
    const selectedText = document.createTextNode("Selected inside shadow")
    shadow.append(selectedText)
    dialog.append(shadowHost)

    expect(findSelectionModalDialog([createRange(selectedText)])).toBe(dialog)
  })

  it("rejects non-modal dialogs, custom modal elements, and mixed boundaries", () => {
    const { dialog, setActive } = createActiveDialog()
    const modalText = document.createTextNode("Modal")
    const outsideText = document.createTextNode("Outside")
    const customModal = document.createElement("div")
    const customText = document.createTextNode("Custom")
    customModal.setAttribute("role", "dialog")
    customModal.append(customText)
    dialog.append(modalText)
    document.body.append(outsideText, customModal)

    expect(findSelectionModalDialog([createRange(modalText, outsideText)])).toBeNull()
    expect(findSelectionModalDialog([createRange(customText)])).toBeNull()

    setActive(false)
    expect(findSelectionModalDialog([createRange(modalText)])).toBeNull()
  })

  it("creates an out-of-flow, zero-sized, non-translatable slot", () => {
    const slot = createModalDialogHostSlot(document)

    expect(slot).toHaveAttribute(MODAL_DIALOG_HOST_SLOT_ATTRIBUTE)
    expect(slot).toHaveClass(NOTRANSLATE_CLASS)
    for (const [property, value] of [
      ["display", "block"],
      ["position", "absolute"],
      ["width", "0px"],
      ["height", "0px"],
      ["overflow", "visible"],
      ["pointer-events", "none"],
      ["z-index", "2147483647"],
    ]) {
      expect(slot.style.getPropertyValue(property)).toBe(value)
      expect(slot.style.getPropertyPriority(property)).toBe("important")
    }
  })

  it("calibrates an offset dialog slot to the document origin", () => {
    Object.defineProperty(window, "scrollX", { configurable: true, value: 100 })
    Object.defineProperty(window, "scrollY", { configurable: true, value: 900 })
    const slot = createModalDialogHostSlot(document)
    vi.spyOn(slot, "getBoundingClientRect").mockImplementation(() => {
      const left = 330 + Number.parseFloat(slot.style.left)
      const top = 120 + Number.parseFloat(slot.style.top)
      return DOMRect.fromRect({ x: left, y: top })
    })

    const calibration = calibrateModalDialogHostSlot(slot)

    expect(calibration).toMatchObject({ aligned: true, errorX: 0, errorY: 0 })
    expect(slot.style.left).toBe("-430px")
    expect(slot.style.top).toBe("-1020px")
    expect(slot.style.getPropertyPriority("left")).toBe("important")
    expect(slot.style.getPropertyPriority("top")).toBe("important")
  })

  it("retries a residual calibration once on the next animation frame", () => {
    const host = document.createElement("read-frog-selection")
    document.body.append(host)
    const { dialog } = createActiveDialog()
    const selectedText = document.createTextNode("Selected")
    dialog.append(selectedText)
    const slotOffsets = [10, 5, 2, 0]
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.hasAttribute(MODAL_DIALOG_HOST_SLOT_ATTRIBUTE)) {
          return DOMRect.fromRect({ x: slotOffsets.shift() ?? 0, y: 0 })
        }

        return DOMRect.fromRect()
      },
    )
    const controller = trackController(host)

    controller.placeForRanges([createRange(selectedText)])
    expect(animationFrameCallbacks.size).toBe(1)

    flushAnimationFrames()
    expect(animationFrameCallbacks.size).toBe(0)
    expect(slotOffsets).toEqual([])
  })

  it("cancels queued placement work and listeners when disposed", () => {
    const host = document.createElement("read-frog-selection")
    document.body.append(host)
    const { dialog } = createActiveDialog()
    const selectedText = document.createTextNode("Selected")
    dialog.append(selectedText)
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return this.hasAttribute(MODAL_DIALOG_HOST_SLOT_ATTRIBUTE)
          ? DOMRect.fromRect({ x: 10, y: 10 })
          : DOMRect.fromRect()
      },
    )
    const controller = trackController(host)

    controller.placeForRanges([createRange(selectedText)])
    expect(animationFrameCallbacks.size).toBe(1)

    controller.dispose()
    expect(animationFrameCallbacks.size).toBe(0)
    window.dispatchEvent(new Event("resize"))
    dialog.dispatchEvent(new Event("scroll"))
    expect(animationFrameCallbacks.size).toBe(0)
  })

  it("moves the same host into a modal slot and restores its original order", () => {
    const host = document.createElement("read-frog-selection")
    const marker = document.createElement("div")
    document.body.append(host, marker)
    const { dialog } = createActiveDialog()
    const selectedText = document.createTextNode("Selected")
    const outsideText = document.createTextNode("Outside")
    dialog.append(selectedText)
    document.body.append(outsideText)
    const controller = trackController(host)

    expect(controller.placeForRanges([createRange(selectedText)])).toBe(true)
    const slot = dialog.querySelector<HTMLElement>(`[${MODAL_DIALOG_HOST_SLOT_ATTRIBUTE}]`)
    expect(slot).not.toBeNull()
    expect(host.parentElement).toBe(slot)

    expect(controller.placeForRanges([createRange(outsideText)])).toBe(false)
    expect(host.parentNode).toBe(document.body)
    expect(host.nextSibling).toBe(marker)
    expect(slot?.isConnected).toBe(false)
  })

  it("switches between native modal dialogs without changing the original restore target", () => {
    const host = document.createElement("read-frog-selection")
    document.body.append(host)
    const first = createActiveDialog().dialog
    const second = createActiveDialog().dialog
    const firstText = document.createTextNode("First")
    const secondText = document.createTextNode("Second")
    first.append(firstText)
    second.append(secondText)
    const controller = trackController(host)

    controller.placeForRanges([createRange(firstText)])
    const firstSlot = first.querySelector(`[${MODAL_DIALOG_HOST_SLOT_ATTRIBUTE}]`)
    controller.placeForRanges([createRange(secondText)])

    expect(firstSlot?.isConnected).toBe(false)
    expect(second.querySelector(`[${MODAL_DIALOG_HOST_SLOT_ATTRIBUTE}]`)?.contains(host)).toBe(true)

    controller.restore()
    expect(host.parentNode).toBe(document.body)
  })

  it("keeps the host in the modal until placement or modal lifecycle explicitly changes", async () => {
    const host = document.createElement("read-frog-selection")
    document.body.append(host)
    const { dialog } = createActiveDialog()
    const selectedText = document.createTextNode("Selected")
    dialog.append(selectedText)
    const controller = trackController(host)

    controller.placeForRanges([createRange(selectedText)])
    await flushMutationSync()

    expect(dialog.contains(host)).toBe(true)
  })

  it("restores a disconnected host when the site removes the modal subtree", async () => {
    const host = document.createElement("read-frog-selection")
    const marker = document.createElement("div")
    document.body.append(host, marker)
    const { dialog } = createActiveDialog()
    const selectedText = document.createTextNode("Selected")
    dialog.append(selectedText)
    const controller = trackController(host)
    controller.placeForRanges([createRange(selectedText)])

    dialog.remove()
    expect(host.isConnected).toBe(false)
    await flushMutationSync()

    expect(host.isConnected).toBe(true)
    expect(host.parentNode).toBe(document.body)
    expect(host.nextSibling).toBe(marker)
  })

  it("restores when a modal is removed from inside a shadow root", async () => {
    const host = document.createElement("read-frog-selection")
    const shadowHost = document.createElement("fixture-shadow-host")
    const shadow = shadowHost.attachShadow({ mode: "open" })
    document.body.append(host, shadowHost)
    const { dialog } = createActiveDialog()
    const selectedText = document.createTextNode("Selected")
    dialog.append(selectedText)
    shadow.append(dialog)
    const controller = trackController(host)
    controller.placeForRanges([createRange(selectedText)])

    dialog.remove()
    expect(host.isConnected).toBe(false)
    await flushMutationSync()

    expect(host.isConnected).toBe(true)
    expect(host.parentNode).toBe(document.body)
  })

  it("self-heals when the site removes the active slot", async () => {
    const host = document.createElement("read-frog-selection")
    document.body.append(host)
    const { dialog } = createActiveDialog()
    const selectedText = document.createTextNode("Selected")
    dialog.append(selectedText)
    const controller = trackController(host)
    controller.placeForRanges([createRange(selectedText)])
    const slot = dialog.querySelector<HTMLElement>(`[${MODAL_DIALOG_HOST_SLOT_ATTRIBUTE}]`)!

    slot.remove()
    expect(host.isConnected).toBe(false)
    await flushMutationSync()

    expect(slot.parentNode).toBe(dialog)
    expect(host.parentNode).toBe(slot)
    expect(host.isConnected).toBe(true)
  })

  it("restores when the dialog closes or loses its native modal state", async () => {
    const host = document.createElement("read-frog-selection")
    document.body.append(host)
    const { dialog, setActive } = createActiveDialog()
    const selectedText = document.createTextNode("Selected")
    dialog.append(selectedText)
    const controller = trackController(host)

    controller.placeForRanges([createRange(selectedText)])
    dialog.dispatchEvent(new Event("close"))
    expect(host.parentNode).toBe(document.body)

    controller.placeForRanges([createRange(selectedText)])
    setActive(false)
    dialog.removeAttribute("open")
    await flushMutationSync()
    expect(host.parentNode).toBe(document.body)
  })

  it("falls back to a replacement body when the original body is removed", async () => {
    const originalBody = document.body
    const host = document.createElement("read-frog-selection")
    originalBody.append(host)
    const { dialog } = createActiveDialog()
    const selectedText = document.createTextNode("Selected")
    dialog.append(selectedText)
    const controller = trackController(host)
    controller.placeForRanges([createRange(selectedText)])

    const replacementBody = document.createElement("body")
    originalBody.replaceWith(replacementBody)
    await flushMutationSync()

    expect(host.parentNode).toBe(replacementBody)
    expect(host.isConnected).toBe(true)
  })

  it("coalesces repeated geometry events into one animation frame", () => {
    const host = document.createElement("read-frog-selection")
    document.body.append(host)
    const { dialog } = createActiveDialog()
    const selectedText = document.createTextNode("Selected")
    dialog.append(selectedText)
    const controller = trackController(host)
    controller.placeForRanges([createRange(selectedText)])

    window.dispatchEvent(new Event("resize"))
    window.dispatchEvent(new Event("resize"))
    dialog.dispatchEvent(new Event("scroll"))

    expect(animationFrameCallbacks.size).toBe(1)
  })
})
