// @vitest-environment jsdom

import type { FeatureUsageContext } from "@/types/analytics"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext } from "@/utils/analytics"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { DEFAULT_BUILT_IN_AI_PROVIDER_ID } from "@/utils/constants/provider-ids"
import { GOOGLE_TRANSLATE_PROVIDER_ID } from "@/utils/constants/providers"
import {
  getPageTranslationSessionId,
  reportPageTranslationRequestFailed,
} from "@/utils/host/translate/translation-session"
import { PageTranslationManager } from "../page-translation"

const {
  mockCheckProviderAvailability,
  mockGetBuiltInAiUpgradePlan,
  mockGetLocalConfig,
  mockIsGuideStepUrl,
  mockOpenBuiltInAiPrompt,
  mockSendMessage,
  mockToastAdd,
  mockValidateTranslationConfigAndToast,
} = vi.hoisted(() => ({
  mockCheckProviderAvailability: vi.fn<(...args: any[]) => any>(),
  mockGetBuiltInAiUpgradePlan: vi.fn<() => Promise<"free" | "pro" | null>>(),
  mockGetLocalConfig: vi.fn<(...args: any[]) => any>(),
  mockIsGuideStepUrl: vi.fn<(url: string) => boolean>(),
  mockOpenBuiltInAiPrompt: vi.fn<(...args: any[]) => any>(),
  mockSendMessage: vi.fn<(...args: any[]) => any>(),
  mockToastAdd: vi.fn<(...args: any[]) => any>(),
  mockValidateTranslationConfigAndToast: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/components/ui/base-ui/toast", () => ({
  toastManager: { add: mockToastAdd, close: vi.fn<(...args: any[]) => any>() },
}))

vi.mock("@/utils/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/analytics")>()),
  trackFeatureUsed: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/config/languages", () => ({
  getDetectedCodeFromStorage: vi.fn<(...args: any[]) => any>().mockResolvedValue("eng"),
}))

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: mockGetLocalConfig,
}))

vi.mock("@/utils/content-runtime/built-in-ai-prompt", () => ({
  getBuiltInAiUpgradePlan: mockGetBuiltInAiUpgradePlan,
  openBuiltInAiPrompt: mockOpenBuiltInAiPrompt,
}))

vi.mock("@/utils/guide/guide-url", () => ({
  isGuideStepUrl: mockIsGuideStepUrl,
}))

vi.mock("@/utils/host/dom/find", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/host/dom/find")>()),
  deepQueryTopLevelSelector: vi.fn<(...args: any[]) => any>().mockReturnValue([]),
}))

vi.mock("@/utils/host/translate/translate-text", () => ({
  validateTranslationConfigAndToast: mockValidateTranslationConfigAndToast,
}))

vi.mock("@/utils/host/translate/translate-variants", () => ({
  translateTextForPageTitle: vi.fn<(...args: any[]) => any>().mockResolvedValue("Titel"),
}))

vi.mock("@/utils/message", () => ({
  sendMessage: mockSendMessage,
}))

vi.mock("@/utils/providers/provider-ref", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/providers/provider-ref")>()),
  checkProviderAvailability: mockCheckProviderAvailability,
}))

class MockIntersectionObserver {
  observe = vi.fn<(...args: any[]) => any>()
  unobserve = vi.fn<(...args: any[]) => any>()
  disconnect = vi.fn<(...args: any[]) => any>()
}

const BUILT_IN_AI_CONFIG = {
  ...DEFAULT_CONFIG,
  pageTranslation: {
    ...DEFAULT_CONFIG.pageTranslation,
    providerId: DEFAULT_BUILT_IN_AI_PROVIDER_ID,
  },
}

const GOOGLE_CONFIG = {
  ...DEFAULT_CONFIG,
  pageTranslation: {
    ...DEFAULT_CONFIG.pageTranslation,
    providerId: GOOGLE_TRANSLATE_PROVIDER_ID,
  },
}

const GUEST_REFUSAL = {
  available: false,
  message: "hostedAi.availability.authenticationRequired",
  reason: "authentication_required",
}

const SPENT_POOL_REFUSAL = {
  available: false,
  message: "hostedAi.availability.quotaExhausted",
  reason: "quota_exhausted",
}

/** What a paragraph's request rejects with once Built-in AI's pool is spent. */
function spentPoolError() {
  return Object.assign(new Error("x"), { code: "HOSTED_AI_QUOTA_EXHAUSTED" })
}

