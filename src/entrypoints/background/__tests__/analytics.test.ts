import type { FeatureUsageCache } from "../analytics-feature-cache"
import type { FeatureUsedEventProperties } from "@/types/analytics"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  createBackgroundAnalytics,
  filterAnalyticsCaptureResult,
  resolveDistinctIdOverride,
} from "../analytics"

type RegisteredMessageHandler = (message: { data: FeatureUsedEventProperties }) => Promise<void>

describe("background analytics", () => {
  let onMessageMock: ReturnType<typeof vi.fn>
  let storageGetItemMock: ReturnType<typeof vi.fn>
  let storageSetItemMock: ReturnType<typeof vi.fn>
  let getTargetLanguageMock: ReturnType<typeof vi.fn>
  let posthogInitMock: ReturnType<typeof vi.fn>
  let posthogCaptureMock: ReturnType<typeof vi.fn>
  let posthogRegisterMock: ReturnType<typeof vi.fn>
  let loggerWarnMock: ReturnType<typeof vi.fn>

  function getRegisteredMessageHandler(name: string) {
    const registration = onMessageMock.mock.calls.find((call) => call[0] === name)
    if (!registration) {
      throw new Error(`Message handler not registered: ${name}`)
    }

    return registration[1] as RegisteredMessageHandler
  }

  function createAnalytics(overrides?: {
    apiHost?: string
    apiKey?: string
    defaultAnalyticsEnabled?: boolean
    distinctIdOverride?: string
    featureUsageCache?: FeatureUsageCache
    getCurrentDate?: () => Date
  }) {
    const apiHost =
      overrides && "apiHost" in overrides ? overrides.apiHost : "https://us.i.posthog.com"
    const apiKey = overrides && "apiKey" in overrides ? overrides.apiKey : "phc_test"

    return createBackgroundAnalytics({
      apiHost,
      apiKey,
      createDistinctId: () => "generated-install-id",
      defaultAnalyticsEnabled: overrides?.defaultAnalyticsEnabled ?? true,
      distinctIdOverride: overrides?.distinctIdOverride,
      extensionVersion: "1.0.0",
      featureUsageCache: overrides?.featureUsageCache,
      getCurrentDate: overrides?.getCurrentDate ?? (() => new Date("2026-07-14T12:00:00.000Z")),
      getStorageItem: storageGetItemMock as (key: string) => Promise<unknown>,
      getTargetLanguage: getTargetLanguageMock as () => Promise<"cmn" | undefined>,
      onMessage: onMessageMock as (
        type: "trackFeatureUsedEvent",
        handler: RegisteredMessageHandler,
      ) => unknown,
      posthog: {
        init: posthogInitMock as (token: string, config: Record<string, unknown>) => void,
        capture: posthogCaptureMock as (
          eventName: string,
          properties: FeatureUsedEventProperties,
        ) => void,
        register: posthogRegisterMock as (properties: { extension_version: string }) => void,
      },
      setStorageItem: storageSetItemMock as (key: string, value: unknown) => Promise<void>,
      warn: loggerWarnMock as (...args: any[]) => void,
    })
  }

  function mockEnabledAnalyticsStorage() {
    storageGetItemMock.mockImplementation(async (key: string) => {
      if (key === "local:analyticsEnabled") {
        return true
      }
      if (key === "local:analyticsInstallId") {
        return "install-123"
      }
      return undefined
    })
  }

  function createMemoryFeatureUsageCache() {
    const lastReportedDays = new Map<string, string>()
    const cache: FeatureUsageCache = {
      getLastReportedDay: vi.fn<FeatureUsageCache["getLastReportedDay"]>(async (feature) =>
        lastReportedDays.get(feature),
      ),
      setLastReportedDay: vi.fn<FeatureUsageCache["setLastReportedDay"]>(async (feature, day) => {
        lastReportedDays.set(feature, day)
      }),
    }

    return { cache, lastReportedDays }
  }

  beforeEach(() => {
    onMessageMock = vi.fn<(...args: any[]) => any>()
    storageGetItemMock = vi.fn<(...args: any[]) => any>()
    storageSetItemMock = vi.fn<(...args: any[]) => any>()
    getTargetLanguageMock = vi.fn<(...args: any[]) => any>().mockResolvedValue("cmn")
    posthogInitMock = vi.fn<(...args: any[]) => any>()
    posthogCaptureMock = vi.fn<(...args: any[]) => any>()
    posthogRegisterMock = vi.fn<(...args: any[]) => any>()
    loggerWarnMock = vi.fn<(...args: any[]) => any>()
  })

  it("registers a handler that initializes PostHog with the shared anonymous distinct ID", async () => {
    storageGetItemMock.mockResolvedValueOnce(true).mockResolvedValueOnce("install-123")

    const { setupAnalyticsMessageHandlers } = createAnalytics()
    setupAnalyticsMessageHandlers()

    const handler = getRegisteredMessageHandler("trackFeatureUsedEvent")
    await handler({
      data: {
        feature: "page_translation",
        surface: "popup",
        outcome: "success",
        latency_ms: 1_500,
      },
    })

    expect(posthogInitMock).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({
        api_host: "https://us.i.posthog.com",
        autocapture: false,
        before_send: expect.any(Function),
        save_campaign_params: false,
        save_referrer: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_external_dependency_loading: true,
        disable_session_recording: true,
        advanced_disable_flags: true,
        person_profiles: "never",
        persistence: "memory",
        respect_dnt: true,
        bootstrap: {
          distinctID: "install-123",
        },
      }),
    )
    expect(posthogRegisterMock).toHaveBeenCalledWith({
      extension_version: "1.0.0",
    })
    expect(posthogCaptureMock).toHaveBeenCalledWith("feature_used", {
      feature: "page_translation",
      surface: "popup",
      outcome: "success",
      latency_ms: 1_500,
      target_language: "cmn",
    })
    expect(storageSetItemMock).not.toHaveBeenCalled()
  })

  it("adds the configured target language to non-translation feature events", async () => {
    storageGetItemMock.mockResolvedValueOnce(true).mockResolvedValueOnce("install-123")

    const { captureFeatureUsedEventInBackground } = createAnalytics()
    await captureFeatureUsedEventInBackground({
      feature: "text_to_speech",
      surface: "tts_settings",
      outcome: "success",
      latency_ms: 100,
    })

    expect(posthogCaptureMock).toHaveBeenCalledWith("feature_used", {
      feature: "text_to_speech",
      surface: "tts_settings",
      outcome: "success",
      latency_ms: 100,
      target_language: "cmn",
    })
  })

  it("keeps reporting repeated feature events when no cache is configured", async () => {
    mockEnabledAnalyticsStorage()
    const { captureFeatureUsedEventInBackground } = createAnalytics()
    const properties: FeatureUsedEventProperties = {
      feature: "page_translation",
      surface: "popup",
      outcome: "success",
      latency_ms: 100,
    }

    await captureFeatureUsedEventInBackground(properties)
    await captureFeatureUsedEventInBackground(properties)

    expect(posthogCaptureMock).toHaveBeenCalledTimes(2)
  })

  it("reports only the first event for a feature each Shanghai day", async () => {
    mockEnabledAnalyticsStorage()
    const { cache } = createMemoryFeatureUsageCache()
    const { captureFeatureUsedEventInBackground } = createAnalytics({
      featureUsageCache: cache,
    })

    await captureFeatureUsedEventInBackground({
      feature: "custom_ai_action",
      surface: "context_menu",
      outcome: "failure",
      latency_ms: 100,
      action_id: "dictionary",
      action_name: "Dictionary",
    })
    await captureFeatureUsedEventInBackground({
      feature: "custom_ai_action",
      surface: "selection_toolbar",
      outcome: "success",
      latency_ms: 200,
      action_id: "explain",
      action_name: "Explain",
    })

    expect(posthogCaptureMock).toHaveBeenCalledOnce()
    expect(posthogCaptureMock).toHaveBeenCalledWith("feature_used", {
      feature: "custom_ai_action",
      surface: "context_menu",
      outcome: "failure",
      latency_ms: 100,
      action_id: "dictionary",
      action_name: "Dictionary",
      target_language: "cmn",
    })
    expect(cache.setLastReportedDay).toHaveBeenCalledOnce()
  })

  it("reports different features independently on the same day", async () => {
    mockEnabledAnalyticsStorage()
    const { cache } = createMemoryFeatureUsageCache()
    const { captureFeatureUsedEventInBackground } = createAnalytics({
      featureUsageCache: cache,
    })

    await captureFeatureUsedEventInBackground({
      feature: "page_translation",
      surface: "popup",
      outcome: "success",
      latency_ms: 100,
    })
    await captureFeatureUsedEventInBackground({
      feature: "text_to_speech",
      surface: "tts_settings",
      outcome: "success",
      latency_ms: 200,
    })

    expect(posthogCaptureMock).toHaveBeenCalledTimes(2)
    expect(cache.setLastReportedDay).toHaveBeenCalledTimes(2)
  })

  it("records every save-suggestion funnel step on the same day, bypassing the daily cache", async () => {
    mockEnabledAnalyticsStorage()
    const { cache } = createMemoryFeatureUsageCache()
    const { captureFeatureUsedEventInBackground } = createAnalytics({
      featureUsageCache: cache,
    })

    await captureFeatureUsedEventInBackground({
      feature: "save_suggestion",
      surface: "selection_toolbar",
      outcome: "success",
      latency_ms: 100,
      action_id: "suggestion_shown",
    })
    await captureFeatureUsedEventInBackground({
      feature: "save_suggestion",
      surface: "selection_toolbar",
      outcome: "success",
      latency_ms: 200,
      action_id: "suggestion_accepted",
    })

    // Both funnel steps captured; the daily cache is never consulted for them.
    expect(posthogCaptureMock).toHaveBeenCalledTimes(2)
    expect(cache.getLastReportedDay).not.toHaveBeenCalled()
    expect(cache.setLastReportedDay).not.toHaveBeenCalled()
  })

  it("reports a feature again after the Shanghai calendar day changes", async () => {
    mockEnabledAnalyticsStorage()
    const { cache } = createMemoryFeatureUsageCache()
    let currentDate = new Date("2026-07-13T15:59:59.999Z")
    const { captureFeatureUsedEventInBackground } = createAnalytics({
      featureUsageCache: cache,
      getCurrentDate: () => currentDate,
    })
    const properties: FeatureUsedEventProperties = {
      feature: "page_translation",
      surface: "popup",
      outcome: "success",
      latency_ms: 100,
    }

    await captureFeatureUsedEventInBackground(properties)
    await captureFeatureUsedEventInBackground(properties)
    currentDate = new Date("2026-07-13T16:00:00.000Z")
    await captureFeatureUsedEventInBackground(properties)

    expect(posthogCaptureMock).toHaveBeenCalledTimes(2)
    expect(cache.setLastReportedDay).toHaveBeenNthCalledWith(1, "page_translation", "2026-07-13")
    expect(cache.setLastReportedDay).toHaveBeenNthCalledWith(2, "page_translation", "2026-07-14")
  })

  it("serializes concurrent events for the same feature", async () => {
    mockEnabledAnalyticsStorage()
    const { cache } = createMemoryFeatureUsageCache()
    const { captureFeatureUsedEventInBackground } = createAnalytics({
      featureUsageCache: cache,
    })
    const properties: FeatureUsedEventProperties = {
      feature: "page_translation",
      surface: "popup",
      outcome: "success",
      latency_ms: 100,
    }

    await Promise.all([
      captureFeatureUsedEventInBackground(properties),
      captureFeatureUsedEventInBackground(properties),
    ])

    expect(posthogCaptureMock).toHaveBeenCalledOnce()
    expect(cache.getLastReportedDay).toHaveBeenCalledTimes(2)
    expect(cache.setLastReportedDay).toHaveBeenCalledOnce()
  })

  it("uses persisted cache state after background analytics is recreated", async () => {
    mockEnabledAnalyticsStorage()
    const { cache } = createMemoryFeatureUsageCache()
    const properties: FeatureUsedEventProperties = {
      feature: "page_translation",
      surface: "popup",
      outcome: "success",
      latency_ms: 100,
    }

    await createAnalytics({ featureUsageCache: cache }).captureFeatureUsedEventInBackground(
      properties,
    )
    await createAnalytics({ featureUsageCache: cache }).captureFeatureUsedEventInBackground(
      properties,
    )

    expect(posthogCaptureMock).toHaveBeenCalledOnce()
  })

  it("continues reporting when the feature cache cannot be read", async () => {
    mockEnabledAnalyticsStorage()
    const featureUsageCache: FeatureUsageCache = {
      getLastReportedDay: vi
        .fn<FeatureUsageCache["getLastReportedDay"]>()
        .mockRejectedValue(new Error("read failed")),
      setLastReportedDay: vi
        .fn<FeatureUsageCache["setLastReportedDay"]>()
        .mockResolvedValue(undefined),
    }
    const { captureFeatureUsedEventInBackground } = createAnalytics({ featureUsageCache })

    await captureFeatureUsedEventInBackground({
      feature: "page_translation",
      surface: "popup",
      outcome: "success",
      latency_ms: 100,
    })

    expect(posthogCaptureMock).toHaveBeenCalledOnce()
    expect(featureUsageCache.setLastReportedDay).toHaveBeenCalledOnce()
    expect(loggerWarnMock).toHaveBeenCalledWith(
      "[Analytics] Failed to read the daily feature usage cache",
      expect.any(Error),
    )
  })

  it("keeps a captured event when the feature cache cannot be written", async () => {
    mockEnabledAnalyticsStorage()
    const featureUsageCache: FeatureUsageCache = {
      getLastReportedDay: vi
        .fn<FeatureUsageCache["getLastReportedDay"]>()
        .mockResolvedValue(undefined),
      setLastReportedDay: vi
        .fn<FeatureUsageCache["setLastReportedDay"]>()
        .mockRejectedValue(new Error("write failed")),
    }
    const { captureFeatureUsedEventInBackground } = createAnalytics({ featureUsageCache })

    await captureFeatureUsedEventInBackground({
      feature: "page_translation",
      surface: "popup",
      outcome: "success",
      latency_ms: 100,
    })

    expect(posthogCaptureMock).toHaveBeenCalledOnce()
    expect(loggerWarnMock).toHaveBeenCalledWith(
      "[Analytics] Failed to write the daily feature usage cache",
      expect.any(Error),
    )
  })

  it("does not cache a feature when capture fails", async () => {
    mockEnabledAnalyticsStorage()
    const { cache } = createMemoryFeatureUsageCache()
    posthogCaptureMock.mockImplementationOnce(() => {
      throw new Error("capture failed")
    })
    const { captureFeatureUsedEventInBackground } = createAnalytics({
      featureUsageCache: cache,
    })
    const properties: FeatureUsedEventProperties = {
      feature: "page_translation",
      surface: "popup",
      outcome: "success",
      latency_ms: 100,
    }

    await captureFeatureUsedEventInBackground(properties)
    await captureFeatureUsedEventInBackground(properties)

    expect(posthogCaptureMock).toHaveBeenCalledTimes(2)
    expect(cache.setLastReportedDay).toHaveBeenCalledOnce()
  })

  it("does not initialize PostHog when analytics is disabled", async () => {
    storageGetItemMock.mockResolvedValueOnce(false)

    const { captureFeatureUsedEventInBackground } = createAnalytics()
    await captureFeatureUsedEventInBackground({
      feature: "page_translation",
      surface: "popup",
      outcome: "success",
      latency_ms: 1_500,
    })

    expect(posthogInitMock).not.toHaveBeenCalled()
    expect(posthogCaptureMock).not.toHaveBeenCalled()
  })

  it("does not write feature cache state when analytics is disabled", async () => {
    storageGetItemMock.mockResolvedValueOnce(false)
    const { cache } = createMemoryFeatureUsageCache()
    const { captureFeatureUsedEventInBackground } = createAnalytics({
      featureUsageCache: cache,
    })

    await captureFeatureUsedEventInBackground({
      feature: "page_translation",
      surface: "popup",
      outcome: "success",
      latency_ms: 100,
    })

    expect(cache.getLastReportedDay).not.toHaveBeenCalled()
    expect(cache.setLastReportedDay).not.toHaveBeenCalled()
  })

  it("uses the runtime default when the preference has not been stored yet", async () => {
    storageGetItemMock.mockResolvedValueOnce(undefined)

    const { captureFeatureUsedEventInBackground } = createAnalytics({
      defaultAnalyticsEnabled: false,
    })
    await captureFeatureUsedEventInBackground({
      feature: "page_translation",
      surface: "popup",
      outcome: "success",
      latency_ms: 100,
    })

    expect(posthogInitMock).not.toHaveBeenCalled()
    expect(posthogCaptureMock).not.toHaveBeenCalled()
  })

  it("creates and persists a new anonymous distinct ID when one does not exist", async () => {
    storageGetItemMock.mockResolvedValueOnce(true).mockResolvedValueOnce(null)

    const { captureFeatureUsedEventInBackground } = createAnalytics()
    await captureFeatureUsedEventInBackground({
      feature: "page_translation",
      surface: "popup",
      outcome: "success",
      latency_ms: 100,
    })

    expect(storageSetItemMock).toHaveBeenCalledWith(
      "local:analyticsInstallId",
      "generated-install-id",
    )
  })

  it("uses the dev default test UUID when no explicit override is configured", () => {
    expect(resolveDistinctIdOverride("   ", true)).toBe("00000000-0000-0000-0000-000000000001")
  })

  it("prefers an explicit test UUID over the dev default", () => {
    expect(resolveDistinctIdOverride("11111111-1111-1111-1111-111111111111", true)).toBe(
      "11111111-1111-1111-1111-111111111111",
    )
  })

  it("falls back to undefined outside dev mode when no override is configured", () => {
    expect(resolveDistinctIdOverride("   ", false)).toBeUndefined()
  })

  it("uses the test UUID override without touching install ID storage", async () => {
    storageGetItemMock.mockResolvedValueOnce(true)

    const { captureFeatureUsedEventInBackground } = createAnalytics({
      distinctIdOverride: "00000000-0000-0000-0000-000000000001",
    })
    await captureFeatureUsedEventInBackground({
      feature: "page_translation",
      surface: "popup",
      outcome: "success",
      latency_ms: 100,
    })

    expect(posthogInitMock).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({
        bootstrap: {
          distinctID: "00000000-0000-0000-0000-000000000001",
        },
      }),
    )
    expect(storageSetItemMock).not.toHaveBeenCalled()
  })

  it("treats blank distinct ID overrides as unset", async () => {
    storageGetItemMock.mockResolvedValueOnce(true).mockResolvedValueOnce("install-123")

    const { captureFeatureUsedEventInBackground } = createAnalytics({
      distinctIdOverride: "   ",
    })
    await captureFeatureUsedEventInBackground({
      feature: "page_translation",
      surface: "popup",
      outcome: "success",
      latency_ms: 100,
    })

    expect(posthogInitMock).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({
        bootstrap: {
          distinctID: "install-123",
        },
      }),
    )
    expect(storageSetItemMock).not.toHaveBeenCalled()
  })

  it("warns and no-ops when PostHog env configuration is missing", async () => {
    storageGetItemMock.mockResolvedValueOnce(true)
    const { cache } = createMemoryFeatureUsageCache()

    const { captureFeatureUsedEventInBackground } = createAnalytics({
      apiHost: undefined,
      apiKey: undefined,
      featureUsageCache: cache,
    })
    await captureFeatureUsedEventInBackground({
      feature: "page_translation",
      surface: "popup",
      outcome: "failure",
      latency_ms: 42,
    })

    expect(posthogInitMock).not.toHaveBeenCalled()
    expect(posthogCaptureMock).not.toHaveBeenCalled()
    expect(cache.setLastReportedDay).not.toHaveBeenCalled()
    expect(loggerWarnMock).toHaveBeenCalledOnce()
  })

  it("filters PostHog properties down to the allowlist", () => {
    expect(
      filterAnalyticsCaptureResult({
        event: "feature_used",
        properties: {
          token: "phc_test",
          distinct_id: "install-123",
          feature: "custom_ai_action",
          surface: "context_menu",
          outcome: "success",
          latency_ms: 250,
          action_id: "dictionary",
          action_name: "Dictionary",
          target_language: "cmn",
          $browser: "Chrome",
          $browser_version: "145.0.0.0",
          $insert_id: "insert-123",
          $time: 1234,
          $lib: "web",
          $lib_version: "1.360.2",
          $process_person_profile: false,
          extension_version: "1.0.0",
          $current_url: "chrome-extension://abc/background.js",
          $raw_user_agent: "Mozilla/5.0",
          $timezone: "America/Vancouver",
        },
        timestamp: new Date("2026-03-16T19:02:43.960Z"),
        uuid: "test-uuid",
      }).properties,
    ).toEqual({
      token: "phc_test",
      distinct_id: "install-123",
      feature: "custom_ai_action",
      surface: "context_menu",
      outcome: "success",
      latency_ms: 250,
      action_id: "dictionary",
      action_name: "Dictionary",
      target_language: "cmn",
      $browser: "Chrome",
      $browser_version: "145.0.0.0",
      $insert_id: "insert-123",
      $time: 1234,
      $lib: "web",
      $lib_version: "1.360.2",
      $process_person_profile: false,
      extension_version: "1.0.0",
    })
  })
})
