import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { CaptureResult } from "posthog-js/dist/module.no-external"
import type { AnalyticsFeature, FeatureUsedEventProperties } from "@/types/analytics"
import posthog from "posthog-js/dist/module.no-external"
import { storage } from "#imports"
import { env } from "@/env"
import { ANALYTICS_FEATURE } from "@/types/analytics"
import { normalizeFeatureProviderAnalytics } from "@/utils/analytics-provider"
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
 * Features whose events are multi-step funnels (every step must be recorded)
 * and whose volume is bounded elsewhere, so they bypass the
 * once-per-day-per-feature adoption throttle instead of losing their second
 * same-day event to it.
 */
const FEATURES_BYPASSING_DAILY_FEATURE_CACHE = new Set<AnalyticsFeature>([
  ANALYTICS_FEATURE.SAVE_SUGGESTION,
])

interface BackgroundAnalyticsClient {
  capture: (...args: Parameters<typeof posthog.capture>) => void
  init: (...args: Parameters<typeof posthog.init>) => void
  register: (...args: Parameters<typeof posthog.register>) => void
}

type BackgroundAnalyticsMessageHandler<TData, TResult> = (message: {
  data: TData
}) => TResult | Promise<TResult>

type LocalStorageKey = `local:${string}`

interface BackgroundAnalyticsMessageRegistrar {
  registerTrackFeatureUsedEvent: (
    handler: BackgroundAnalyticsMessageHandler<FeatureUsedEventProperties, void>,
  ) => void
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
  getStorageItem: (key: LocalStorageKey) => Promise<unknown>
  getTargetLanguage: () => Promise<LangCodeISO6393 | undefined>
  messageRegistrar: BackgroundAnalyticsMessageRegistrar
  posthog: BackgroundAnalyticsClient
  setStorageItem: (key: LocalStorageKey, value: unknown) => Promise<void>
  warn: typeof logger.warn
}

const DEV_POSTHOG_TEST_UUID = "00000000-0000-0000-0000-000000000001"

function createDefaultMessageRegistrar(): BackgroundAnalyticsMessageRegistrar {
  return {
    registerTrackFeatureUsedEvent(handler) {
      onMessage("trackFeatureUsedEvent", handler)
    },
  }
}

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
  const getStorageItem = (key: LocalStorageKey) => storage.getItem(key)
  const setStorageItem = (key: LocalStorageKey, value: unknown) => storage.setItem(key, value)

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
    messageRegistrar: createDefaultMessageRegistrar(),
    posthog,
    setStorageItem,
    warn: logger.warn,
  }
}

type AnalyticsCaptureProperties = Record<string, unknown>
const BLOCKED_ANALYTICS_PROPERTY_KEYS = new Set([
  "currenturl",
  "host",
  "pathname",
  "referrer",
  "referringdomain",
  "url",
  "href",
  "title",
  "rawuseragent",
  "device",
  "screenheight",
  "screenwidth",
  "viewportheight",
  "viewportwidth",
  "deviceid",
  "sessionid",
  "windowid",
  "pageviewid",
  "configdefaults",
  "libcustomapihost",
  "activefeatureflags",
  "enabledfeatureflags",
  "featureflagpayload",
  "featureflagpayloads",
  "authorization",
  "credential",
  "credentials",
  "secret",
  "password",
  "header",
  "headers",
  "baseurl",
  "providerconfig",
  "provideroptions",
  "prompt",
  "instructions",
  "input",
  "output",
  "text",
  "content",
  "selection",
  "html",
  "model",
  "modelid",
])

function normalizeAnalyticsPropertyKey(key: string): string {
  return key.replaceAll(/[$_\-\s]/g, "").toLowerCase()
}

