// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext } from "@/utils/analytics"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { DEFAULT_BUILT_IN_AI_PROVIDER_ID } from "@/utils/constants/provider-ids"
import { GOOGLE_TRANSLATE_PROVIDER_ID } from "@/utils/constants/providers"
import { PageTranslationManager } from "../page-translation"

const {
  mockCheckProviderAvailability,
  mockGetLocalConfig,
  mockIsGuideStepUrl,
  mockOpenGuestSignInPrompt,
  mockSendMessage,
  mockToastAdd,
  mockValidateTranslationConfigAndToast,
} = vi.hoisted(() => ({
  mockCheckProviderAvailability: vi.fn<(...args: any[]) => any>(),
  mockGetLocalConfig: vi.fn<(...args: any[]) => any>(),
  mockIsGuideStepUrl: vi.fn<(url: string) => boolean>(),
  mockOpenGuestSignInPrompt: vi.fn<(...args: any[]) => any>(),
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

vi.mock("@/utils/content-runtime/guest-sign-in-prompt", () => ({
  openGuestSignInPrompt: mockOpenGuestSignInPrompt,
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

const GUEST_REFUSAL = {
  available: false,
  message: "hostedAi.availability.authenticationRequired",
  reason: "authentication_required",
}

function popupClick() {
  return createFeatureUsageContext(ANALYTICS_FEATURE.PAGE_TRANSLATION, ANALYTICS_SURFACE.POPUP)
}

describe("page translation for a guest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = "<main>Article body</main>"
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)

    mockGetLocalConfig.mockResolvedValue(BUILT_IN_AI_CONFIG)
    mockIsGuideStepUrl.mockReturnValue(false)
    mockValidateTranslationConfigAndToast.mockReturnValue(true)
    mockSendMessage.mockImplementation(async (type: string) =>
      type === "getFreeTranslateProviderId" ? GOOGLE_TRANSLATE_PROVIDER_ID : undefined,
    )
    mockCheckProviderAvailability.mockImplementation(async (provider: { id: string }) =>
      provider.id === DEFAULT_BUILT_IN_AI_PROVIDER_ID
        ? GUEST_REFUSAL
        : { available: true, providerRef: { kind: "local", config: provider } },
    )
  })

  it("asks a guest who clicks translate to log in, and runs again after a switch", async () => {
    const manager = new PageTranslationManager()
    await manager.start(popupClick())

    expect(manager.isActive).toBe(false)
    expect(mockToastAdd).not.toHaveBeenCalled()
    expect(mockOpenGuestSignInPrompt).toHaveBeenCalledWith({
      feature: "pageTranslation",
      retry: expect.any(Function),
    })

    // The dialog switched the config to the machine translator, then retries.
    mockGetLocalConfig.mockResolvedValue({
      ...DEFAULT_CONFIG,
      pageTranslation: {
        ...DEFAULT_CONFIG.pageTranslation,
        providerId: GOOGLE_TRANSLATE_PROVIDER_ID,
      },
    })
    mockOpenGuestSignInPrompt.mock.calls[0]![0].retry()
    await vi.waitFor(() => expect(manager.isActive).toBe(true))

    manager.stop()
  })

  it("keeps automatic translation to a toast", async () => {
    const manager = new PageTranslationManager()
    await manager.start(
      createFeatureUsageContext(ANALYTICS_FEATURE.PAGE_TRANSLATION, ANALYTICS_SURFACE.PAGE_AUTO),
    )

    expect(mockOpenGuestSignInPrompt).not.toHaveBeenCalled()
    expect(mockToastAdd).toHaveBeenCalledWith({
      type: "error",
      title: "hostedAi.availability.authenticationRequired",
    })
  })

  it("translates the website's guide with the free provider and leaves the config alone", async () => {
    mockIsGuideStepUrl.mockReturnValue(true)

    const manager = new PageTranslationManager()
    await manager.start(popupClick())

    expect(manager.isActive).toBe(true)
    expect(mockOpenGuestSignInPrompt).not.toHaveBeenCalled()
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
    expect(mockOpenGuestSignInPrompt).toHaveBeenCalledTimes(1)
  })
})
