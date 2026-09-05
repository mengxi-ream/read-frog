import type { SubtitlesFragment } from "./types"
import type { Config } from "@/types/config/config"
import type { ProviderRefForCapability } from "@/utils/providers/provider-registry"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { getLocalConfig } from "@/utils/config/storage"
import { VIDEO_SUMMARY_TRANSCRIPT_CHAR_BUDGET } from "@/utils/constants/subtitles"
import { streamBackgroundText } from "@/utils/content-script/background-stream-client"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { sendMessage } from "@/utils/message"
import { getVideoSummaryPrompt } from "@/utils/prompts/summary"
import { resolveSubtitlesProvider, resolveSubtitlesProviderRef } from "./processor/translator"

const TRANSCRIPT_SAMPLE_WINDOWS = 8

export function sampleTranscript(transcript: string, budget: number): string {
  if (transcript.length <= budget) {
    return transcript
  }

  const lines = transcript.split("\n")
  const windowSize = Math.ceil(lines.length / TRANSCRIPT_SAMPLE_WINDOWS)
  const separators = (TRANSCRIPT_SAMPLE_WINDOWS - 1) * 2
  const perWindowBudget = Math.floor((budget - separators) / TRANSCRIPT_SAMPLE_WINDOWS)

  const runs: string[] = []
  for (let start = 0; start < lines.length; start += windowSize) {
    let run = ""
    for (const line of lines.slice(start, start + windowSize)) {
      const next = run ? `${run}\n${line}` : line
      if (next.length > perWindowBudget) {
        break
      }
      run = next
    }
    if (run) {
      runs.push(run)
    }
  }

  return runs.join("\n\n")
}

export type VideoSummaryProviderRef = ProviderRefForCapability<"videoSubtitles"> | null

export const VIDEO_SUMMARY_QUERY_SCOPE = ["subtitles", "video-summary"] as const

export function videoSummaryQueryKey(
  videoId: string | null,
  targetCode: string,
  resolved: VideoSummaryProviderRef,
) {
  const providerIdentity = !resolved
    ? null
    : resolved.kind === "local"
      ? resolved.config
      : { providerId: resolved.id, modelTier: resolved.modelTier }

  return [...VIDEO_SUMMARY_QUERY_SCOPE, videoId, targetCode, providerIdentity] as const
}

const ZERO_WIDTH_CHARS_RE = /[\u200B-\u200D\uFEFF]/g

/**
 * Not `cleanText`: that truncates at 3000 characters — roughly three minutes of
 * speech — and folds every newline away. A whole video goes to the model, one
 * line per cue.
 */
export function buildTranscript(fragments: SubtitlesFragment[]): string {
  return fragments
    .map((fragment) => fragment.text.replace(ZERO_WIDTH_CHARS_RE, "").trim())
    .filter(Boolean)
    .join("\n")
}

/**
 * The prompt asks for no title, but models add one anyway, so the guarantee is
 * made here instead of hoped for. Only a heading the answer opens with goes —
 * headings further down are the model's own structure.
 */
export function stripLeadingHeading(summary: string): string {
  const rows = summary.split("\n")
  let index = 0
  while (index < rows.length && !rows[index]!.trim()) index++
  if (index >= rows.length || !/^#{1,6}\s/.test(rows[index]!)) {
    return summary
  }
  return rows
    .slice(index + 1)
    .join("\n")
    .trim()
}

export type VideoSummaryAvailability =
  | { status: "ok" }
  | { status: "needsModel" }
  | { status: "hostedUnavailable"; message: string }

/**
 * The subtitles provider list is gated on the wider translate capability, so
 * the default Microsoft provider is a legal choice there and then cannot be
 * prompted. Checked before the panel opens rather than after a request fails.
 *
 * A plan/quota refusal stays itself: the user did pick a model.
 */
export async function checkVideoSummaryAvailability(): Promise<VideoSummaryAvailability> {
  const config = await getLocalConfig()
  if (!config) {
    return { status: "needsModel" }
  }
  const resolution = await resolveSubtitlesProvider(config, "summary")
  if (resolution.status === "hostedUnavailable") {
    return { status: "hostedUnavailable", message: resolution.message }
  }
  if (resolution.status !== "ok") {
    // "none" and "notPromptable" both land here: nothing the panel can run.
    return { status: "needsModel" }
  }
  return { status: "ok" }
}

interface VideoSummaryStreamOptions {
  onChunk?: (partialMarkdown: string) => void
  signal?: AbortSignal
}

export async function requestVideoSummary(
  fragments: SubtitlesFragment[],
  config: Config,
  { onChunk, signal }: VideoSummaryStreamOptions = {},
): Promise<string | null> {
  signal?.throwIfAborted()
  const transcript = buildTranscript(fragments)
  if (!transcript) {
    return null
  }

  const providerRef = await resolveSubtitlesProviderRef(config, "summary")
  signal?.throwIfAborted()
  if (!providerRef) {
    return null
  }

  const targetLanguage = LANG_CODE_TO_EN_NAME[config.language.targetCode]

  const cached = await sendMessage("getCachedVideoSummary", {
    transcript,
    targetLanguage,
    providerRef,
  })
  signal?.throwIfAborted()
  if (cached) {
    return cached
  }

  const { systemPrompt, prompt } = getVideoSummaryPrompt(
    targetLanguage,
    sampleTranscript(transcript, VIDEO_SUMMARY_TRANSCRIPT_CHAR_BUDGET),
  )
  const payload =
    providerRef.kind === "system"
      ? {
          providerId: providerRef.providerId,
          modelTier: providerRef.modelTier,
          requestId: getRandomUUID(),
          hostedFeature: "videoSubtitles" as const,
          instructions: systemPrompt,
          prompt,
        }
      : {
          providerId: providerRef.config.id,
          providerConfig: providerRef.config,
          instructions: systemPrompt,
          prompt,
        }

  const snapshot = await streamBackgroundText(payload, {
    signal,
    onChunk: (chunk) => {
      if (!signal?.aborted) {
        onChunk?.(stripLeadingHeading(chunk.output.trim()))
      }
    },
  })
  signal?.throwIfAborted()

  const summary = stripLeadingHeading(snapshot.output.trim())
  if (!summary) {
    return null
  }

  await sendMessage("saveVideoSummary", {
    transcript,
    targetLanguage,
    providerRef,
    summary,
  })
  signal?.throwIfAborted()

  return summary
}
