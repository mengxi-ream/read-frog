import type { SubtitlesFragment } from "./types"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { getLocalConfig } from "@/utils/config/storage"
import { sendMessage } from "@/utils/message"
import { canProviderRefGenerateText } from "@/utils/providers/provider-ref"
import { resolveSubtitlesProviderRef } from "./processor/translator"

/** Shared so the panel, the menu entry and the adapter all name one cache. */
export const VIDEO_SUMMARY_QUERY_KEY = ["subtitles", "video-summary"] as const

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

/**
 * The subtitles provider list is gated on the wider translate capability, so
 * the default Microsoft provider is a legal choice there and then cannot be
 * prompted. Checked before the panel opens rather than after a request fails.
 */
export async function canGenerateVideoSummary(): Promise<boolean> {
  const config = await getLocalConfig()
  if (!config) {
    return false
  }
  const providerRef = await resolveSubtitlesProviderRef(config, "videoSubtitles")
  return !!providerRef && canProviderRefGenerateText(providerRef)
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

  const providerRef = await resolveSubtitlesProviderRef(config, "videoSubtitles")
  if (!providerRef || !canProviderRefGenerateText(providerRef)) {
    return null
  }

  const markdown = await sendMessage("getVideoSummary", {
    transcript,
    targetLanguage: LANG_CODE_TO_EN_NAME[config.language.targetCode],
    providerRef,
  })

  return markdown ? stripLeadingHeading(markdown.trim()) : null
}
