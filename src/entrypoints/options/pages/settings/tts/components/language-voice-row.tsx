import { useCallback } from "react"

export interface LanguageVoiceOption {
  label: string
  value: string
}

interface PreviewPayload {
  language: string
  voice: string
}

interface LanguageVoiceRowProps {
  languageOptions: LanguageVoiceOption[]
  voiceOptions: LanguageVoiceOption[]
  selectedLanguage: string
  selectedVoice: string
  onLanguageChange: (value: string) => void
  onVoiceChange: (value: string) => void
  onPreview?: (payload: PreviewPayload) => void
  previewLabel?: string
  className?: string
}

export function LanguageVoiceRow({
  languageOptions,
  voiceOptions,
  selectedLanguage,
  selectedVoice,
  onLanguageChange,
  onVoiceChange,
  onPreview,
  previewLabel = "Preview",
  className,
}: LanguageVoiceRowProps) {
  const canPreview = Boolean(selectedLanguage && selectedVoice && onPreview)

  const handlePreview = useCallback(() => {
    if (!onPreview || !selectedLanguage || !selectedVoice)
      return

    onPreview({
      language: selectedLanguage,
      voice: selectedVoice,
    })
  }, [onPreview, selectedLanguage, selectedVoice])

  return (
    <div className={className ?? ""}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm font-medium">Language</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={selectedLanguage}
            onChange={e => onLanguageChange(e.target.value)}
          >
            {languageOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm font-medium">Language Voice</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
              value={selectedVoice}
              onChange={e => onVoiceChange(e.target.value)}
            >
              {voiceOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="h-9 rounded-md border px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canPreview}
              onClick={handlePreview}
            >
              {previewLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
