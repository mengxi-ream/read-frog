import type { AdapterContext } from "./adapter-context"
import type { SourceSubtitlesCache } from "./source-subtitles-cache"
import type { SubtitlesSession } from "./subtitles-session"
import type { SubtitlesSwitch } from "./subtitles-switch"
import type { FeatureUsageContext } from "@/types/analytics"
import type { Config } from "@/types/config/config"
import type { SubtitlesSource } from "@/utils/constants/subtitles"
import type { I18nKey } from "@/utils/i18n"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { trackFeatureUsed } from "@/utils/analytics"
import { classifyFailureReason } from "@/utils/analytics-failure-reason"
import { classifyResolvedProvider, UNKNOWN_FEATURE_PROVIDER } from "@/utils/analytics-provider"
import { getLocalConfig } from "@/utils/config/storage"
import { SUBTITLES_SOURCE } from "@/utils/constants/subtitles"
import { i18n } from "@/utils/i18n"
import { resolveProviderRefForCapability } from "@/utils/providers/provider-registry"
import { NoSubtitlesError, ToastSubtitlesError, VideoNotFoundError } from "@/utils/subtitles/errors"
import { showAiSubtitlesWallToast, showSubtitlesErrorToast } from "@/utils/subtitles/toast"
import { adPlayingAtom, subtitlesStore } from "../atoms"

export interface SubtitlesStartOptions {
  analyticsContext?: FeatureUsageContext<"video_subtitles">
  /** Stay silent when the video has no subtitles; see `QUIET_AUTO_START_PLATFORMS`. */
  quiet?: boolean
}

const LOADING_MESSAGE_KEY = {
  [SUBTITLES_SOURCE.NATIVE]: undefined,
  [SUBTITLES_SOURCE.AI]: "subtitles.loadingAiSubtitles",
} as const satisfies Record<SubtitlesSource, I18nKey | undefined>

/** Translated when shown: this module loads before the content script runs `initI18n`. */
export function getLoadingMessage(source: SubtitlesSource): string | undefined {
  const key = LOADING_MESSAGE_KEY[source]
  return key && i18n.t(key)
}

type SubtitlesStarterDeps = Pick<
  AdapterContext,
  "config" | "lifecycle" | "getScheduler" | "getFetcher"
> & {
  sourceCache: Pick<SourceSubtitlesCache, "getOrLoadSourceSubtitles" | "sourceSubtitles">
  session: Pick<
    SubtitlesSession,
    | "sessionSubtitles"
    | "sessionProcessedFragments"
    | "sessionVideoId"
    | "segmentationPipeline"
    | "translationCoordinator"
    | "translationTrigger"
    | "clearRuntimeSession"
    | "shouldSkipTranslationForCurrentTrack"
    | "processPassthroughSubtitles"
    | "processTranslatedSubtitles"
  >
  subtitlesSwitch: Pick<
    SubtitlesSwitch,
    "source" | "handleToggleSubtitles" | "switchSubtitlesFetcher"
  >
}

export class SubtitlesStarter {
  private readonly config: SubtitlesStarterDeps["config"]
  private readonly lifecycle: SubtitlesStarterDeps["lifecycle"]
  private readonly getScheduler: SubtitlesStarterDeps["getScheduler"]
  private readonly getFetcher: SubtitlesStarterDeps["getFetcher"]
  private readonly sourceCache: SubtitlesStarterDeps["sourceCache"]
  private readonly session: SubtitlesStarterDeps["session"]
  private readonly subtitlesSwitch: SubtitlesStarterDeps["subtitlesSwitch"]
  // While an ad plays the player hands out the ad's audio track and caption tokens, so a native
  // load that overlapped one can fail for the video itself. It gets one more try after the ad.
  private adOverlappedLoad = false
  private retryAfterAdOperationId: number | null = null

  constructor({
    config,
    lifecycle,
    getScheduler,
    getFetcher,
    sourceCache,
    session,
    subtitlesSwitch,
  }: SubtitlesStarterDeps) {
    this.config = config
    this.lifecycle = lifecycle
    this.getScheduler = getScheduler
    this.getFetcher = getFetcher
    this.sourceCache = sourceCache
    this.session = session
    this.subtitlesSwitch = subtitlesSwitch
  }

  noteAdStarted() {
    this.adOverlappedLoad = true
  }

  runRetryAfterAd() {
    const operationId = this.retryAfterAdOperationId
    this.retryAfterAdOperationId = null
    // Anything newer, or subtitles turned off since, means the failed load no longer stands.
    if (
      operationId === null ||
      !this.lifecycle.switchGeneration.isCurrent(operationId) ||
      this.lifecycle.destroyed ||
      !this.getScheduler()?.isActive()
    ) {
      return
    }

    void this.subtitlesSwitch.switchSubtitlesFetcher(SUBTITLES_SOURCE.NATIVE)
  }

