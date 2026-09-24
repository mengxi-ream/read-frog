// @vitest-environment jsdom

import { act, cleanup, fireEvent, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useInputTranslation } from "../use-input-translation"

const { translate, trackFeatureUsedMock, config, inputAtom, providerAtom } = vi.hoisted(() => ({
  translate:
    vi.fn<
      (
        text: string,
        from: string,
        to: string,
        onTarget: (target: string) => void,
      ) => Promise<string>
    >(),
  trackFeatureUsedMock: vi.fn<(...args: unknown[]) => void>(),
  config: {
    enabled: true,
    fromLang: "cmn",
    toLang: "eng",
    enableCycle: false,
    providerId: "test",
    timeThreshold: 300,
  },
  inputAtom: {},
  providerAtom: {},
}))

vi.mock("jotai", () => ({ useAtomValue: (atom: object) => (atom === inputAtom ? config : []) }))
vi.mock("@/utils/atoms/config", () => ({
  configFieldsAtomMap: { inputTranslation: inputAtom, providersConfig: providerAtom },
}))
vi.mock("@/utils/host/translate/translate-variants", () => ({ translateTextForInput: translate }))
vi.mock("@/components/ui/base-ui/toast", () => ({ toastManager: { add: vi.fn<() => void>() } }))
vi.mock("@/utils/analytics", () => ({
  createFeatureUsageContext: () => ({}),
  trackFeatureUsed: trackFeatureUsedMock,
}))
vi.mock("@/utils/analytics-provider", () => ({
  UNKNOWN_FEATURE_PROVIDER: { provider: "unknown", backend_kind: "unknown" },
  classifyResolvedProvider: () => ({ provider: "openai", backend_kind: "llm" }),
}))
vi.mock("@/utils/providers/provider-registry", () => ({
  resolveProviderRefForCapability: () => ({}),
}))

function textarea(shadowDepth = 0) {
  const host = document.createElement("div")
  document.body.append(host)
  let root: HTMLElement | ShadowRoot = host
  for (let depth = 0; depth < shadowDepth; depth++) {
    const nestedHost = document.createElement("div")
    root.append(nestedHost)
    root = nestedHost.attachShadow({ mode: "open" })
  }
  const element = document.createElement("textarea")
  element.value = "你好"
  root.append(element)
  element.focus()
  return element
}

function space(element: HTMLElement) {
  fireEvent.keyDown(element, { key: " ", bubbles: true, composed: true })
  fireEvent.keyUp(element, { key: " ", bubbles: true, composed: true })
}

function reply(text: string) {
  const element = document.createElement("div")
  element.tabIndex = 0
  element.textContent = text.replaceAll("\n", "")
  // jsdom has no layout-backed innerText or isContentEditable.
  Object.defineProperties(element, {
    isContentEditable: { value: true },
    innerText: { value: text, writable: true },
  })
  document.body.append(element)
  element.focus()
  return element
}

describe("input translation across editors", () => {
  beforeEach(() => {
    translate.mockReset().mockResolvedValue("Hello")
    trackFeatureUsedMock.mockReset()
    config.enableCycle = false
    sessionStorage.clear()
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn<() => boolean>(() => true),
    })
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: vi.fn<() => void>(),
    })
  })

  afterEach(() => {
    cleanup()
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it("translates after three space presses in a regular textarea", async () => {
    const element = textarea()
    renderHook(useInputTranslation)
    await act(async () => {
      space(element)
      space(element)
      space(element)
    })
    expect(translate).toHaveBeenCalledWith("你好", "cmn", "eng", expect.any(Function))
  })

  it("reports the resolved target after cycling the input direction", async () => {
    config.enableCycle = true
    translate.mockImplementation(async (_text, _from, to, onTarget) => {
      onTarget(to)
      return "Hello"
    })
    const element = textarea()
    renderHook(useInputTranslation)
    await act(async () => {
      space(element)
      space(element)
      space(element)
    })

    expect(translate).toHaveBeenCalledWith("你好", "eng", "cmn", expect.any(Function))
    expect(trackFeatureUsedMock).toHaveBeenCalledWith(
      expect.objectContaining({ target_language: "cmn", char_count: 2, outcome: "success" }),
    )
  })

  it.each([1, 2])("translates a focused textarea inside %i shadow roots", async (depth) => {
    const element = textarea(depth)
    renderHook(useInputTranslation)
    await act(async () => {
      space(element)
      space(element)
      space(element)
    })
    expect(translate).toHaveBeenCalledWith("你好", "cmn", "eng", expect.any(Function))
  })

  it("preserves rich-text paragraph breaks when requesting translation", async () => {
    const element = reply("你好\n\n谢谢分享")
    renderHook(useInputTranslation)
    await act(async () => {
      space(element)
      space(element)
      space(element)
    })
    expect(translate).toHaveBeenCalledWith("你好\n\n谢谢分享", "cmn", "eng", expect.any(Function))
  })

  it("targets the original reply when focus changes during translation", async () => {
    const pending = Promise.withResolvers<string>()
    translate.mockReturnValueOnce(pending.promise)
    const post = vi.spyOn(window, "postMessage").mockImplementation(() => {})
    const first = reply("第一条")
    const second = reply("第二条")
    renderHook(useInputTranslation)
    first.focus()
    await act(async () => {
      space(first)
      space(first)
      space(first)
    })
    second.focus()
    await act(async () => pending.resolve("First reply"))
    expect(document.activeElement).toBe(first)
    expect(post).toHaveBeenCalledWith(
      { type: "READ_FROG_INPUT_REPLACE", text: "First reply" },
      window.location.origin,
    )
    expect(second.innerText).toBe("第二条")
  })

  it("does not replace text the user edited while translation was pending", async () => {
    const pending = Promise.withResolvers<string>()
    translate.mockReturnValueOnce(pending.promise)
    const post = vi.spyOn(window, "postMessage").mockImplementation(() => {})
    const element = reply("你好")
    renderHook(useInputTranslation)
    await act(async () => {
      space(element)
      space(element)
      space(element)
    })
    element.innerText = "你好，新内容"
    await act(async () => pending.resolve("Hello"))
    expect(post).not.toHaveBeenCalled()
  })

  it("does not write into another reply after the original editor was removed", async () => {
    const pending = Promise.withResolvers<string>()
    translate.mockReturnValueOnce(pending.promise)
    const post = vi.spyOn(window, "postMessage").mockImplementation(() => {})
    const first = reply("第一条")
    const second = reply("第二条")
    renderHook(useInputTranslation)
    first.focus()
    await act(async () => {
      space(first)
      space(first)
      space(first)
    })
    first.remove()
    second.focus()
    await act(async () => pending.resolve("First reply"))
    expect(post).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(second)
  })
})
