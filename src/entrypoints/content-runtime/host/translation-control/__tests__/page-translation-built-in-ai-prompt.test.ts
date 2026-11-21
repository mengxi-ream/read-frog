// @vitest-environment jsdom

import type { FeatureUsageContext } from "@/types/analytics"
import { renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext } from "@/utils/analytics"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { DEFAULT_BUILT_IN_AI_PROVIDER_ID } from "@/utils/constants/provider-ids"
import { GOOGLE_TRANSLATE_PROVIDER_ID } from "@/utils/constants/providers"
import {
  closeBuiltInAiPrompt,
  useBuiltInAiPrompt,
} from "@/utils/content-runtime/built-in-ai-prompt"
import {
  getPageTranslationSessionId,
  isPageTranslationRequestFailureClaimed,
  reportPageTranslationRequestFailed,
} from "@/utils/host/translate/translation-session"
import { HostedAiProviderUnavailableError } from "@/utils/providers/provider-ref"
import { PageTranslationManager } from "../page-translation"

const {
  mockCheckProviderAvailability,
  mockClaimAutoPrompt,
  mockGetBuiltInAiUpgradePlan,
  mockGetLocalConfig,
  mockIsGuideStepUrl,
  mockSendMessage,
  mockToastAdd,
  mockValidateTranslationConfigAndToast,
} = vi.hoisted(() => ({
  mockCheckProviderAvailability: vi.fn<(...args: any[]) => any>(),
  mockClaimAutoPrompt: vi.fn<() => Promise<boolean>>(),
  mockGetBuiltInAiUpgradePlan: vi.fn<() => Promise<"free" | "pro" | null>>(),
  mockGetLocalConfig: vi.fn<(...args: any[]) => any>(),
  mockIsGuideStepUrl: vi.fn<(url: string) => boolean>(),
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

vi.mock("@/utils/hosted-ai/upgrade-plan", () => ({
  getBuiltInAiUpgradePlan: mockGetBuiltInAiUpgradePlan,
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

function availabilityRefusal(
  message: string,
  reason: "authentication_required" | "quota_exhausted" | "service_unavailable",
) {
  return {
    available: false,
    message,
    reason,
    error: new HostedAiProviderUnavailableError({} as never, message, undefined, reason),
  }
}

const GUEST_REFUSAL = availabilityRefusal(
  "hostedAi.availability.authenticationRequired",
  "authentication_required",
)

const SPENT_POOL_REFUSAL = availabilityRefusal(
  "hostedAi.availability.quotaExhausted",
  "quota_exhausted",
)

const OUTAGE_REFUSAL = availabilityRefusal("Built-in AI is down", "service_unavailable")

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

/** The prompt the selection UI's dialog shows; this frame draws the dialog. */
let dialog: { readonly current: ReturnType<typeof useBuiltInAiPrompt> }

function shownEvents() {
  return mockSendMessage.mock.calls
    .filter(
      ([type, event]) =>
        type === "trackBuiltInAiPromptEvent" && event.event === "built_in_ai_prompt_shown",
    )
    .map(([, event]) => event.properties)
}

/** The refusal toast with the dialog's button, as opposed to a plain error toast. */
function refusalToasts() {
  return mockToastAdd.mock.calls
    .map(([toast]) => toast)
    .filter((toast) => toast.id === "built-in-ai-refusal-page_translation")
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
  mockClaimAutoPrompt.mockResolvedValue(true)
  mockToastAdd.mockImplementation((toast: { id?: string }) => toast.id ?? "toast")
  mockSendMessage.mockImplementation(async (type: string) => {
    switch (type) {
      case "getFreeTranslateProviderId":
        return GOOGLE_TRANSLATE_PROVIDER_ID
      case "claimBuiltInAiAutoPrompt":
        return mockClaimAutoPrompt()
      default:
        return undefined
    }
  })
  dialog = renderHook(() => useBuiltInAiPrompt()).result
})

afterEach(() => {
  // A session left running would keep listening for failures reported by the next test.
  managers.forEach((manager) => manager.stop())
  managers = []
  closeBuiltInAiPrompt()
  vi.restoreAllMocks()
})

describe("page translation when Built-in AI refuses at the start", () => {
  let refusal: ReturnType<typeof availabilityRefusal>

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
    await vi.waitFor(() =>
      expect(dialog.current).toEqual({
        kind: "logIn",
        feature: "pageTranslation",
        analyticsFeature: "page_translation",
        trigger: "user",
        retry: expect.any(Function),
      }),
    )
    expect(shownEvents()).toEqual([
      { feature: "page_translation", kind: "log_in", presentation: "dialog", trigger: "user" },
    ])

    // The dialog switched the config to the machine translator, then retries.
    mockGetLocalConfig.mockResolvedValue(GOOGLE_CONFIG)
    dialog.current!.retry!()
    await vi.waitFor(() => expect(manager.isActive).toBe(true))
  })

  it("keeps a guest's automatic translation to a toast with the log-in button", async () => {
    const manager = createManager()
    await manager.start(automaticStart())

    expect(dialog.current).toBeNull()
    // The once-a-session dialog is kept for a spent pool.
    expect(mockClaimAutoPrompt).not.toHaveBeenCalled()
    expect(refusalToasts()).toEqual([
      expect.objectContaining({
        type: "error",
        title: "hostedAi.availability.authenticationRequired",
        actionProps: expect.objectContaining({ children: "account.login" }),
      }),
    ])
    expect(shownEvents()).toEqual([
      { feature: "page_translation", kind: "log_in", presentation: "toast", trigger: "auto" },
    ])
  })

  it("keeps any other refusal to a plain toast", async () => {
    refusal = OUTAGE_REFUSAL

    const manager = createManager()
    await manager.start(popupClick())

    expect(dialog.current).toBeNull()
    expect(mockToastAdd).toHaveBeenCalledWith({ type: "error", title: "Built-in AI is down" })
    expect(shownEvents()).toEqual([])
  })

  it("translates the website's guide with the free provider and leaves the config alone", async () => {
    mockIsGuideStepUrl.mockReturnValue(true)

    const manager = createManager()
    await manager.start(popupClick())

    expect(manager.isActive).toBe(true)
    expect(dialog.current).toBeNull()
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
    await vi.waitFor(() => expect(dialog.current).toMatchObject({ kind: "logIn" }))
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
      await vi.waitFor(() =>
        expect(dialog.current).toEqual({
          kind: "upgrade",
          plan,
          feature: "pageTranslation",
          analyticsFeature: "page_translation",
          trigger: "user",
          retry: expect.any(Function),
        }),
      )

      // "Use machine translation" switched the config, then retries.
      mockGetLocalConfig.mockResolvedValue(GOOGLE_CONFIG)
      dialog.current!.retry!()
      await vi.waitFor(() => expect(manager.isActive).toBe(true))
    },
  )

  it("keeps Ultra to a plain toast: no plan sits above it", async () => {
    refusal = SPENT_POOL_REFUSAL
    mockGetBuiltInAiUpgradePlan.mockResolvedValue(null)

    const manager = createManager()
    await manager.start(popupClick())

    expect(dialog.current).toBeNull()
    expect(mockToastAdd).toHaveBeenCalledWith({
      type: "error",
      title: "hostedAi.availability.quotaExhausted",
    })
    expect(shownEvents()).toEqual([])
  })

  it("gives automatic translation the dialog once a browser session, then the toast", async () => {
    refusal = SPENT_POOL_REFUSAL

    const firstPage = createManager()
    await firstPage.start(automaticStart())

    await vi.waitFor(() => expect(dialog.current).toMatchObject({ kind: "upgrade", plan: "free" }))
    expect(mockClaimAutoPrompt).toHaveBeenCalledOnce()
    expect(refusalToasts()).toEqual([])

    // The background has handed out this session's dialog.
    closeBuiltInAiPrompt()
    mockClaimAutoPrompt.mockResolvedValue(false)
    const secondPage = createManager()
    await secondPage.start(automaticStart())

    expect(dialog.current).toBeNull()
    expect(refusalToasts()).toEqual([
      expect.objectContaining({
        title: "hostedAi.availability.quotaExhausted",
        actionProps: expect.objectContaining({ children: "action.upgrade" }),
      }),
    ])
    expect(shownEvents()).toEqual([
      { feature: "page_translation", kind: "upgrade", presentation: "dialog", trigger: "auto" },
      { feature: "page_translation", kind: "upgrade", presentation: "toast", trigger: "auto" },
    ])
  })

  it.each([
    ["a guest", GUEST_REFUSAL],
    ["a spent pool", SPENT_POOL_REFUSAL],
  ])("leaves a click in a frame to the top frame for %s", async (_, frameRefusal) => {
    refusal = frameRefusal
    inFrame()

    const manager = createManager()
    await manager.start(popupClick())

    expect(manager.isActive).toBe(false)
    expect(mockGetBuiltInAiUpgradePlan).not.toHaveBeenCalled()
    expect(dialog.current).toBeNull()
    expect(mockToastAdd).not.toHaveBeenCalled()
  })

  it("keeps automatic translation in a frame to a plain toast", async () => {
    refusal = SPENT_POOL_REFUSAL
    inFrame()

    const manager = createManager()
    await manager.start(automaticStart())

    expect(mockClaimAutoPrompt).not.toHaveBeenCalled()
    expect(dialog.current).toBeNull()
    expect(mockToastAdd).toHaveBeenCalledWith({
      type: "error",
      title: "hostedAi.availability.quotaExhausted",
    })
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

    expect(dialog.current).toBeNull()
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

    const failures = [
      new Error("Failed"),
      Object.assign(new Error("x"), { code: "HOSTED_AI_MODEL_UNAVAILABLE" }),
      // A guest reaches here only if the status check let them through; their
      // paragraphs keep the inline error rather than a dialog per page.
      Object.assign(new Error("x"), { code: "UNAUTHORIZED" }),
    ]
    failures.forEach(reportPageTranslationRequestFailed)
    await flushAsync()

    expect(mockGetBuiltInAiUpgradePlan).not.toHaveBeenCalled()
    expect(dialog.current).toBeNull()
    expect(failures.some(isPageTranslationRequestFailureClaimed)).toBe(false)
  })

  it("asks to upgrade once, however many paragraphs run dry, and answers for all of them", async () => {
    await startSession()

    const failures = [spentPoolError(), spentPoolError(), spentPoolError()]
    reportPageTranslationRequestFailed(failures[0])
    reportPageTranslationRequestFailed(failures[1])
    await vi.waitFor(() => expect(dialog.current).not.toBeNull())
    reportPageTranslationRequestFailed(failures[2])
    await flushAsync()

    expect(mockGetBuiltInAiUpgradePlan).toHaveBeenCalledOnce()
    expect(dialog.current).toEqual({
      kind: "upgrade",
      plan: "free",
      feature: "pageTranslation",
      analyticsFeature: "page_translation",
      trigger: "user",
      retry: expect.any(Function),
    })
    expect(mockToastAdd).not.toHaveBeenCalled()
    expect(shownEvents()).toHaveLength(1)
    // Hover translation stays quiet about the failures the session answered for.
    expect(failures.every(isPageTranslationRequestFailureClaimed)).toBe(true)
  })

  it("starts the page over when someone switches to machine translation", async () => {
    const manager = await startSession()
    const firstSessionId = getPageTranslationSessionId()

    reportPageTranslationRequestFailed(spentPoolError())
    await vi.waitFor(() => expect(dialog.current).not.toBeNull())

    // The dialog switched the config to the machine translator, then retries.
    mockGetLocalConfig.mockResolvedValue(GOOGLE_CONFIG)
    mockSendMessage.mockClear()
    mockCheckProviderAvailability.mockClear()
    dialog.current!.retry!()

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

  it("gives automatic translation the session's dialog if it is still unclaimed", async () => {
    await startSession(automaticStart())

    reportPageTranslationRequestFailed(spentPoolError())

    await vi.waitFor(() => expect(dialog.current).toMatchObject({ kind: "upgrade" }))
    expect(mockClaimAutoPrompt).toHaveBeenCalledOnce()
    expect(shownEvents()).toEqual([
      { feature: "page_translation", kind: "upgrade", presentation: "dialog", trigger: "auto" },
    ])
  })

  it("gives automatic translation the toast once the session's dialog is used", async () => {
    mockClaimAutoPrompt.mockResolvedValue(false)
    await startSession(automaticStart())

    reportPageTranslationRequestFailed(spentPoolError())
    reportPageTranslationRequestFailed(spentPoolError())
    await vi.waitFor(() => expect(refusalToasts()).toHaveLength(1))
    await flushAsync()

    expect(dialog.current).toBeNull()
    expect(refusalToasts()).toHaveLength(1)
    expect(shownEvents()).toEqual([
      { feature: "page_translation", kind: "upgrade", presentation: "toast", trigger: "auto" },
    ])
  })

  it("leaves a frame to its inline errors", async () => {
    inFrame()
    await startSession()

    const failure = spentPoolError()
    reportPageTranslationRequestFailed(failure)
    await flushAsync()

    expect(mockGetBuiltInAiUpgradePlan).not.toHaveBeenCalled()
    expect(dialog.current).toBeNull()
    expect(isPageTranslationRequestFailureClaimed(failure)).toBe(false)
  })

  it("leaves Ultra to its inline errors, and reads the plan only once", async () => {
    mockGetBuiltInAiUpgradePlan.mockResolvedValue(null)
    await startSession()

    reportPageTranslationRequestFailed(spentPoolError())
    await flushAsync()
    reportPageTranslationRequestFailed(spentPoolError())
    await flushAsync()

    expect(mockGetBuiltInAiUpgradePlan).toHaveBeenCalledOnce()
    expect(dialog.current).toBeNull()
    expect(mockToastAdd).not.toHaveBeenCalled()
  })

  it("stops listening when the session stops", async () => {
    const manager = await startSession()
    manager.stop()

    reportPageTranslationRequestFailed(spentPoolError())
    await flushAsync()

    expect(mockGetBuiltInAiUpgradePlan).not.toHaveBeenCalled()
    expect(dialog.current).toBeNull()
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

    expect(dialog.current).toBeNull()
  })
})
