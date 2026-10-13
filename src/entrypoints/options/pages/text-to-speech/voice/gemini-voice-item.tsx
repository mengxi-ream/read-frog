import type { GeminiTTSVoice, GeminiTTSVoiceGender, GeminiTTSVoicePitch } from "@/types/gemini-tts"
import {
  IconCheck,
  IconLoader2,
  IconPlayerPlayFilled,
  IconPlayerStopFilled,
  IconSearch,
} from "@tabler/icons-react"
import { skipToken, useQuery } from "@tanstack/react-query"
import { useAtom, useAtomValue } from "jotai"
import { useId, useMemo, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/base-ui/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { useTextToSpeech } from "@/hooks/use-text-to-speech"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { GEMINI_TTS_FALLBACK_VOICES } from "@/types/config/tts"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getUiLocale, i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"
import { cn } from "@/utils/styles/utils"
import { resolveGeminiTTSProvider } from "@/utils/tts/gemini-providers"
import { ConfigItem } from "../../../components/config-item"
import { SELECT_CONTENT_PROPS } from "../../../components/select-content-props"

const ALL = "all"
// Each use case shows a few voices until it is opened, so every group stays in reach.
const COLLAPSED_GROUP_SIZE = 3
const GENDERS: GeminiTTSVoiceGender[] = ["female", "male", "neutral"]
const PITCHES: GeminiTTSVoicePitch[] = ["low", "medium", "high"]

interface VoiceFilters {
  language: string
  gender: string
  pitch: string
  useCase: string
}

const NO_FILTERS: VoiceFilters = { language: ALL, gender: ALL, pitch: ALL, useCase: ALL }

const languageNamesByLocale = new Map<string, Map<string, string>>()

/**
 * A voice's language named in the interface language, which can differ from the browser's. Each
 * name is looked up once per locale: search and every rendered row ask for it, across ~2000 voices.
 */
function getVoiceLanguageName(languageCode: string, locale: string): string {
  if (!languageCode) {
    return ""
  }
  let names = languageNamesByLocale.get(locale)
  if (!names) {
    names = new Map()
    languageNamesByLocale.set(locale, names)
  }
  let name = names.get(languageCode)
  if (name === undefined) {
    try {
      name = new Intl.DisplayNames(locale, { type: "language" }).of(languageCode) ?? languageCode
    } catch {
      name = languageCode
    }
    names.set(languageCode, name)
  }
  return name
}

/** Voice ids are matched without case: the stored default is "kore", the library may say "Kore". */
function isSameVoice(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/**
 * The whole voice library, listed with the selected Google provider's key. The classic voices
 * stand in while it loads, without a key, or when the list cannot be fetched.
 */
function useGeminiTTSVoices() {
  const ttsConfig = useAtomValue(configFieldsAtomMap.tts)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const providerConfig = resolveGeminiTTSProvider(providersConfig, ttsConfig.gemini.providerId)
  const apiKey = providerConfig?.apiKey?.trim() ?? ""

  const query = useQuery({
    // oxlint-disable-next-line query/exhaustive-deps -- The library depends on the account and the route to it; the provider's name or chat model must not refetch it.
    queryKey: [
      "gemini-tts-voices",
      { apiKey, baseURL: providerConfig?.baseURL, headers: providerConfig?.headers },
    ],
    queryFn:
      providerConfig && apiKey
        ? async () => {
            const response = await sendMessage("geminiTtsListVoices", { providerConfig })
            if (!response.ok) {
              throw new Error(`[${response.error.code}] ${response.error.message}`)
            }
            return response.voices
          }
        : skipToken,
    staleTime: 1000 * 60 * 60,
    // Kept as long as it stays fresh, so coming back to this page does not page through it again.
    gcTime: 1000 * 60 * 60,
    retry: 1,
    meta: {
      suppressToast: true,
    },
  })

  const voices = query.data && query.data.length > 0 ? query.data : GEMINI_TTS_FALLBACK_VOICES
  return { voices, isLoading: query.isLoading, isError: query.isError }
}

function getVoiceSearchText(voice: GeminiTTSVoice, locale: string): string {
  return [
    voice.name,
    voice.description,
    voice.accent,
    voice.useCase,
    voice.languageCode,
    getVoiceLanguageName(voice.languageCode, locale),
  ]
    .join(" ")
    .toLowerCase()
}

function matchesVoice(
  voice: GeminiTTSVoice,
  searchText: string,
  search: string,
  filters: VoiceFilters,
): boolean {
  if (filters.language !== ALL && voice.languageCode !== filters.language) return false
  if (filters.gender !== ALL && voice.gender !== filters.gender) return false
  if (filters.pitch !== ALL && voice.pitch !== filters.pitch) return false
  if (filters.useCase !== ALL && voice.useCase !== filters.useCase) return false
  return !search || searchText.includes(search)
}

/** Use cases with the most voices first, and voices by name inside each. */
function groupVoicesByUseCase(voices: GeminiTTSVoice[]): [string, GeminiTTSVoice[]][] {
  const groups = new Map<string, GeminiTTSVoice[]>()
  for (const voice of voices) {
    const group = groups.get(voice.useCase)
    if (group) {
      group.push(voice)
      continue
    }
    groups.set(voice.useCase, [voice])
  }

  return [...groups]
    .map(([category, items]) => {
      const sorted = items.toSorted((a, b) => a.name.localeCompare(b.name))
      return [category, sorted] as [string, GeminiTTSVoice[]]
    })
    .toSorted((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
}

function getPitchLabel(pitch: GeminiTTSVoicePitch): string {
  return i18n.t(`options.tts.voice.gemini.pitch.${pitch}`)
}

function getGenderLabel(gender: GeminiTTSVoiceGender): string {
  return i18n.t(`options.tts.voice.gemini.gender.${gender}`)
}

/** Plays a voice; while that voice loads or plays it stops it, and says so like the speak button. */
function PreviewButton({
  isActive,
  isBusy,
  voiceNameId,
  onClick,
}: {
  isActive: boolean
  isBusy: boolean
  /** The voice's name on screen, so each row's button says which voice it plays. */
  voiceNameId: string
  onClick: () => void
}) {
  const label = !isActive
    ? i18n.t("action.speak")
    : isBusy
      ? i18n.t("speak.fetchingAudio")
      : i18n.t("action.playing")

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className="shrink-0 rounded-full"
      aria-label={label}
      aria-describedby={voiceNameId}
      title={label}
      onClick={onClick}
    >
      {isActive && isBusy ? (
        <IconLoader2 className="animate-spin" />
      ) : isActive ? (
        <IconPlayerStopFilled />
      ) : (
        <IconPlayerPlayFilled />
      )}
    </Button>
  )
}

/**
 * The one voice Gemini reads every language in, picked from its library the way AI Studio lays it
 * out: the current voice up top, then a search, filters, and the voices grouped by use case.
 */
export function GeminiVoiceItem() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)
  const { voices, isLoading, isError } = useGeminiTTSVoices()
  const { play, stop, isFetching, isPlaying } = useTextToSpeech(ANALYTICS_SURFACE.TTS_SETTINGS)
  const [previewVoice, setPreviewVoice] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filters, setFilters] = useState<VoiceFilters>(NO_FILTERS)
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(new Set())
  const currentVoiceNameId = useId()
  const uiLocale = getUiLocale()

  const isPreviewBusy = isFetching || isPlaying
  const activePreviewVoice = isPreviewBusy ? previewVoice : null
  const currentVoice =
    voices.find((voice) => isSameVoice(voice.voice, ttsConfig.gemini.voice)) ??
    GEMINI_TTS_FALLBACK_VOICES.find((voice) => isSameVoice(voice.voice, ttsConfig.gemini.voice))

  const languageOptions = useMemo(
    () =>
      [...new Set(voices.map((voice) => voice.languageCode))]
        .filter((code) => code !== "")
        .map((code) => ({ value: code, label: getVoiceLanguageName(code, uiLocale) }))
        .toSorted((a, b) => a.label.localeCompare(b.label, uiLocale)),
    [voices, uiLocale],
  )
  const categoryOptions = useMemo(
    () => groupVoicesByUseCase(voices).map(([category]) => ({ value: category, label: category })),
    [voices],
  )
  const searchTexts = useMemo(
    () => new Map(voices.map((voice) => [voice, getVoiceSearchText(voice, uiLocale)])),
    [voices, uiLocale],
  )

  // A filter whose option has left the list (the classic voices stood in, or another provider's
  // library loaded) would empty it while its select read as unset, so it counts as unset.
  const language = languageOptions.some((option) => option.value === filters.language)
    ? filters.language
    : ALL
  const useCase = categoryOptions.some((option) => option.value === filters.useCase)
    ? filters.useCase
    : ALL
  const { gender, pitch } = filters

  const normalizedSearch = search.trim().toLowerCase()
  const groups = useMemo(
    () =>
      groupVoicesByUseCase(
        voices.filter((voice) =>
          matchesVoice(voice, searchTexts.get(voice) ?? "", normalizedSearch, {
            language,
            gender,
            pitch,
            useCase,
          }),
        ),
      ),
    [voices, searchTexts, normalizedSearch, language, gender, pitch, useCase],
  )

  const togglePreview = (voice: string) => {
    if (activePreviewVoice === voice) {
      stop()
      return
    }
    setPreviewVoice(voice)
    void play(i18n.t("options.tts.voice.language.previewSample"), {
      ...ttsConfig,
      gemini: { ...ttsConfig.gemini, voice },
    })
  }

  const selectVoice = (voice: string) => {
    void setTtsConfig({ gemini: { ...ttsConfig.gemini, voice } })
  }

  const toggleGroup = (category: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  return (
    <ConfigItem
      id="tts-gemini-voice"
      orientation="vertical"
      title={i18n.t("options.tts.voice.gemini.title")}
      description={i18n.t("options.tts.voice.gemini.description")}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">
              {i18n.t("options.tts.voice.gemini.currentVoice")}
            </div>
            <div id={currentVoiceNameId} className="truncate text-base font-medium">
              {currentVoice?.name ?? ttsConfig.gemini.voice}
            </div>
            {currentVoice && (
              <div className="line-clamp-2 text-xs text-muted-foreground">
                {currentVoice.description}
              </div>
            )}
          </div>
          <PreviewButton
            isActive={activePreviewVoice === ttsConfig.gemini.voice}
            isBusy={isFetching}
            voiceNameId={currentVoiceNameId}
            onClick={() => togglePreview(ttsConfig.gemini.voice)}
          />
        </div>

        <InputGroup>
          <InputGroupInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={i18n.t("options.tts.voice.gemini.searchPlaceholder", [voices.length])}
            aria-label={i18n.t("options.tts.voice.gemini.searchPlaceholder", [voices.length])}
          />
          <InputGroupAddon>
            {isLoading ? (
              <IconLoader2 className="size-4 animate-spin text-muted-foreground" />
            ) : (
              <IconSearch className="size-4 text-muted-foreground" />
            )}
          </InputGroupAddon>
        </InputGroup>

        <div className="flex flex-wrap gap-2">
          <FilterSelect
            label={i18n.t("options.tts.voice.gemini.filters.language")}
            value={language}
            options={languageOptions}
            onValueChange={(value) => setFilters({ ...filters, language: value })}
          />
          <FilterSelect
            label={i18n.t("options.tts.voice.gemini.filters.gender")}
            value={gender}
            options={GENDERS.map((value) => ({ value, label: getGenderLabel(value) }))}
            onValueChange={(value) => setFilters({ ...filters, gender: value })}
          />
          <FilterSelect
            label={i18n.t("options.tts.voice.gemini.filters.pitch")}
            value={pitch}
            options={PITCHES.map((value) => ({ value, label: getPitchLabel(value) }))}
            onValueChange={(value) => setFilters({ ...filters, pitch: value })}
          />
          <FilterSelect
            label={i18n.t("options.tts.voice.gemini.filters.useCase")}
            value={useCase}
            options={categoryOptions}
            onValueChange={(value) => setFilters({ ...filters, useCase: value })}
          />
        </div>

        {isError && (
          <p className="text-xs text-muted-foreground">
            {i18n.t("options.tts.voice.gemini.loadFailed")}
          </p>
        )}

        <div className="max-h-[28rem] overflow-y-auto rounded-lg border">
          {groups.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {i18n.t("options.tts.voice.noVoicesFound")}
            </p>
          ) : (
            groups.map(([category, groupVoices]) => {
              const isExpanded = expandedGroups.has(category)
              const shownVoices = isExpanded
                ? groupVoices
                : groupVoices.slice(0, COLLAPSED_GROUP_SIZE)
              return (
                <section key={category} className="border-b py-2 last:border-b-0">
                  <div className="flex items-center justify-between gap-2 px-4 py-1.5">
                    <h4 className="text-sm font-medium">{category}</h4>
                    {groupVoices.length > COLLAPSED_GROUP_SIZE && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => toggleGroup(category)}
                      >
                        {isExpanded
                          ? i18n.t("options.tts.voice.gemini.showLess")
                          : i18n.t("options.tts.voice.gemini.viewAll", [groupVoices.length])}
                      </Button>
                    )}
                  </div>
                  {shownVoices.map((voice) => (
                    <VoiceRow
                      key={voice.voice}
                      voice={voice}
                      languageName={getVoiceLanguageName(voice.languageCode, uiLocale)}
                      isSelected={isSameVoice(voice.voice, ttsConfig.gemini.voice)}
                      isPreviewing={activePreviewVoice === voice.voice}
                      isPreviewBusy={isFetching}
                      onSelect={() => selectVoice(voice.voice)}
                      onPreview={() => togglePreview(voice.voice)}
                    />
                  ))}
                </section>
              )
            })
          )}
        </div>
      </div>
    </ConfigItem>
  )
}