function popupClick() {
  return createFeatureUsageContext(ANALYTICS_FEATURE.PAGE_TRANSLATION, ANALYTICS_SURFACE.POPUP)
}

function automaticStart() {
  return createFeatureUsageContext(ANALYTICS_FEATURE.PAGE_TRANSLATION, ANALYTICS_SURFACE.PAGE_AUTO)
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve
  })
  return { promise, resolve }
}

async function flushAsync(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

/** Puts this test in a frame: `window.top` is another window. */
function inFrame() {
  vi.spyOn(window, "top", "get").mockReturnValue({} as Window)
}

let managers: PageTranslationManager[] = []

function createManager() {
  const manager = new PageTranslationManager()
  managers.push(manager)
  return manager
}

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = "<main>Article body</main>"
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)

  mockGetLocalConfig.mockResolvedValue(BUILT_IN_AI_CONFIG)
  mockIsGuideStepUrl.mockReturnValue(false)
  mockValidateTranslationConfigAndToast.mockReturnValue(true)
  mockGetBuiltInAiUpgradePlan.mockResolvedValue("free")
  mockSendMessage.mockImplementation(async (type: string) =>
    type === "getFreeTranslateProviderId" ? GOOGLE_TRANSLATE_PROVIDER_ID : undefined,
  )
})

afterEach(() => {
  // A session left running would keep listening for failures reported by the next test.
  managers.forEach((manager) => manager.stop())
  managers = []
  vi.restoreAllMocks()
})

