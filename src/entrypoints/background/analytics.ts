import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { CaptureResult } from "posthog-js/dist/module.no-external"
import type { AnalyticsFeature, FeatureUsedEventProperties } from "@/types/analytics"
import posthog from "posthog-js/dist/module.no-external"
import { storage } from "#imports"
import { env } from "@/env"
import { ANALYTICS_FEATURE } from "@/types/analytics"
import { getLocalConfig } from "@/utils/config/storage"
import {
  ANALYTICS_ENABLED_STORAGE_KEY,
  ANALYTICS_FEATURE_USED_EVENT,
  ANALYTICS_INSTALL_ID_STORAGE_KEY,
  DEFAULT_ANALYTICS_ENABLED,
} from "@/utils/constants/analytics"
import { EXTENSION_VERSION } from "@/utils/constants/app"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { logger } from "@/utils/logger"
import { onMessage } from "@/utils/message"
import {
  createStorageFeatureUsageCache,
  getFeatureUsageDay,
  type FeatureUsageCache,
} from "./analytics-feature-cache"

type BackgroundFeatureUsedEventProperties = FeatureUsedEventProperties & {
  target_language?: LangCodeISO6393
}

/**
 * Features whose events are multi-step funnels (every step must be recorded) and
 * are already rate-limited elsewhere, so they bypass the once-per-day-per-feature
 * adoption throttle instead of losing their second same-day event to it.
 */
const FEATURES_BYPASSING_DAILY_FEATURE_CACHE = new Set<AnalyticsFeature>([
  ANALYTICS_FEATURE.SAVE_SUGGESTION,
])

interface BackgroundAnalyticsClient {
  capture: (eventName: string, properties: BackgroundFeatureUsedEventProperties) => void
  init: (token: string, config: Record<string, unknown>) => void
  register: (properties: { extension_version: string }) => void
}

interface BackgroundAnalyticsRuntime {
  apiHost?: string
  apiKey?: string
  createDistinctId: () => string
  defaultAnalyticsEnabled: boolean
  distinctIdOverride?: string
  extensionVersion: string
  featureUsageCache?: FeatureUsageCache
  getCurrentDate: () => Date
  getStorageItem: (key: string) => Promise<unknown>
  getTargetLanguage: () => Promise<LangCodeISO6393 | undefined>
  onMessage: (
    type: "trackFeatureUsedEvent",
    handler: (message: { data: FeatureUsedEventProperties }) => Promise<void>,
  ) => unknown
  posthog: BackgroundAnalyticsClient
  setStorageItem: (key: string, value: unknown) => Promise<void>
  warn: typeof logger.warn
}

const DEV_POSTHOG_TEST_UUID = "00000000-0000-0000-0000-000000000001"

