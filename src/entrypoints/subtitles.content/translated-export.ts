export const TRANSLATED_EXPORT_PREPARING_PROGRESS_MAX = 30

export type TranslatedExportPhase = "preparing" | "translating"

export interface TranslatedExportProgress {
  phase: TranslatedExportPhase
  progress: number
}

export interface DownloadTranslatedSubtitlesOptions {
  onProgress?: (update: TranslatedExportProgress) => void
  signal?: AbortSignal
}

export function reportTranslatedExportTranslationProgress(
  translatedCount: number,
  totalCount: number,
  onProgress?: (update: TranslatedExportProgress) => void,
) {
  if (totalCount <= 0) {
    onProgress?.({ phase: "translating", progress: 100 })
    return
  }

  const translatingRange = 100 - TRANSLATED_EXPORT_PREPARING_PROGRESS_MAX
  const progress = TRANSLATED_EXPORT_PREPARING_PROGRESS_MAX
    + Math.round((translatedCount / totalCount) * translatingRange)

  onProgress?.({
    phase: "translating",
    progress: Math.min(100, progress),
  })
}
