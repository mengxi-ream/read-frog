import type { CaptureResult, PostHog } from "posthog-js/dist/module.no-external"
import type { FeatureUsageCache } from "../analytics-feature-cache"
import type {
  FeatureUsedEventProperties,
  PromptExperimentCohort,
  TranslationActionContext,
  TranslationRequestedInput,
} from "@/types/analytics"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PROMPT_EXPERIMENT_FLAG_WAIT_MS } from "@/utils/constants/analytics"
import {
  createBackgroundAnalytics,
  filterAnalyticsCaptureResult,
  resolveDistinctIdOverride,
} from "../analytics"

type MessageHandler<TData, TResult = void> = (message: {
  data: TData
}) => TResult | Promise<TResult>

type PostHogCaptureMock = (...args: Parameters<PostHog["capture"]>) => void
type PostHogInitMock = (...args: Parameters<PostHog["init"]>) => void
type PostHogRegisterMock = (...args: Parameters<PostHog["register"]>) => void

const DEFAULT_FEATURE_PROVIDER = {
  provider: "openai",
  backend_kind: "llm",
} as const

describe("background analytics", () => {
  let trackFeatureUsedEventHandler: MessageHandler<FeatureUsedEventProperties> | undefined
  let trackTranslationRequestedEventHandler: MessageHandler<TranslationRequestedInput> | undefined
  let storageGetItemMock = vi.fn<(key: string) => Promise<unknown>>()
  let storageSetItemMock = vi.fn<(key: string, value: unknown) => Promise<void>>()
  let getTargetLanguageMock = vi.fn<() => Promise<"cmn" | undefined>>()
  let posthogInitMock = vi.fn<PostHogInitMock>()
  let posthogCaptureMock = vi.fn<PostHogCaptureMock>()
  let posthogRegisterMock = vi.fn<PostHogRegisterMock>()
  let posthogGetFeatureFlagMock = vi.fn<PostHog["getFeatureFlag"]>()
  let posthogOnFeatureFlagsMock = vi.fn<PostHog["onFeatureFlags"]>()
  let loggerWarnMock = vi.fn<(...args: unknown[]) => void>()

  function requireMessageHandler<TData>(
    handler: MessageHandler<TData> | undefined,
    name: string,
  ): MessageHandler<TData> {
    if (!handler) throw new Error(`Message handler not registered: ${name}`)
    return handler
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
      getStorageItem: storageGetItemMock,
      getTargetLanguage: getTargetLanguageMock,
      messageRegistrar: {
        registerClearPromptExperimentAction() {},
        registerExposePromptExperiment() {},
        registerResolvePromptExperimentVariant() {},
        registerTrackFeatureUsedEvent(handler) {
          trackFeatureUsedEventHandler = handler
        },
        registerTrackTranslationRequestedEvent(handler) {
          trackTranslationRequestedEventHandler = handler
        },
      },
      posthog: {
        init: posthogInitMock,
        capture: posthogCaptureMock,
        register: posthogRegisterMock,
        getFeatureFlag: posthogGetFeatureFlagMock,
        onFeatureFlags: posthogOnFeatureFlagsMock,
      },
      setStorageItem: storageSetItemMock,
      warn: (...args) => loggerWarnMock(...args),
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

  function useMemoryStorage(initial: Record<string, unknown>) {
    const values = new Map(Object.entries(initial))
    storageGetItemMock.mockImplementation(async (key: string) => values.get(key))
    storageSetItemMock.mockImplementation(async (key: string, value: unknown) => {
      values.set(key, value)
    })
    return values
  }

  beforeEach(() => {
    vi.useRealTimers()
    trackFeatureUsedEventHandler = undefined
    trackTranslationRequestedEventHandler = undefined
    storageGetItemMock = vi.fn<(key: string) => Promise<unknown>>()
    storageSetItemMock = vi
      .fn<(key: string, value: unknown) => Promise<void>>()
      .mockResolvedValue(undefined)
    getTargetLanguageMock = vi.fn<() => Promise<"cmn" | undefined>>().mockResolvedValue("cmn")
    posthogInitMock = vi.fn<PostHogInitMock>()
    posthogCaptureMock = vi.fn<PostHogCaptureMock>()
    posthogRegisterMock = vi.fn<PostHogRegisterMock>()
    posthogGetFeatureFlagMock = vi.fn<PostHog["getFeatureFlag"]>()
    posthogOnFeatureFlagsMock = vi
      .fn<PostHog["onFeatureFlags"]>()
      .mockImplementation((callback) => {
        callback([], {}, {})
        return vi.fn<() => void>()
      })
    loggerWarnMock = vi.fn<(...args: unknown[]) => void>()
  })

  it("registers a handler that initializes PostHog with the shared anonymous distinct ID", async () => {
    storageGetItemMock.mockResolvedValueOnce(true).mockResolvedValueOnce("install-123")

    const { setupAnalyticsMessageHandlers } = createAnalytics()
    setupAnalyticsMessageHandlers()

    const handler = requireMessageHandler(trackFeatureUsedEventHandler, "trackFeatureUsedEvent")
    await handler({
      data: {
        feature: "page_translation",
        surface: "popup",
        outcome: "success",
        latency_ms: 1_500,
        ...DEFAULT_FEATURE_PROVIDER,
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
        advanced_disable_flags: false,
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
      ...DEFAULT_FEATURE_PROVIDER,
      target_language: "cmn",
    })
    expect(storageSetItemMock).not.toHaveBeenCalled()
  })

  it("downgrades legacy feature messages without provider fields to unknown/unknown", async () => {
    storageGetItemMock.mockResolvedValueOnce(true).mockResolvedValueOnce("install-123")

    const { setupAnalyticsMessageHandlers } = createAnalytics()
    setupAnalyticsMessageHandlers()

    const handler = requireMessageHandler(trackFeatureUsedEventHandler, "trackFeatureUsedEvent")
    const legacyProperties = {
      feature: "page_translation",
      surface: "popup",
      outcome: "success",
      latency_ms: 250,
    } as unknown as FeatureUsedEventProperties

    await handler({ data: legacyProperties })

    expect(posthogCaptureMock).toHaveBeenCalledWith("feature_used", {
      ...legacyProperties,
      provider: "unknown",
      backend_kind: "unknown",
      target_language: "cmn",
    })
  })

  it("adds the configured target language to non-translation feature events", async () => {
    storageGetItemMock.mockResolvedValueOnce(true).mockResolvedValueOnce("install-123")

    const { captureFeatureUsedEventInBackground } = createAnalytics()
    await captureFeatureUsedEventInBackground({
      feature: "text_to_speech",
      surface: "tts_settings",
      outcome: "success",
      latency_ms: 100,
      ...DEFAULT_FEATURE_PROVIDER,
    })

    expect(posthogCaptureMock).toHaveBeenCalledWith("feature_used", {
      feature: "text_to_speech",
      surface: "tts_settings",
      outcome: "success",
      latency_ms: 100,
      ...DEFAULT_FEATURE_PROVIDER,
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
      ...DEFAULT_FEATURE_PROVIDER,
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
      ...DEFAULT_FEATURE_PROVIDER,
      action_id: "dictionary",
      action_name: "Dictionary",
    })
    await captureFeatureUsedEventInBackground({
      feature: "custom_ai_action",
      surface: "selection_toolbar",
      outcome: "success",
      latency_ms: 200,
      ...DEFAULT_FEATURE_PROVIDER,
      action_id: "explain",
      action_name: "Explain",
    })

    expect(posthogCaptureMock).toHaveBeenCalledOnce()
    expect(posthogCaptureMock).toHaveBeenCalledWith("feature_used", {
      feature: "custom_ai_action",
      surface: "context_menu",
      outcome: "failure",
      latency_ms: 100,
      ...DEFAULT_FEATURE_PROVIDER,
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
      ...DEFAULT_FEATURE_PROVIDER,
    })
    await captureFeatureUsedEventInBackground({
      feature: "text_to_speech",
      surface: "tts_settings",
      outcome: "success",
      latency_ms: 200,
      ...DEFAULT_FEATURE_PROVIDER,
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
      ...DEFAULT_FEATURE_PROVIDER,
      action_id: "suggestion_shown",
    })
    await captureFeatureUsedEventInBackground({
      feature: "save_suggestion",
      surface: "selection_toolbar",
      outcome: "success",
      latency_ms: 200,
      ...DEFAULT_FEATURE_PROVIDER,
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
      ...DEFAULT_FEATURE_PROVIDER,
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
      ...DEFAULT_FEATURE_PROVIDER,
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
      ...DEFAULT_FEATURE_PROVIDER,
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
      ...DEFAULT_FEATURE_PROVIDER,
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
      ...DEFAULT_FEATURE_PROVIDER,
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
      ...DEFAULT_FEATURE_PROVIDER,
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
      ...DEFAULT_FEATURE_PROVIDER,
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
      ...DEFAULT_FEATURE_PROVIDER,
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
      ...DEFAULT_FEATURE_PROVIDER,
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
      ...DEFAULT_FEATURE_PROVIDER,
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
      ...DEFAULT_FEATURE_PROVIDER,
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
      ...DEFAULT_FEATURE_PROVIDER,
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
      ...DEFAULT_FEATURE_PROVIDER,
    })

    expect(posthogInitMock).not.toHaveBeenCalled()
    expect(posthogCaptureMock).not.toHaveBeenCalled()
    expect(cache.setLastReportedDay).not.toHaveBeenCalled()
    expect(loggerWarnMock).toHaveBeenCalledOnce()
  })

  it("keeps new safe business properties and coarse runtime information by default", () => {
    const filtered = filterAnalyticsCaptureResult({
      event: "feature_used",
      properties: {
        token: "phc_test",
        distinct_id: "install-123",
        feature: "custom_ai_action",
        surface: "context_menu",
        outcome: "success",
        latency_ms: 250,
        ...DEFAULT_FEATURE_PROVIDER,
        new_safe_business_field: "automatically-kept",
        action_id: "dictionary",
        action_name: "Dictionary",
        target_language: "cmn",
        $browser: "Chrome",
        $browser_version: "145.0.0.0",
        $os: "Mac OS X",
        $os_version: "15.5",
        $device_type: "Desktop",
        $timezone: "America/Vancouver",
        $timezone_offset: 420,
        $browser_language: "en-US",
        $insert_id: "insert-123",
        $time: 1234,
        $lib: "web",
        $lib_version: "1.360.2",
        $process_person_profile: false,
        extension_version: "1.0.0",
        configured_prompt: "default",
        cohort: "new_user_prompt_experiment_v1",
        prompt_exposure_age: "d1_d7",
        $feature_flag: "new-user-default-translate-prompt-v1",
        $feature_flag_response: "control",
      },
      timestamp: new Date("2026-03-16T19:02:43.960Z"),
      uuid: "test-uuid",
    }).properties

    expect(filtered).toEqual({
      token: "phc_test",
      distinct_id: "install-123",
      feature: "custom_ai_action",
      surface: "context_menu",
      outcome: "success",
      latency_ms: 250,
      ...DEFAULT_FEATURE_PROVIDER,
      new_safe_business_field: "automatically-kept",
      action_id: "dictionary",
      action_name: "Dictionary",
      target_language: "cmn",
      $browser: "Chrome",
      $browser_version: "145.0.0.0",
      $os: "Mac OS X",
      $os_version: "15.5",
      $device_type: "Desktop",
      $timezone: "America/Vancouver",
      $timezone_offset: 420,
      $browser_language: "en-US",
      $insert_id: "insert-123",
      $time: 1234,
      $lib: "web",
      $lib_version: "1.360.2",
      $process_person_profile: false,
      extension_version: "1.0.0",
      configured_prompt: "default",
      cohort: "new_user_prompt_experiment_v1",
      prompt_exposure_age: "d1_d7",
      $feature_flag: "new-user-default-translate-prompt-v1",
      $feature_flag_response: "control",
    })
  })

  it("recursively removes sensitive, identifying, page, and SDK-internal properties", () => {
    const captureResult = {
      event: "feature_used",
      properties: {
        token: "phc_root_token_must_survive",
        distinct_id: "install-123",
        provider: "openai",
        backend_kind: "llm",
        $current_url: "https://private.example/path",
        page_url: "https://private.example/another-path",
        href: "https://private.example/link",
        $host: "private.example",
        $pathname: "/path",
        $referrer: "https://referrer.example",
        title: "Private page title",
        $raw_user_agent: "full user agent",
        $device: "Exact hardware model",
        $screen_width: 3_456,
        $viewport_height: 1_234,
        $device_id: "device-id",
        $session_id: "session-id",
        $window_id: "window-id",
        $pageview_id: "pageview-id",
        $initial_current_url: "https://private.example/initial",
        $prev_pageview_pathname: "/previous-private-path",
        $sdk_debug_retry_queue: ["debug"],
        $config_defaults: "2025-11-30",
        $lib_custom_api_host: "https://analytics.example",
        $active_feature_flags: ["flag-a"],
        $enabled_feature_flags: ["flag-a"],
        $feature_flag_payload: { private: true },
        model: "private-model",
        model_name: "another-private-model",
        prompt: "private prompt",
        system_prompt: "private system prompt",
        provider_options: { private: true },
        nested: {
          safe_nested_business_field: true,
          api_key: "secret-key",
          access_token: "secret-token",
          headers: { authorization: "Bearer secret" },
          rows: [
            {
              variant: "control",
              selection: "private selected text",
            },
          ],
        },
        $set: {
          safe_set_property: "kept",
          content: "private content",
        },
        $set_once: {
          safe_set_once_property: "kept",
          password: "private password",
        },
      },
      $set: {
        safe_top_level_set: "kept",
        base_url: "https://private-provider.example",
      },
      $set_once: {
        safe_top_level_set_once: "kept",
        instructions: "private instructions",
      },
      timestamp: new Date("2026-03-16T19:02:43.960Z"),
      uuid: "test-uuid",
    } as unknown as CaptureResult

    const filtered = filterAnalyticsCaptureResult(captureResult) as CaptureResult & {
      $set?: Record<string, unknown>
      $set_once?: Record<string, unknown>
    }

    expect(filtered.properties).toEqual({
      token: "phc_root_token_must_survive",
      distinct_id: "install-123",
      provider: "openai",
      backend_kind: "llm",
      nested: {
        safe_nested_business_field: true,
        rows: [{ variant: "control" }],
      },
      $set: { safe_set_property: "kept" },
      $set_once: { safe_set_once_property: "kept" },
    })
    expect(filtered.$set).toEqual({ safe_top_level_set: "kept" })
    expect(filtered.$set_once).toEqual({ safe_top_level_set_once: "kept" })
  })

  it("enrolls only an explicit fresh install marker without initializing PostHog", async () => {
    const values = useMemoryStorage({})
    const { enrollPromptExperimentInstall } = createAnalytics()

    await enrollPromptExperimentInstall()

    expect(values.get("local:promptExperimentCohortV1")).toEqual({
      cohort: "new_user_prompt_experiment_v1",
      installedAt: new Date("2026-07-14T12:00:00.000Z").getTime(),
      installVersion: "1.0.0",
    })
    expect(posthogInitMock).not.toHaveBeenCalled()
  })

  it("uses silent fresh lookup before native exposure and dedupes prompt use per action", async () => {
    const cohort: PromptExperimentCohort = {
      cohort: "new_user_prompt_experiment_v1",
      installedAt: new Date("2026-07-14T11:00:00.000Z").getTime(),
      installVersion: "1.0.0",
    }
    const values = useMemoryStorage({
      "local:analyticsEnabled": true,
      "local:analyticsInstallId": "install-123",
      "local:promptExperimentCohortV1": cohort,
    })
    posthogGetFeatureFlagMock.mockReturnValue("precision-rewrite")
    const analytics = createAnalytics()

    await expect(analytics.resolvePromptExperimentVariant("default")).resolves.toBe(
      "precision-rewrite",
    )
    expect(posthogGetFeatureFlagMock).toHaveBeenNthCalledWith(
      1,
      "new-user-default-translate-prompt-v1",
      { send_event: false, fresh: true },
    )

    const actionContext: TranslationActionContext = {
      actionId: "action-1",
      feature: "page_translation",
      surface: "popup",
    }
    await expect(
      analytics.exposePromptExperiment(actionContext, "precision-rewrite"),
    ).resolves.toBe(true)
    await analytics.exposePromptExperiment(actionContext, "precision-rewrite")

    expect(posthogGetFeatureFlagMock).toHaveBeenCalledWith("new-user-default-translate-prompt-v1")
    expect(
      posthogCaptureMock.mock.calls.filter(([event]) => event === "translation_prompt_used"),
    ).toEqual([
      [
        "translation_prompt_used",
        expect.objectContaining({
          action_id: "action-1",
          feature: "page_translation",
          surface: "popup",
          cohort: "new_user_prompt_experiment_v1",
        }),
      ],
    ])
    expect(values.get("local:promptExperimentCohortV1")).toEqual(
      expect.objectContaining({
        firstPromptExposureAt: new Date("2026-07-14T12:00:00.000Z").getTime(),
      }),
    )
  })

  it("performs one native exposure for a page session across three batches", async () => {
    useMemoryStorage({
      "local:analyticsEnabled": true,
      "local:analyticsInstallId": "install-123",
      "local:promptExperimentCohortV1": {
        cohort: "new_user_prompt_experiment_v1",
        installedAt: new Date("2026-07-14T11:00:00.000Z").getTime(),
        installVersion: "1.0.0",
      } satisfies PromptExperimentCohort,
    })
    posthogGetFeatureFlagMock.mockReturnValue("precision-rewrite")
    const analytics = createAnalytics()
    const actionContext: TranslationActionContext = {
      actionId: "page-session-1",
      feature: "page_translation",
      surface: "popup",
    }
    const actionDedupeKey = "42:page-session-1"

    await expect(
      Promise.all([
        analytics.exposePromptExperiment(actionContext, "precision-rewrite", actionDedupeKey),
        analytics.exposePromptExperiment(actionContext, "precision-rewrite", actionDedupeKey),
        analytics.exposePromptExperiment(actionContext, "precision-rewrite", actionDedupeKey),
      ]),
    ).resolves.toEqual([true, true, true])

    const silentLookups = posthogGetFeatureFlagMock.mock.calls.filter(
      ([, options]) => options?.send_event === false,
    )
    const exposingLookups = posthogGetFeatureFlagMock.mock.calls.filter(
      ([, options]) => options === undefined,
    )

    expect(silentLookups).toHaveLength(3)
    expect(exposingLookups).toEqual([["new-user-default-translate-prompt-v1"]])
    expect(
      posthogCaptureMock.mock.calls.filter(([event]) => event === "translation_prompt_used"),
    ).toEqual([
      [
        "translation_prompt_used",
        expect.objectContaining({
          action_id: actionDedupeKey,
          feature: "page_translation",
          surface: "popup",
        }),
      ],
    ])
  })

  it("does not let background preload consume the action-time flag wait", async () => {
    vi.useFakeTimers()
    let featureFlagsCallback: Parameters<PostHog["onFeatureFlags"]>[0] | undefined
    useMemoryStorage({
      "local:analyticsEnabled": true,
      "local:analyticsInstallId": "install-123",
      "local:promptExperimentCohortV1": {
        cohort: "new_user_prompt_experiment_v1",
        installedAt: 1,
        installVersion: "1.0.0",
      },
    })
    posthogOnFeatureFlagsMock.mockImplementation((callback) => {
      featureFlagsCallback = callback
      return vi.fn<() => void>()
    })
    posthogGetFeatureFlagMock.mockReturnValue("precision-rewrite")
    const analytics = createAnalytics()

    await analytics.preloadPromptExperimentFeatureFlags()
    await vi.advanceTimersByTimeAsync(PROMPT_EXPERIMENT_FLAG_WAIT_MS + 1)
    featureFlagsCallback?.(
      ["new-user-default-translate-prompt-v1"],
      { "new-user-default-translate-prompt-v1": "precision-rewrite" },
      {},
    )

    await expect(analytics.resolvePromptExperimentVariant("default")).resolves.toBe(
      "precision-rewrite",
    )
  })

  it("starts the unavailable-flags timeout when an action requests a variant", async () => {
    vi.useFakeTimers()
    const values = useMemoryStorage({
      "local:analyticsEnabled": true,
      "local:analyticsInstallId": "install-123",
      "local:promptExperimentCohortV1": {
        cohort: "new_user_prompt_experiment_v1",
        installedAt: 1,
        installVersion: "1.0.0",
      },
    })
    posthogOnFeatureFlagsMock.mockImplementation(() => vi.fn<() => void>())
    const analytics = createAnalytics()

    await analytics.preloadPromptExperimentFeatureFlags()
    await vi.advanceTimersByTimeAsync(PROMPT_EXPERIMENT_FLAG_WAIT_MS * 2)
    const variantPromise = analytics.resolvePromptExperimentVariant("default")
    await vi.advanceTimersByTimeAsync(PROMPT_EXPERIMENT_FLAG_WAIT_MS)

    await expect(variantPromise).resolves.toBeNull()
    expect(values.get("local:promptExperimentCohortV1")).toEqual(
      expect.objectContaining({ excludedReason: "flag_unavailable" }),
    )
  })

  it("reports requested actions only for cohort installs and derives D1-D7 exposure age", async () => {
    useMemoryStorage({
      "local:analyticsEnabled": true,
      "local:analyticsInstallId": "install-123",
      "local:promptExperimentCohortV1": {
        cohort: "new_user_prompt_experiment_v1",
        installedAt: new Date("2026-07-10T00:00:00.000Z").getTime(),
        installVersion: "1.0.0",
        firstPromptExposureAt: new Date("2026-07-12T12:00:00.000Z").getTime(),
      },
    })
    const analytics = createAnalytics()
    analytics.setupAnalyticsMessageHandlers()

    await requireMessageHandler(
      trackTranslationRequestedEventHandler,
      "trackTranslationRequestedEvent",
    )({
      data: {
        feature: "hover_translation",
        surface: "shortcut",
        backend_kind: "non_llm",
        configured_prompt: "not_applicable",
      },
    })

    expect(posthogCaptureMock).toHaveBeenCalledWith("translation_requested", {
      feature: "hover_translation",
      surface: "shortcut",
      backend_kind: "non_llm",
      configured_prompt: "not_applicable",
      cohort: "new_user_prompt_experiment_v1",
      prompt_exposure_age: "d1_d7",
    })
  })

  it("permanently excludes a default-LLM action used while analytics is disabled", async () => {
    const values = useMemoryStorage({
      "local:analyticsEnabled": false,
      "local:promptExperimentCohortV1": {
        cohort: "new_user_prompt_experiment_v1",
        installedAt: 1,
        installVersion: "1.0.0",
      },
    })
    const analytics = createAnalytics({ defaultAnalyticsEnabled: false })

    await expect(analytics.resolvePromptExperimentVariant("default")).resolves.toBeNull()

    expect(values.get("local:promptExperimentCohortV1")).toEqual(
      expect.objectContaining({ excludedReason: "analytics_disabled" }),
    )
    expect(posthogInitMock).not.toHaveBeenCalled()
  })

  it("treats false and unknown flag values as permanent exclusions rather than control", async () => {
    const baseCohort: PromptExperimentCohort = {
      cohort: "new_user_prompt_experiment_v1",
      installedAt: 1,
      installVersion: "1.0.0",
    }
    const falseValues = useMemoryStorage({
      "local:analyticsEnabled": true,
      "local:analyticsInstallId": "install-123",
      "local:promptExperimentCohortV1": baseCohort,
    })
    posthogGetFeatureFlagMock.mockReturnValue(false)
    await createAnalytics().resolvePromptExperimentVariant("default")
    expect(falseValues.get("local:promptExperimentCohortV1")).toEqual(
      expect.objectContaining({ excludedReason: "flag_unavailable" }),
    )

    const unknownValues = useMemoryStorage({
      "local:analyticsEnabled": true,
      "local:analyticsInstallId": "install-123",
      "local:promptExperimentCohortV1": baseCohort,
    })
    posthogGetFeatureFlagMock.mockReturnValue("not-a-variant")
    await createAnalytics().resolvePromptExperimentVariant("default")
    expect(unknownValues.get("local:promptExperimentCohortV1")).toEqual(
      expect.objectContaining({ excludedReason: "invalid_variant" }),
    )
  })
})