  async startTranslation({ analyticsContext, quiet = false }: SubtitlesStartOptions = {}) {
    let providerAnalytics = UNKNOWN_FEATURE_PROVIDER
    let targetLanguage: Config["language"]["targetCode"] | undefined
    const operationId = this.lifecycle.switchGeneration.current()
    if (analyticsContext) {
      this.session.translationTrigger =
        analyticsContext.surface === ANALYTICS_SURFACE.VIDEO_SUBTITLES_AUTO ? "auto" : "user"
    }
    this.adOverlappedLoad = subtitlesStore.get(adPlayingAtom)
    // Only the caption load is what an ad can break; a failure after it is the translation's own.
    let loadingSource = false

    try {
      const analyticsConfig = await getLocalConfig()
      if (this.lifecycle.destroyed) return false
      targetLanguage = analyticsConfig?.language.targetCode
      // Resolve through the capability registry, not providersConfig: Built-in
      // AI is synthesized by the registry and is never a row there, so the
      // lookup returned undefined and every hosted subtitle run was reported as
      // provider "unknown" — the one metric that would size hosted adoption.
      providerAnalytics = classifyResolvedProvider(
        analyticsConfig
          ? resolveProviderRefForCapability(
              "videoSubtitles",
              analyticsConfig.providersConfig,
              analyticsConfig.videoSubtitles.providerId,
            )
          : null,
      )
      const currentVideoId = this.config.getVideoId?.() ?? ""
      const hasCurrentSession =
        this.session.sessionProcessedFragments.length > 0 &&
        this.session.sessionVideoId === currentVideoId
      this.session.sessionVideoId = currentVideoId

      // Only a running session can be resumed, so a fresh start skips the track check.
      const useSameTrack = hasCurrentSession && (await this.getFetcher().shouldUseSameTrack())

      if (useSameTrack && hasCurrentSession) {
        // Translated sessions create a coordinator; passthrough sessions only cache rendered fragments.
        if (this.session.translationCoordinator) {
          // Clear failed states to allow retry on resume
          this.session.translationCoordinator.clearFailed()
          this.session.segmentationPipeline?.clearFailedStarts()
          this.session.translationCoordinator.start()
        } else {
          this.getScheduler()?.supplementSubtitles(this.session.sessionProcessedFragments)
          this.getScheduler()?.setState("idle")
        }
        if (analyticsContext && targetLanguage) {
          void trackFeatureUsed({
            ...analyticsContext,
            ...providerAnalytics,
            target_language: targetLanguage,
            outcome: "success",
          })
        }
        return true
      }

      this.session.clearRuntimeSession()
      this.session.sessionVideoId = currentVideoId
      this.getScheduler()?.reset()

      // A quiet start stays invisible until there is something to show.
      if (!quiet) {
        this.getScheduler()?.setState("loading", {
          message: getLoadingMessage(this.subtitlesSwitch.source),
        })
      }

      loadingSource = true
      await this.sourceCache.getOrLoadSourceSubtitles()
      loadingSource = false
      // A newer start, a navigation reset or a leave has superseded this one since it began.
      if (this.lifecycle.isSuperseded(operationId)) return false
      this.session.sessionSubtitles = this.sourceCache.sourceSubtitles

      if (this.session.shouldSkipTranslationForCurrentTrack(analyticsConfig)) {
        this.session.processPassthroughSubtitles()
      } else {
        await this.session.processTranslatedSubtitles(analyticsConfig)
        if (this.lifecycle.isSuperseded(operationId)) return false
      }
      if (analyticsContext && targetLanguage) {
        void trackFeatureUsed({
          ...analyticsContext,
          ...providerAnalytics,
          target_language: targetLanguage,
          outcome: "success",
        })
      }
      return true
    } catch (error) {
      // Not a failure: the video has none, or an automatic start lost it. Skipping analytics
      // too, since on a quiet site this is most videos and nothing actually ran.
      if (quiet && (error instanceof NoSubtitlesError || error instanceof VideoNotFoundError)) {
        if (this.lifecycle.switchGeneration.isCurrent(operationId)) {
          this.subtitlesSwitch.handleToggleSubtitles(false)
        }
        return false
      }

      if (analyticsContext && targetLanguage) {
        void trackFeatureUsed({
          ...analyticsContext,
          ...providerAnalytics,
          target_language: targetLanguage,
          outcome: "failure",
          failure_reason: classifyFailureReason(error),
        })
      }

      // A deliberate teardown — a superseded switch or a navigation — not a
      // failure the user should read about. Its message is the literal string
      // "Aborted", which would otherwise be painted onto the player untranslated.
      if (error instanceof DOMException && error.name === "AbortError") {
        return false
      }

      // A superseded load failing late must not take the retry slot from the current one.
      if (
        loadingSource &&
        this.lifecycle.switchGeneration.isCurrent(operationId) &&
        this.subtitlesSwitch.source === SUBTITLES_SOURCE.NATIVE &&
        this.adOverlappedLoad
      ) {
        this.retryAfterAdOperationId = operationId
        // The ad already ended while this load was running, so retry now instead of reporting.
        if (!subtitlesStore.get(adPlayingAtom)) {
          this.runRetryAfterAd()
          return false
        }
      }

      const errorMessage = error instanceof Error ? error.message : String(error)

      if (error instanceof ToastSubtitlesError) {
        // The loading state has no auto-hide of its own (unlike "error"), so
        // the toast branch has to clear it — otherwise the "Loading AI
        // subtitles" pill stays on the player forever after a wall.
        this.getScheduler()?.setState("idle")
        // Only the AI request has a control on screen to point at; the source
        // is still AI here because reverting to native happens after this.
        if (this.subtitlesSwitch.source === SUBTITLES_SOURCE.AI) {
          showAiSubtitlesWallToast(errorMessage, error.action)
        } else {
          showSubtitlesErrorToast(errorMessage, error.action)
        }
      } else {
        this.getScheduler()?.setState("error", {
          message: this.config.silentErrors ? "" : errorMessage,
        })
      }
      return false
    }
  }
}