describe("page translation when Built-in AI refuses at the start", () => {
  let refusal: typeof GUEST_REFUSAL

  beforeEach(() => {
    refusal = GUEST_REFUSAL
    mockCheckProviderAvailability.mockImplementation(async (provider: { id: string }) =>
      provider.id === DEFAULT_BUILT_IN_AI_PROVIDER_ID
        ? refusal
        : { available: true, providerRef: { kind: "local", config: provider } },
    )
  })

  it("asks a guest who clicks translate to log in, and runs again after a switch", async () => {
    const manager = createManager()
    await manager.start(popupClick())

    expect(manager.isActive).toBe(false)
    expect(mockToastAdd).not.toHaveBeenCalled()
    expect(mockGetBuiltInAiUpgradePlan).not.toHaveBeenCalled()
    expect(mockOpenBuiltInAiPrompt).toHaveBeenCalledWith({
      kind: "logIn",
      feature: "pageTranslation",
      retry: expect.any(Function),
    })

    // The dialog switched the config to the machine translator, then retries.
    mockGetLocalConfig.mockResolvedValue(GOOGLE_CONFIG)
    mockOpenBuiltInAiPrompt.mock.calls[0]![0].retry()
    await vi.waitFor(() => expect(manager.isActive).toBe(true))
  })

  it("keeps automatic translation to a toast", async () => {
    const manager = createManager()
    await manager.start(automaticStart())

    expect(mockOpenBuiltInAiPrompt).not.toHaveBeenCalled()
    expect(mockToastAdd).toHaveBeenCalledWith({
      type: "error",
      title: "hostedAi.availability.authenticationRequired",
    })
  })

  it("translates the website's guide with the free provider and leaves the config alone", async () => {
    mockIsGuideStepUrl.mockReturnValue(true)

    const manager = createManager()
    await manager.start(popupClick())

    expect(manager.isActive).toBe(true)
    expect(mockOpenBuiltInAiPrompt).not.toHaveBeenCalled()
    expect(mockCheckProviderAvailability).toHaveBeenCalledWith(
      expect.objectContaining({ id: GOOGLE_TRANSLATE_PROVIDER_ID }),
      "pageTranslation",
    )
    expect(mockValidateTranslationConfigAndToast).toHaveBeenCalledWith(
      expect.objectContaining({
        pageTranslation: expect.objectContaining({ providerId: GOOGLE_TRANSLATE_PROVIDER_ID }),
      }),
    )

    manager.stop()

    // Off the guide, the next run follows the config again.
    mockIsGuideStepUrl.mockReturnValue(false)
    await manager.start(popupClick())
    expect(mockOpenBuiltInAiPrompt).toHaveBeenCalledTimes(1)
  })

  it.each(["free", "pro"] as const)(
    "asks a %s account that clicks translate with a spent pool to upgrade",
    async (plan) => {
      refusal = SPENT_POOL_REFUSAL
      mockGetBuiltInAiUpgradePlan.mockResolvedValue(plan)

      const manager = createManager()
      await manager.start(popupClick())

      expect(manager.isActive).toBe(false)
      expect(mockToastAdd).not.toHaveBeenCalled()
      expect(mockOpenBuiltInAiPrompt).toHaveBeenCalledOnce()
      expect(mockOpenBuiltInAiPrompt).toHaveBeenCalledWith({
        kind: "upgrade",
        plan,
        feature: "pageTranslation",
        retry: expect.any(Function),
      })

      // "Use machine translation" switched the config, then retries.
      mockGetLocalConfig.mockResolvedValue(GOOGLE_CONFIG)
      mockOpenBuiltInAiPrompt.mock.calls[0]![0].retry()
      await vi.waitFor(() => expect(manager.isActive).toBe(true))
    },
  )

  it("keeps Ultra to a toast: no plan sits above it", async () => {
    refusal = SPENT_POOL_REFUSAL
    mockGetBuiltInAiUpgradePlan.mockResolvedValue(null)

    const manager = createManager()
    await manager.start(popupClick())

    expect(mockOpenBuiltInAiPrompt).not.toHaveBeenCalled()
    expect(mockToastAdd).toHaveBeenCalledWith({
      type: "error",
      title: "hostedAi.availability.quotaExhausted",
    })
  })

  it("keeps automatic translation with a spent pool to a toast, without reading the plan", async () => {
    refusal = SPENT_POOL_REFUSAL

    const manager = createManager()
    await manager.start(automaticStart())

    expect(mockGetBuiltInAiUpgradePlan).not.toHaveBeenCalled()
    expect(mockOpenBuiltInAiPrompt).not.toHaveBeenCalled()
    expect(mockToastAdd).toHaveBeenCalledWith({
      type: "error",
      title: "hostedAi.availability.quotaExhausted",
    })
  })

  it.each([
    ["a guest", GUEST_REFUSAL],
    ["a spent pool", SPENT_POOL_REFUSAL],
  ])("stays quiet in a frame for %s", async (_, frameRefusal) => {
    refusal = frameRefusal
    inFrame()

    const manager = createManager()
    await manager.start(popupClick())

    expect(manager.isActive).toBe(false)
    expect(mockGetBuiltInAiUpgradePlan).not.toHaveBeenCalled()
    expect(mockOpenBuiltInAiPrompt).not.toHaveBeenCalled()
    expect(mockToastAdd).not.toHaveBeenCalled()
  })

  it("drops the upgrade prompt when the start is cancelled while the plan loads", async () => {
    refusal = SPENT_POOL_REFUSAL
    const plan = createDeferred<"free" | "pro" | null>()
    mockGetBuiltInAiUpgradePlan.mockReturnValue(plan.promise)

    const manager = createManager()
    const starting = manager.start(popupClick())
    await vi.waitFor(() => expect(mockGetBuiltInAiUpgradePlan).toHaveBeenCalled())

    manager.stop()
    plan.resolve("free")
    await starting

    expect(mockOpenBuiltInAiPrompt).not.toHaveBeenCalled()
    expect(mockToastAdd).not.toHaveBeenCalled()
  })
})

