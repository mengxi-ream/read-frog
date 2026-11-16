import type { AdapterContext } from "./adapter-context"
import type { SourceSubtitlesCache } from "./source-subtitles-cache"
import type { BuiltInAiPromptTrigger } from "@/types/analytics"
import type { Config } from "@/types/config/config"
import type { SubtitlesVideoContext } from "@/utils/subtitles/processor/translator"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { isSameLanguage } from "@read-frog/definitions"
import { getSourceDocumentTitle } from "@/utils/content/document-title"
import { getDocumentDescription } from "@/utils/content/metadata"
import { resolveLanguageCodeFromLocale } from "@/utils/content/page-language"
import { canProviderRefGenerateText } from "@/utils/providers/provider-ref"
import { promptForSubtitlesRefusal } from "@/utils/subtitles/built-in-ai-refusal"
import {
  buildSubtitlesSummaryContextHash,
  resolveSubtitlesProvider,
  fetchSubtitlesSummary,
  getSubtitlesPassLimits,
} from "@/utils/subtitles/processor/translator"
import { currentTimeMsAtom, sourceLanguageAtom, sourceTrackAtom, subtitlesStore } from "../atoms"
import { SegmentationPipeline } from "../segmentation-pipeline"
import { TranslationCoordinator } from "../translation-coordinator"

type SubtitlesSessionDeps = Pick<
  AdapterContext,
  "config" | "lifecycle" | "getScheduler" | "getFetcher"
> & {
  sourceCache: Pick<SourceSubtitlesCache, "sourceProcessedSubtitles">
}

export class SubtitlesSession {
  private readonly config: SubtitlesSessionDeps["config"]
  private readonly lifecycle: SubtitlesSessionDeps["lifecycle"]
  private readonly getScheduler: SubtitlesSessionDeps["getScheduler"]
  private readonly getFetcher: SubtitlesSessionDeps["getFetcher"]
  private readonly sourceCache: SubtitlesSessionDeps["sourceCache"]
  sessionSubtitles: SubtitlesFragment[] = []
  sessionProcessedFragments: SubtitlesFragment[] = []
  sessionVideoId: string | null = null
  segmentationPipeline: SegmentationPipeline | null = null
  translationCoordinator: TranslationCoordinator | null = null
  // Whether the running translation was asked for or started on its own; analytics only.
  translationTrigger: BuiltInAiPromptTrigger = "user"
  private subtitlesSummaryContextHash: string | null = null

  constructor({ config, lifecycle, getScheduler, getFetcher, sourceCache }: SubtitlesSessionDeps) {
    this.config = config
    this.lifecycle = lifecycle
    this.getScheduler = getScheduler
    this.getFetcher = getFetcher
    this.sourceCache = sourceCache
  }

  clearRuntimeSession() {
    this.translationCoordinator?.stop()
    this.segmentationPipeline?.stop()
    this.translationCoordinator = null
    this.segmentationPipeline = null
    this.sessionSubtitles = []
    this.sessionProcessedFragments = []
    this.sessionVideoId = null
    this.subtitlesSummaryContextHash = null
    subtitlesStore.set(sourceTrackAtom, [])
  }

  shouldSkipTranslationForCurrentTrack(config: Config | null): boolean {
    const targetLanguage = config?.language.targetCode
    const sourceLanguage = resolveLanguageCodeFromLocale(this.getFetcher().getSourceLanguage())

    if (!targetLanguage || !sourceLanguage) {
      return false
    }

    // A `pt-PT` track is not translated for a `pt-BR` reader, as on pages.
    return isSameLanguage(sourceLanguage, targetLanguage)
  }

  processPassthroughSubtitles() {
    this.sessionProcessedFragments = this.sourceCache.sourceProcessedSubtitles.map((fragment) => ({
      ...fragment,
      translation: fragment.text,
    }))
    this.publishSourceTrack(this.sourceCache.sourceProcessedSubtitles)
    this.getScheduler()?.supplementSubtitles(this.sessionProcessedFragments)
    this.getScheduler()?.setState("idle")
  }

  publishSourceTrack(fragments: SubtitlesFragment[]) {
    // timeupdate may not have fired yet (paused / enable mid-video); keep display time fresh.
    const video = this.getScheduler()?.getVideoElement()
    if (video) {
      subtitlesStore.set(currentTimeMsAtom, video.currentTime * 1000)
    }
    subtitlesStore.set(sourceTrackAtom, [...fragments])
    subtitlesStore.set(
      sourceLanguageAtom,
      resolveLanguageCodeFromLocale(this.getFetcher().getSourceLanguage()),
    )
  }

  private replaceSourceTrackWindow(
    windowStartMs: number,
    windowEndMs: number,
    nextFragments: SubtitlesFragment[],
  ) {
    const previous = subtitlesStore.get(sourceTrackAtom)
    // Drop any cue that overlaps the window (not just cues whose start falls inside it).
    // Half-open: keep if end <= windowStart || start >= windowEnd.
    const kept = previous.filter(
      (fragment) => fragment.end <= windowStartMs || fragment.start >= windowEndMs,
    )
    const next = [...kept, ...nextFragments].sort((a, b) => a.start - b.start)
    this.publishSourceTrack(next)
  }