function VoiceRow({
  voice,
  languageName,
  isSelected,
  isPreviewing,
  isPreviewBusy,
  onSelect,
  onPreview,
}: {
  voice: GeminiTTSVoice
  languageName: string
  isSelected: boolean
  isPreviewing: boolean
  isPreviewBusy: boolean
  onSelect: () => void
  onPreview: () => void
}) {
  const nameId = useId()

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2 transition-colors hover:bg-muted",
        isSelected && "bg-muted",
      )}
    >
      {/* One voice among many is current, so the row says so rather than toggling on and off. */}
      <button
        type="button"
        className="min-w-0 flex-1 cursor-pointer text-left outline-none focus-visible:underline"
        aria-current={isSelected || undefined}
        onClick={onSelect}
      >
        <div className="flex items-center gap-1.5">
          <span id={nameId} className="truncate text-sm font-medium">
            {voice.name}
          </span>
          {languageName && (
            <span className="shrink-0 text-xs text-muted-foreground">{languageName}</span>
          )}
          {isSelected && <IconCheck className="size-4 shrink-0 text-primary" />}
        </div>
        <div className="line-clamp-1 text-xs text-muted-foreground">
          {voice.description} · {getPitchLabel(voice.pitch)}
        </div>
      </button>
      <PreviewButton
        isActive={isPreviewing}
        isBusy={isPreviewBusy}
        voiceNameId={nameId}
        onClick={onPreview}
      />
    </div>
  )
}

function FilterSelect({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onValueChange: (value: string) => void
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label ?? label

  return (
    <Select
      value={value}
      onValueChange={(next: string | null) => {
        if (!next) return
        onValueChange(next)
      }}
    >
      <SelectTrigger size="sm" aria-label={label}>
        <SelectValue render={<span />}>{selectedLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent {...SELECT_CONTENT_PROPS}>
        <SelectGroup>
          <SelectItem value={ALL}>{i18n.t("options.tts.voice.gemini.filters.all")}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