function isBlockedAnalyticsProperty(key: string, preserveRootToken: boolean): boolean {
  const normalizedKey = normalizeAnalyticsPropertyKey(key)

  if (preserveRootToken && key === "token") return false
  if (BLOCKED_ANALYTICS_PROPERTY_KEYS.has(normalizedKey)) return true
  if (normalizedKey.startsWith("sdkdebug")) return true
  if (normalizedKey.startsWith("prevpageview") || normalizedKey.startsWith("previouspageview")) {
    return true
  }
  if (normalizedKey.startsWith("screen") || normalizedKey.startsWith("viewport")) return true
  if (
    ["url", "href", "host", "hostname", "pathname", "referrer", "title"].some((suffix) =>
      normalizedKey.endsWith(suffix),
    )
  ) {
    return true
  }
  if (
    normalizedKey.startsWith("initial") &&
    ["url", "host", "path", "referrer", "domain", "title"].some((part) =>
      normalizedKey.includes(part),
    )
  ) {
    return true
  }
  if (
    normalizedKey.endsWith("deviceid") ||
    normalizedKey.endsWith("sessionid") ||
    normalizedKey.endsWith("windowid") ||
    normalizedKey.endsWith("pageviewid")
  ) {
    return true
  }
  if (
    normalizedKey.endsWith("apikey") ||
    normalizedKey.endsWith("token") ||
    normalizedKey.includes("credential") ||
    normalizedKey.endsWith("secret") ||
    normalizedKey.endsWith("password") ||
    normalizedKey.endsWith("authorization") ||
    normalizedKey.endsWith("header") ||
    normalizedKey.endsWith("headers") ||
    normalizedKey.endsWith("providerconfig") ||
    normalizedKey.endsWith("provideroptions")
  ) {
    return true
  }
  if (
    normalizedKey.includes("instructions") ||
    normalizedKey.endsWith("prompt") ||
    normalizedKey.endsWith("prompttext") ||
    normalizedKey.endsWith("inputtext") ||
    normalizedKey.endsWith("outputtext") ||
    normalizedKey.endsWith("content") ||
    normalizedKey.endsWith("selection") ||
    normalizedKey.endsWith("html") ||
    normalizedKey.includes("model")
  ) {
    return true
  }

  return false
}

function sanitizeAnalyticsValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeAnalyticsValue)
  }
  if (typeof value !== "object" || value === null) {
    return value
  }

  return sanitizeAnalyticsProperties(value as AnalyticsCaptureProperties, false)
}

function sanitizeAnalyticsProperties(
  properties: AnalyticsCaptureProperties,
  preserveRootToken: boolean,
): AnalyticsCaptureProperties {
  const sanitizedProperties: AnalyticsCaptureProperties = {}

  for (const [key, value] of Object.entries(properties)) {
    if (isBlockedAnalyticsProperty(key, preserveRootToken)) continue
    sanitizedProperties[key] = sanitizeAnalyticsValue(value)
  }

  return sanitizedProperties
}

export function filterAnalyticsCaptureResult(data: CaptureResult): CaptureResult
export function filterAnalyticsCaptureResult(data: null): null
export function filterAnalyticsCaptureResult(data: CaptureResult | null): CaptureResult | null
export function filterAnalyticsCaptureResult(data: CaptureResult | null): CaptureResult | null {
  if (data === null) return null

  const filteredData = {
    ...data,
    properties: sanitizeAnalyticsProperties(data.properties ?? {}, true),
  }

  const mutableFilteredData = filteredData as CaptureResult & {
    $set?: AnalyticsCaptureProperties
    $set_once?: AnalyticsCaptureProperties
  }
  const captureData = data as CaptureResult & {
    $set?: AnalyticsCaptureProperties
    $set_once?: AnalyticsCaptureProperties
  }
  if (captureData.$set) {
    mutableFilteredData.$set = sanitizeAnalyticsProperties(captureData.$set, false)
  }
  if (captureData.$set_once) {
    mutableFilteredData.$set_once = sanitizeAnalyticsProperties(captureData.$set_once, false)
  }

  return mutableFilteredData
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
    const apiKey = runtime.apiKey
    const apiHost = runtime.apiHost

    if (!apiKey || !apiHost) {
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

        runtime.posthog.init(apiKey, {
          before_send: filterAnalyticsCaptureResult,
          api_host: apiHost,
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

    const normalizedProperties: FeatureUsedEventProperties = {
      ...properties,
      ...normalizeFeatureProviderAnalytics(properties.provider, properties.backend_kind),
    }

    // Funnel features must record every step (e.g. save-suggestion shown vs
    // accepted), so they skip the once-per-day-per-feature adoption throttle —
    // the daily cache keys on feature only and would drop the second same-day
    // event. Volume stays bounded: a save-suggestion shown event requires a
    // manual selection translation that produced a valid suggestion (once per
    // popover session), and error retries are capped by the per-provider
    // failure cooldown.
    if (
      !runtime.featureUsageCache ||
      FEATURES_BYPASSING_DAILY_FEATURE_CACHE.has(normalizedProperties.feature)
    ) {
      await captureFeatureUsedEvent(normalizedProperties)
      return
    }

    await captureFeatureUsedEventWithCache(normalizedProperties, runtime.featureUsageCache)
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
    runtime.messageRegistrar.registerTrackFeatureUsedEvent(async (message) => {
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
