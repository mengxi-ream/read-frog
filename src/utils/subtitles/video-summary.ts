import type { SubtitlesFragment } from "./types"
import type { ProvidersConfig } from "@/types/config/provider"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { getLocalConfig } from "@/utils/config/storage"
import { sendMessage } from "@/utils/message"
import { resolveProviderRefForCapability } from "@/utils/providers/provider-registry"
import { resolveSubtitlesProvider, resolveSubtitlesProviderRef } from "./processor/translator"

const VIDEO_SUMMARY_QUERY_SCOPE = ["subtitles", "video-summary"] as const

/**
 * An edited local model keeps its id, so the id alone would serve its predecessor's
 * summary forever. A hosted `modelRevision` is out of reach here; the background key has it.
 */
function providerIdentity(providersConfig: ProvidersConfig, providerId: string): string {
  const resolved = resolveProviderRefForCapability("videoSubtitles", providersConfig, providerId)
  if (!resolved) {
    return providerId
  }
  return resolved.kind === "local"
    ? JSON.stringify(resolved.config)
    : JSON.stringify({ providerId: resolved.id, modelTier: resolved.modelTier })
}

/** Keyed by video, so same-video changes — caption track, native/AI source — reuse the summary. */
export function videoSummaryQueryKey(
  videoId: string | null,
  targetCode: string,
  providersConfig: ProvidersConfig,
  providerId: string,
) {
  return [
    ...VIDEO_SUMMARY_QUERY_SCOPE,
    videoId,
    targetCode,
    providerIdentity(providersConfig, providerId),
  ] as const
}

/** Matches every language/provider pair, for dropping the lot at once. */
export const VIDEO_SUMMARY_QUERY_SCOPE_KEY = VIDEO_SUMMARY_QUERY_SCOPE

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

export async function requestVideoSummary(fragments: SubtitlesFragment[]): Promise<string | null> {
  const transcript = buildTranscript(fragments)
  if (!transcript) {
    return null
  }

  const config = await getLocalConfig()
  if (!config) {
    return null
  }

  const providerRef = await resolveSubtitlesProviderRef(config, "summary")
  if (!providerRef) {
    return null
  }

  const markdown = await sendMessage("getVideoSummary", {
    transcript,
    targetLanguage: LANG_CODE_TO_EN_NAME[config.language.targetCode],
    providerRef,
  })

  return markdown ? stripLeadingHeading(markdown.trim()) : null
}