describe("page translation when Built-in AI's pool runs dry partway down a page", () => {
  beforeEach(() => {
    mockCheckProviderAvailability.mockImplementation(async (provider: { id: string }) => ({
      available: true,
      providerRef: { kind: "local", config: provider },
    }))
  })

  async function startSession(context: FeatureUsageContext<"page_translation"> = popupClick()) {
    const manager = createManager()
    await manager.start(context)
    expect(manager.isActive).toBe(true)
    return manager
  }

  it("ignores a paragraph that failed for another reason", async () => {
    await startSession()

    reportPageTranslationRequestFailed(new Error("Failed"))
    reportPageTranslationRequestFailed(
      Object.assign(new Error("x"), { code: "HOSTED_AI_MODEL_UNAVAILABLE" }),
    )
    reportPageTranslationRequestFailed(Object.assign(new Error("x"), { code: "UNAUTHORIZED" }))
    await flushAsync()

    expect(mockGetBuiltInAiUpgradePlan).not.toHaveBeenCalled()
    expect(mockOpenBuiltInAiPrompt).not.toHaveBeenCalled()
  })

  it("asks to upgrade once, however many paragraphs run dry", async () => {
    await startSession()

    reportPageTranslationRequestFailed(spentPoolError())
    reportPageTranslationRequestFailed(spentPoolError())
    await vi.waitFor(() => expect(mockOpenBuiltInAiPrompt).toHaveBeenCalled())
    reportPageTranslationRequestFailed(spentPoolError())
    await flushAsync()

    expect(mockGetBuiltInAiUpgradePlan).toHaveBeenCalledOnce()
    expect(mockOpenBuiltInAiPrompt).toHaveBeenCalledOnce()
    expect(mockOpenBuiltInAiPrompt).toHaveBeenCalledWith({
      kind: "upgrade",
      plan: "free",
      feature: "pageTranslation",
      retry: expect.any(Function),
    })
    expect(mockToastAdd).not.toHaveBeenCalled()
  })

  it("starts the page over when someone switches to machine translation", async () => {
    const manager = await startSession()
    const firstSessionId = getPageTranslationSessionId()

    reportPageTranslationRequestFailed(spentPoolError())
    await vi.waitFor(() => expect(mockOpenBuiltInAiPrompt).toHaveBeenCalled())

    // The dialog switched the config to the machine translator, then retries.
    mockGetLocalConfig.mockResolvedValue(GOOGLE_CONFIG)
    mockSendMessage.mockClear()
    mockCheckProviderAvailability.mockClear()
    mockOpenBuiltInAiPrompt.mock.calls[0]![0].retry()

    // The old session stops first: its provider was fixed when it started.
    expect(manager.isActive).toBe(false)
    expect(mockSendMessage).toHaveBeenCalledWith(
      "setAndNotifyPageTranslationStateChangedByManager",
      {
        enabled: false,
        url: window.location.href,
        userInitiated: undefined,
      },
    )
    expect(mockSendMessage).toHaveBeenCalledWith("cancelPageTranslationRequests", {
      sessionId: firstSessionId,
    })

    await vi.waitFor(() => expect(manager.isActive).toBe(true))
    expect(mockCheckProviderAvailability).toHaveBeenCalledWith(
      expect.objectContaining({ id: GOOGLE_TRANSLATE_PROVIDER_ID }),
      "pageTranslation",
    )
    expect(getPageTranslationSessionId()).not.toBe(firstSessionId)
  })

  it("leaves automatic translation to its inline errors", async () => {
    await startSession(automaticStart())

    reportPageTranslationRequestFailed(spentPoolError())
    await flushAsync()

    expect(mockGetBuiltInAiUpgradePlan).not.toHaveBeenCalled()
    expect(mockOpenBuiltInAiPrompt).not.toHaveBeenCalled()
  })

  it("leaves a frame to its inline errors", async () => {
    inFrame()
    await startSession()

    reportPageTranslationRequestFailed(spentPoolError())
    await flushAsync()

    expect(mockGetBuiltInAiUpgradePlan).not.toHaveBeenCalled()
    expect(mockOpenBuiltInAiPrompt).not.toHaveBeenCalled()
  })

  it("leaves Ultra to its inline errors, and reads the plan only once", async () => {
    mockGetBuiltInAiUpgradePlan.mockResolvedValue(null)
    await startSession()

    reportPageTranslationRequestFailed(spentPoolError())
    await flushAsync()
    reportPageTranslationRequestFailed(spentPoolError())
    await flushAsync()

    expect(mockGetBuiltInAiUpgradePlan).toHaveBeenCalledOnce()
    expect(mockOpenBuiltInAiPrompt).not.toHaveBeenCalled()
    expect(mockToastAdd).not.toHaveBeenCalled()
  })

  it("stops listening when the session stops", async () => {
    const manager = await startSession()
    manager.stop()

    reportPageTranslationRequestFailed(spentPoolError())
    await flushAsync()

    expect(mockGetBuiltInAiUpgradePlan).not.toHaveBeenCalled()
    expect(mockOpenBuiltInAiPrompt).not.toHaveBeenCalled()
  })

  it("drops the prompt when the session stops while the plan loads", async () => {
    const plan = createDeferred<"free" | "pro" | null>()
    mockGetBuiltInAiUpgradePlan.mockReturnValue(plan.promise)
    const manager = await startSession()

    reportPageTranslationRequestFailed(spentPoolError())
    expect(mockGetBuiltInAiUpgradePlan).toHaveBeenCalledOnce()

    manager.stop()
    plan.resolve("free")
    await flushAsync()

    expect(mockOpenBuiltInAiPrompt).not.toHaveBeenCalled()
  })
})
