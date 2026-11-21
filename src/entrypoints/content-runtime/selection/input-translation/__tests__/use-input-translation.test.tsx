// @vitest-environment jsdom

import { act, cleanup, fireEvent, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  closeBuiltInAiPrompt,
  useBuiltInAiPrompt,
} from "@/utils/content-runtime/built-in-ai-prompt"
import { useInputTranslation } from "../use-input-translation"

const {
  translate,
  trackFeatureUsedMock,
  config,
  inputAtom,
  providerAtom,
  toastAddMock,
  sendMessageMock,
  getUpgradePlanMock,
} = vi.hoisted(() => ({
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
  toastAddMock: vi.fn<(...args: any[]) => any>(),
  sendMessageMock: vi.fn<(...args: any[]) => any>(),
  getUpgradePlanMock: vi.fn<() => Promise<"free" | "pro" | null>>(),
}))

vi.mock("jotai", () => ({ useAtomValue: (atom: object) => (atom === inputAtom ? config : []) }))
vi.mock("@/utils/atoms/config", () => ({
  configFieldsAtomMap: { inputTranslation: inputAtom, providersConfig: providerAtom },
}))
vi.mock("@/utils/host/translate/translate-variants", () => ({ translateTextForInput: translate }))
vi.mock("@/components/ui/base-ui/toast", () => ({
  toastManager: { add: toastAddMock, close: vi.fn<() => void>() },
}))
vi.mock("@/utils/analytics", () => ({
  createFeatureUsageContext: () => ({}),
  trackFeatureUsed: trackFeatureUsedMock,
  trackBuiltInAiPromptShown: (properties: unknown) =>
    sendMessageMock("trackBuiltInAiPromptEvent", { event: "built_in_ai_prompt_shown", properties }),
  trackBuiltInAiPromptAction: vi.fn<() => void>(),
}))
vi.mock("@/utils/message", () => ({ sendMessage: sendMessageMock }))
vi.mock("@/utils/hosted-ai/upgrade-plan", () => ({ getBuiltInAiUpgradePlan: getUpgradePlanMock }))
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

describe("input translation when Built-in AI refuses", () => {
  beforeEach(() => {
    translate.mockReset()
    toastAddMock.mockReset()
    sendMessageMock.mockReset().mockResolvedValue(undefined)
    getUpgradePlanMock.mockReset().mockResolvedValue("free")
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
    closeBuiltInAiPrompt()
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  async function translateWithSpaces() {
    const element = textarea()
    // The selection UI draws the dialog in this frame.
    const dialog = renderHook(() => useBuiltInAiPrompt()).result
    renderHook(useInputTranslation)
    await act(async () => {
      space(element)
      space(element)
      space(element)
    })
    return dialog
  }

  it("asks to upgrade when the server refuses mid-run, instead of saying nothing", async () => {
    // The server's refusal, relayed from the background with its code still on it.
    translate.mockRejectedValue(
      Object.assign(new Error("Built-in AI quota used up"), { code: "HOSTED_AI_QUOTA_EXHAUSTED" }),
    )

    const dialog = await translateWithSpaces()

    await vi.waitFor(() =>
      expect(dialog.current).toEqual({
        kind: "upgrade",
        plan: "free",
        feature: "inputTranslation",
        analyticsFeature: "input_translation",
        trigger: "user",
        retry: undefined,
      }),
    )
    expect(toastAddMock).not.toHaveBeenCalled()
    expect(sendMessageMock).toHaveBeenCalledWith("trackBuiltInAiPromptEvent", {
      event: "built_in_ai_prompt_shown",
      properties: {
        feature: "input_translation",
        kind: "upgrade",
        presentation: "dialog",
        trigger: "user",
      },
    })
  })

  it("tells Ultra its pool is spent in a toast", async () => {
    getUpgradePlanMock.mockResolvedValue(null)
    translate.mockRejectedValue(
      Object.assign(new Error("Built-in AI quota used up"), { code: "HOSTED_AI_QUOTA_EXHAUSTED" }),
    )

    const dialog = await translateWithSpaces()

    await vi.waitFor(() =>
      expect(toastAddMock).toHaveBeenCalledWith({
        type: "error",
        title: "Built-in AI quota used up",
        id: "input-translation-hosted-unavailable",
      }),
    )
    expect(dialog.current).toBeNull()
  })

  it("keeps quiet about a failure that is not Built-in AI's", async () => {
    translate.mockRejectedValue(new Error("Failed to fetch"))

    const dialog = await translateWithSpaces()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(dialog.current).toBeNull()
    expect(toastAddMock).not.toHaveBeenCalled()
  })
})
