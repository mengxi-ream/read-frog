import type { SubtitleTtsConfig, SubtitleTtsReadTarget, SubtitleTtsVoiceMode } from "@/types/config/subtitles"
import { IconSpeakerphone } from "@tabler/icons-react"
import { deepmerge } from "deepmerge-ts"
import { useAtom } from "jotai"
import { Activity, use } from "react"
import { i18n } from "#imports"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/base-ui/select"
import { Slider } from "@/components/ui/base-ui/slider"
import { Switch } from "@/components/ui/base-ui/switch"
import { DEFAULT_SUBTITLE_TTS_CONFIG } from "@/types/config/subtitles"
import { EDGE_TTS_VOICE_GROUPS, MAX_TTS_RATE, MIN_TTS_RATE } from "@/types/config/tts"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host"
import { subtitlesStore } from "../../../atoms"
import { SubtitlesSettingsItem } from "../components/subtitles-settings-item"

const SELECT_TRIGGER_CLASS = "min-w-[5.5rem] text-[13px] text-popover-foreground [&_[data-slot=select-value]]:text-popover-foreground [&_[data-slot=select-icon]]:text-muted-foreground"
const SELECT_CONTENT_CLASS = "[&_[role=option]]:text-[13px]"
const SLIDER_CLASS = "[&_[role=slider]]:border-0 [&_[role=slider]]:shadow-[0_2px_4px_rgba(0,0,0,0.3)]"

function SettingRow({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="text-popover-foreground text-[13px]">{label}</span>
      {children}
    </div>
  )
}

function SliderRow({ label, value, display, min, max, step, onChange }: {
  label: string
  value: number
  display: string
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div className="px-3 py-2.5">
      <div className="mb-3.5 flex items-center justify-between">
        <span className="text-popover-foreground text-[13px]">{label}</span>
        <span className="text-muted-foreground text-[12px]">{display}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        onValueChange={v => onChange(v as number)}
        className={SLIDER_CLASS}
      />
    </div>
  )
}

export function TTSView() {
  const [config, setConfig] = useAtom(configFieldsAtomMap.videoSubtitles, { store: subtitlesStore })
  const portalContainer = use(ShadowWrapperContext)
  const tts: SubtitleTtsConfig = config.tts ?? DEFAULT_SUBTITLE_TTS_CONFIG

  const updateTts = (patch: Partial<SubtitleTtsConfig>) => {
    void setConfig(deepmerge(config, { tts: patch }))
  }

  return (
    <div className="min-h-[calc(100cqh-6rem)] px-3 pb-4 pt-3">
      {/* Enable toggle */}
      <div className="bg-muted/50 divide-border mb-4 rounded-xl border divide-y">
        <SubtitlesSettingsItem
          icon={<IconSpeakerphone className="size-4" />}
          label={i18n.t("options.videoSubtitles.tts.enable")}
          labelFor="read-frog-subtitle-tts-toggle"
        >
          <Switch
            id="read-frog-subtitle-tts-toggle"
            checked={tts.enabled}
            onCheckedChange={checked => updateTts({ enabled: checked })}
            aria-label={i18n.t("options.videoSubtitles.tts.enable")}
          />
        </SubtitlesSettingsItem>
      </div>

      <Activity mode={tts.enabled ? "visible" : "hidden"}>
        <div className="bg-muted/50 divide-border mb-4 rounded-xl border divide-y">
          <SettingRow label={i18n.t("options.videoSubtitles.tts.readTarget.title")}>
            <Select
              value={tts.readTarget}
              onValueChange={(v: SubtitleTtsReadTarget | null) => v && updateTts({ readTarget: v })}
            >
              <SelectTrigger size="sm" className={SELECT_TRIGGER_CLASS}>
                <SelectValue>{i18n.t(`options.videoSubtitles.tts.readTarget.${tts.readTarget}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent container={portalContainer} className={SELECT_CONTENT_CLASS}>
                <SelectGroup>
                  <SelectItem value="translation">{i18n.t("options.videoSubtitles.tts.readTarget.translation")}</SelectItem>
                  <SelectItem value="original">{i18n.t("options.videoSubtitles.tts.readTarget.original")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow label={i18n.t("options.videoSubtitles.tts.voiceMode.title")}>
            <Select
              value={tts.voiceMode}
              onValueChange={(v: SubtitleTtsVoiceMode | null) => v && updateTts({ voiceMode: v })}
            >
              <SelectTrigger size="sm" className={SELECT_TRIGGER_CLASS}>
                <SelectValue>{i18n.t(`options.videoSubtitles.tts.voiceMode.${tts.voiceMode}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent container={portalContainer} className={SELECT_CONTENT_CLASS}>
                <SelectGroup>
                  <SelectItem value="auto">{i18n.t("options.videoSubtitles.tts.voiceMode.auto")}</SelectItem>
                  <SelectItem value="custom">{i18n.t("options.videoSubtitles.tts.voiceMode.custom")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </SettingRow>

          <Activity mode={tts.voiceMode === "custom" ? "visible" : "hidden"}>
            <SettingRow label={i18n.t("options.videoSubtitles.tts.voiceMode.custom")}>
              <Select
                value={tts.customVoice || undefined}
                onValueChange={v => v && updateTts({ customVoice: v })}
              >
                <SelectTrigger size="sm" className="min-w-[8rem] text-[13px] text-popover-foreground [&_[data-slot=select-value]]:text-popover-foreground [&_[data-slot=select-icon]]:text-muted-foreground">
                  <SelectValue placeholder={tts.customVoice || "—"}>
                    {tts.customVoice || "—"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent container={portalContainer} className={SELECT_CONTENT_CLASS}>
                  {EDGE_TTS_VOICE_GROUPS.map(group => (
                    <SelectGroup key={group.language}>
                      <span className="text-muted-foreground px-2 py-1 text-[11px] font-medium">{group.language}</span>
                      {group.items.slice(0, 8).map(item => (
                        <SelectItem key={item.voice} value={item.voice}>{item.voice}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>
          </Activity>

          <SliderRow
            label={i18n.t("options.videoSubtitles.tts.rate")}
            value={tts.rate}
            display={`${tts.rate >= 0 ? "+" : ""}${tts.rate}%`}
            min={MIN_TTS_RATE}
            max={MAX_TTS_RATE}
            step={10}
            onChange={v => updateTts({ rate: v })}
          />
        </div>

        <div className="bg-muted/50 divide-border rounded-xl border divide-y">
          <SubtitlesSettingsItem
            icon={<IconSpeakerphone className="size-4" />}
            label={i18n.t("options.videoSubtitles.tts.pauseWithVideo")}
            labelFor="read-frog-subtitle-tts-pause"
          >
            <Switch
              id="read-frog-subtitle-tts-pause"
              checked={tts.pauseWithVideo}
              onCheckedChange={checked => updateTts({ pauseWithVideo: checked })}
              aria-label={i18n.t("options.videoSubtitles.tts.pauseWithVideo")}
            />
          </SubtitlesSettingsItem>
        </div>
      </Activity>
    </div>
  )
}