  async processTranslatedSubtitles(config: Config | null) {
    const scheduler = this.getScheduler()
    if (!scheduler) return

    const useAiSegmentation = !!config?.videoSubtitles?.aiSegmentation

    const sessionFragments = [...this.sourceCache.sourceProcessedSubtitles]

    // Source track for display fallback; scheduler only receives translated cues
    // later. Published before the provider resolve below, which none of this
    // depends on: for a hosted provider that resolve can reach the network, and
    // this is the only path that puts captions on screen for the translated
    // flow — so sequencing it second made the original captions wait on a round
    // trip they never needed, and a hung request (backgroundFetch carries no
    // timeout) left the player in "loading" showing nothing at all.
    this.publishSourceTrack(sessionFragments)

    // Resolved once per session; the cache key needs the same identity the
    // background will use, and a hosted ref costs one status fetch here rather
    // than one per fragment. Narrowed once for the whole session: segmentation
    // and the summary are generations, so a translate-only provider keeps the
    // rule-based recut and skips the summary without a doomed prompt attempt
    // per look-ahead window.
    // Quiet: why lines can't be translated is the coordinator's to say, once a cue asks.
    const operationId = this.lifecycle.switchGeneration.current()
    const resolution = config ? await resolveSubtitlesProvider(config, "lineTranslation") : null
    const providerRef = resolution?.status === "ok" ? resolution.ref : null
    // Superseded: the session stays unclaimed, or a newer start would resume it untranslated.
    if (this.lifecycle.isSuperseded(operationId)) return
    this.sessionProcessedFragments = sessionFragments
    const promptableProviderRef =
      providerRef && canProviderRefGenerateText(providerRef) ? providerRef : null

    const videoContext: SubtitlesVideoContext = {
      videoTitle: getSourceDocumentTitle(),
      videoDescription: getDocumentDescription(document),
      subtitlesTextContent: this.sessionSubtitles.map((f) => f.text).join(""),
    }

    if (useAiSegmentation) {
      this.segmentationPipeline = new SegmentationPipeline({
        baselineFragments: this.sourceCache.sourceProcessedSubtitles,
        rawFragments: this.sessionSubtitles,
        getVideoElement: () => this.getScheduler()?.getVideoElement() ?? null,
        getSourceLanguage: () => this.getFetcher().getSourceLanguage(),
        // The session ref covers segmentation too: both subtitle routes gate on
        // the same hosted feature, and per-block re-resolution would cost a
        // hostedAi.status round trip per look-ahead window.
        providerRef: promptableProviderRef,
        preSegmented: this.getFetcher().isPreSegmented?.(),
        onChunkSegmented: (chunk, nextFragments) => {
          if (chunk.length === 0 || !chunk[0]) return
          const chunkStart = chunk[0].start
          const chunkEnd = chunk.at(-1)!.end
          this.replaceSourceTrackWindow(chunkStart, chunkEnd, nextFragments)
          // Drop identity-changed/spanning translations; keep translations for unchanged cues
          // so preSegmented (and partial AI recuts) do not wipe work then skip re-translate.
          scheduler.reconcileTranslatedCuesAfterRecut(chunkStart, chunkEnd, nextFragments)
          this.translationCoordinator?.noteFragmentListChanged()
        },
      })
    }

    this.translationCoordinator = new TranslationCoordinator({
      getFragments: () =>
        this.segmentationPipeline
          ? this.segmentationPipeline.processedFragments
          : this.sessionProcessedFragments,
      getVideoElement: () => scheduler.getVideoElement(),
      getCurrentState: () => scheduler.getState(),
      segmentationPipeline: this.segmentationPipeline,
      onTranslated: (fragments) => scheduler.supplementSubtitles(fragments),
      onStateChange: (state, data) => scheduler.setState(state, data),
      batchLimits: config ? getSubtitlesPassLimits(config) : undefined,
      onBuiltInAiRefused: (error) => {
        promptForSubtitlesRefusal(error, {
          videoKey: this.config.getVideoId?.() ?? window.location.href,
          trigger: this.translationTrigger,
          retry: () => this.translationCoordinator?.retryFailed(),
        })
      },
    })
    this.translationCoordinator.start(videoContext)
    // The hash and the summary must share one ref — the promptable one — or
    // the cache identity and the ref that rides the message could diverge.
    const summaryContextHash = buildSubtitlesSummaryContextHash(
      videoContext,
      promptableProviderRef ?? undefined,
    )
    this.subtitlesSummaryContextHash = summaryContextHash ?? null

    void fetchSubtitlesSummary(videoContext, config ?? undefined, promptableProviderRef).then(
      (summary) => {
        if (!summaryContextHash) {
          return
        }

        if (this.subtitlesSummaryContextHash !== summaryContextHash) {
          return
        }

        videoContext.summary = summary
      },
    )
  }
}