function normalizeDistinctIdOverride(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function resolveDistinctIdOverride(
  explicitOverrideValue: string | undefined,
  isDev: boolean,
): string | undefined {
  const explicitOverride = normalizeDistinctIdOverride(explicitOverrideValue)
  if (explicitOverride) {
    return explicitOverride
  }

  return isDev ? DEV_POSTHOG_TEST_UUID : undefined
}

function createDefaultRuntime(): BackgroundAnalyticsRuntime {
  const getStorageItem = (key: string) => storage.getItem(key as `local:${string}`)
  const setStorageItem = (key: string, value: unknown) =>
    storage.setItem(key as `local:${string}`, value)

  return {
    apiHost: env.WXT_POSTHOG_HOST,
    apiKey: env.WXT_POSTHOG_API_KEY,
    createDistinctId: () => getRandomUUID(),
    defaultAnalyticsEnabled: DEFAULT_ANALYTICS_ENABLED,
    distinctIdOverride: resolveDistinctIdOverride(env.WXT_POSTHOG_TEST_UUID, import.meta.env.DEV),
    extensionVersion: EXTENSION_VERSION,
    featureUsageCache: env.WXT_ANALYTICS_DAILY_FEATURE_CACHE_ENABLED
      ? createStorageFeatureUsageCache({
          getItem: getStorageItem,
          setItem: setStorageItem,
        })
      : undefined,
    getCurrentDate: () => new Date(),
    getStorageItem,
    getTargetLanguage: async () => {
      const config = await getLocalConfig()
      return config?.language.targetCode
    },
    onMessage,
    posthog,
    setStorageItem,
    warn: logger.warn,
  }
}

type AnalyticsCaptureProperties = Record<string, unknown>

function setPropertyIfDefined(
  properties: AnalyticsCaptureProperties,
  key: string,
  value: unknown,
): void {
  if (value !== undefined) {
    properties[key] = value
  }
}

export function filterAnalyticsCaptureResult(data: CaptureResult): CaptureResult {
  const properties = data.properties ?? {}
  const filteredProperties: AnalyticsCaptureProperties = {}

  setPropertyIfDefined(filteredProperties, "token", properties.token)
  setPropertyIfDefined(filteredProperties, "distinct_id", properties.distinct_id)
  setPropertyIfDefined(filteredProperties, "feature", properties.feature)
  setPropertyIfDefined(filteredProperties, "surface", properties.surface)
  setPropertyIfDefined(filteredProperties, "outcome", properties.outcome)
  setPropertyIfDefined(filteredProperties, "latency_ms", properties.latency_ms)
  setPropertyIfDefined(filteredProperties, "action_id", properties.action_id)
  setPropertyIfDefined(filteredProperties, "action_name", properties.action_name)
  setPropertyIfDefined(filteredProperties, "target_language", properties.target_language)
  setPropertyIfDefined(filteredProperties, "$browser", properties.$browser)
  setPropertyIfDefined(filteredProperties, "$browser_version", properties.$browser_version)
  setPropertyIfDefined(filteredProperties, "$insert_id", properties.$insert_id)
  setPropertyIfDefined(filteredProperties, "$time", properties.$time)
  setPropertyIfDefined(filteredProperties, "$lib", properties.$lib)
  setPropertyIfDefined(filteredProperties, "$lib_version", properties.$lib_version)
  setPropertyIfDefined(
    filteredProperties,
    "$process_person_profile",
    properties.$process_person_profile,
  )
  setPropertyIfDefined(filteredProperties, "extension_version", properties.extension_version)

  return {
    ...data,
    properties: filteredProperties,
  }
}

export function createBackgroundAnalytics(
  runtime: BackgroundAnalyticsRuntime = createDefaultRuntime(),
) {
  let clientPromise: Promise<BackgroundAnalyticsClient | null> | null = null
  let missingConfigWarned = false
  const featureCaptureQueues = new Map<AnalyticsFeature, Promise<void>>()

  async function isAnalyticsEnabled(): Promise<boolean> {
    const enabled = await runtime.getStorageItem(`local:${ANALYTICS_ENABLED_STORAGE_KEY}`)
    return typeof enabled === "boolean" ? enabled : runtime.defaultAnalyticsEnabled
  }

  async function getAnalyticsInstallId(): Promise<string> {
    const distinctIdOverride = normalizeDistinctIdOverride(runtime.distinctIdOverride)
    if (distinctIdOverride) {
      return distinctIdOverride
    }

    const storageKey = `local:${ANALYTICS_INSTALL_ID_STORAGE_KEY}`
    const existingId = await runtime.getStorageItem(storageKey)

    if (typeof existingId === "string" && existingId.length > 0) {
      return existingId
    }

    const nextId = runtime.createDistinctId()
    await runtime.setStorageItem(storageKey, nextId)
    return nextId
  }

  async function getPostHogClient(): Promise<BackgroundAnalyticsClient | null> {
    if (!runtime.apiKey || !runtime.apiHost) {
      if (!missingConfigWarned) {
        missingConfigWarned = true
        runtime.warn(
          "[Analytics] PostHog is disabled because WXT_POSTHOG_API_KEY or WXT_POSTHOG_HOST is missing",
        )
      }
      return null
    }

    if (!clientPromise) {
      clientPromise = (async () => {
        const distinctId = await getAnalyticsInstallId()

        runtime.posthog.init(runtime.apiKey!, {
          before_send: filterAnalyticsCaptureResult,
          api_host: runtime.apiHost!,
          autocapture: false,
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
            distinctID: distinctId,
          },
        })

        runtime.posthog.register({
          extension_version: runtime.extensionVersion,
        })

        return runtime.posthog
      })()
    }

    return clientPromise
  }

  async function captureFeatureUsedEvent(properties: FeatureUsedEventProperties): Promise<boolean> {
    try {
      const client = await getPostHogClient()
      if (!client) {
        return false
      }

      client.capture(
        ANALYTICS_FEATURE_USED_EVENT,
        await buildBackgroundFeatureUsedEventProperties(properties),
      )
      return true
    } catch (error) {
      runtime.warn(
        `[Analytics] Failed to capture ${ANALYTICS_FEATURE_USED_EVENT} in background`,
        error,
      )
      return false
    }
  }

  async function runFeatureCaptureSerially(
    feature: AnalyticsFeature,
    capture: () => Promise<void>,
  ): Promise<void> {
    const previousCapture = featureCaptureQueues.get(feature) ?? Promise.resolve()
    const currentCapture = previousCapture.catch(() => undefined).then(capture)
    featureCaptureQueues.set(feature, currentCapture)

    try {
      await currentCapture
    } finally {
      if (featureCaptureQueues.get(feature) === currentCapture) {
        featureCaptureQueues.delete(feature)
      }
    }
  }

  async function captureFeatureUsedEventWithCache(
    properties: FeatureUsedEventProperties,
    featureUsageCache: FeatureUsageCache,
  ): Promise<void> {
    await runFeatureCaptureSerially(properties.feature, async () => {
      const currentDay = getFeatureUsageDay(runtime.getCurrentDate())
      let lastReportedDay: string | undefined

      try {
        lastReportedDay = await featureUsageCache.getLastReportedDay(properties.feature)
      } catch (error) {
        runtime.warn("[Analytics] Failed to read the daily feature usage cache", error)
      }

      if (lastReportedDay === currentDay) {
        return
      }

      if (!(await captureFeatureUsedEvent(properties))) {
        return
      }

      try {
        await featureUsageCache.setLastReportedDay(properties.feature, currentDay)
      } catch (error) {
        runtime.warn("[Analytics] Failed to write the daily feature usage cache", error)
      }
    })
  }

  async function captureFeatureUsedEventInBackground(
    properties: FeatureUsedEventProperties,
  ): Promise<void> {
    if (!(await isAnalyticsEnabled())) {
      return
    }

    // Funnel features must record every step (e.g. save-suggestion shown vs
    // accepted), so they skip the once-per-day-per-feature adoption throttle —
    // the daily cache keys on feature only and would drop the second same-day
    // event. These features are already rate-limited (save suggestions by their
    // cooldown), so bypassing does not inflate volume.
    if (
      !runtime.featureUsageCache ||
      FEATURES_BYPASSING_DAILY_FEATURE_CACHE.has(properties.feature)
    ) {
      await captureFeatureUsedEvent(properties)
      return
    }

    await captureFeatureUsedEventWithCache(properties, runtime.featureUsageCache)
  }

  async function getBackgroundFeatureUsedEventProperties(): Promise<
    Partial<BackgroundFeatureUsedEventProperties>
  > {
    const backgroundProperties: Partial<BackgroundFeatureUsedEventProperties> = {}

    try {
      const targetLanguage = await runtime.getTargetLanguage()
      if (targetLanguage) {
        backgroundProperties.target_language = targetLanguage
      }
    } catch (error) {
      runtime.warn("[Analytics] Failed to read target language for analytics event", error)
    }

    return backgroundProperties
  }

  async function buildBackgroundFeatureUsedEventProperties(
    properties: FeatureUsedEventProperties,
  ): Promise<BackgroundFeatureUsedEventProperties> {
    return {
      ...properties,
      ...(await getBackgroundFeatureUsedEventProperties()),
    }
  }

  function setupAnalyticsMessageHandlers(): void {
    runtime.onMessage("trackFeatureUsedEvent", async (message) => {
      await captureFeatureUsedEventInBackground(message.data)
    })
  }

  return {
    captureFeatureUsedEventInBackground,
    setupAnalyticsMessageHandlers,
  }
}

const backgroundAnalytics = createBackgroundAnalytics()

export const { captureFeatureUsedEventInBackground, setupAnalyticsMessageHandlers } =
  backgroundAnalytics
