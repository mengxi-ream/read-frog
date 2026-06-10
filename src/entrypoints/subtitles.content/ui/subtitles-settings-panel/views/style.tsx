import type { ReactNode } from "react"
import type { BackgroundStyle, SubtitleMode, SubtitlesDisplayMode, SubtitlesFontFamily, SubtitlesTranslationPosition, SubtitleTextStyle } from "@/types/config/subtitles"
import { IconLanguage, IconRefresh, IconSettings, IconSubtitles } from "@tabler/icons-react"
import { deepmerge } from "deepmerge-ts"
import { useAtom } from "jotai"
import { Activity, use } from "react"
import { i18n } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/base-ui/select"
import { Slider } from "@/components/ui/base-ui/slider"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import {
  BACKGROUND_STYLE_OPTIONS,
  DEFAULT_BACKGROUND_FORCE_MERGE,
  DEFAULT_BACKGROUND_OPACITY,
  DEFAULT_DISPLAY_MODE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SCALE,
  DEFAULT_FONT_SHADOW_INTENSITY,
  DEFAULT_FONT_STROKE_WIDTH,
  DEFAULT_FONT_WEIGHT,
  DEFAULT_LINE_GAP,
  DEFAULT_PRESET_STYLE,
  DEFAULT_SUBTITLE_COLOR,
  DEFAULT_SUBTITLE_MODE,
  DEFAULT_TRANSLATION_POSITION,
  MAX_BACKGROUND_OPACITY,
  MAX_FONT_SCALE,
  MAX_FONT_SHADOW_INTENSITY,
  MAX_FONT_STROKE_WIDTH,
  MAX_FONT_WEIGHT,
  MAX_LINE_GAP,
  MIN_BACKGROUND_OPACITY,
  MIN_FONT_SCALE,
  MIN_FONT_SHADOW_INTENSITY,
  MIN_FONT_STROKE_WIDTH,
  MIN_FONT_WEIGHT,
  MIN_LINE_GAP,
  SUBTITLE_STYLE_PRESETS,
} from "@/utils/constants/subtitles"
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host"
import { subtitlesStore } from "../../../atoms"

const SELECT_TRIGGER_CLASS = "min-w-[5.5rem] text-[13px] text-popover-foreground [&_[data-slot=select-value]]:text-popover-foreground [&_[data-slot=select-icon]]:text-muted-foreground"
const SELECT_CONTENT_CLASS = "[&_[role=option]]:text-[13px]"
const SLIDER_CLASS = "[&_[role=slider]]:border-0 [&_[role=slider]]:shadow-[0_2px_4px_rgba(0,0,0,0.3)]"

const FONT_FAMILY_OPTIONS: { value: SubtitlesFontFamily, label: string }[] = [
  { value: "system", label: "System Default" },
  { value: "roboto", label: "Roboto" },
  { value: "noto-sans", label: "Noto Sans" },
  { value: "noto-serif", label: "Noto Serif" },
  { value: "misans", label: "MiSans" },
  { value: "ibm-plex", label: "IBM Plex" },
  { value: "tsuku-ard-gothic", label: "TsukuARdGothic Std" },
]

function SettingsGroup({ icon, title, onReset, children }: {
  icon: ReactNode
  title: string
  onReset: () => void
  children: ReactNode
}) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <div className="text-popover-foreground flex items-center gap-1.5 text-[13px] font-medium">
          {icon}
          {title}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onReset}
          className="text-muted-foreground hover:bg-accent/60 hover:text-popover-foreground cursor-pointer"
        >
          <IconRefresh className="size-3.5" />
        </Button>
      </div>
      <div className="bg-muted/50 divide-border rounded-xl border divide-y">
        {children}
      </div>
    </div>
  )
}

function SettingRow({ label, children }: { label: string, children: ReactNode }) {
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

function TextStyleGroup({ icon, title, textStyle, onChange, onReset, portalContainer, showAdvanced }: {
  icon: ReactNode
  title: string
  textStyle: SubtitleTextStyle
  onChange: (patch: Partial<SubtitleTextStyle>) => void
  onReset: () => void
  portalContainer: HTMLElement | null
  showAdvanced?: boolean
}) {
  return (
    <SettingsGroup icon={icon} title={title} onReset={onReset}>
      <SliderRow
        label={i18n.t("options.videoSubtitles.style.fontScale")}
        value={textStyle.fontScale}
        display={`${textStyle.fontScale}%`}
        min={MIN_FONT_SCALE}
        max={MAX_FONT_SCALE}
        step={10}
        onChange={v => onChange({ fontScale: v })}
      />

      {showAdvanced && (
        <SettingRow label={i18n.t("options.videoSubtitles.style.color")}>
          <input
            type="color"
            value={textStyle.color}
            onChange={e => onChange({ color: e.target.value })}
            className="border-input bg-background h-6 w-6 cursor-pointer rounded border p-0.5"
          />
        </SettingRow>
      )}

      <SettingRow label={i18n.t("options.videoSubtitles.style.fontFamily")}>
        <Select value={textStyle.fontFamily} onValueChange={v => v && onChange({ fontFamily: v as SubtitlesFontFamily })}>
          <SelectTrigger size="sm" className={SELECT_TRIGGER_CLASS}>
            <SelectValue>{FONT_FAMILY_OPTIONS.find(o => o.value === textStyle.fontFamily)?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent container={portalContainer} className={SELECT_CONTENT_CLASS}>
            <SelectGroup>
              {FONT_FAMILY_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </SettingRow>

      <SliderRow
        label={i18n.t("options.videoSubtitles.style.fontWeight")}
        value={textStyle.fontWeight}
        display={String(textStyle.fontWeight)}
        min={MIN_FONT_WEIGHT}
        max={MAX_FONT_WEIGHT}
        step={100}
        onChange={v => onChange({ fontWeight: v })}
      />

      {showAdvanced && (
        <SliderRow
          label={i18n.t("options.videoSubtitles.style.shadowIntensity")}
          value={textStyle.fontShadowIntensity}
          display={`${textStyle.fontShadowIntensity}px`}
          min={MIN_FONT_SHADOW_INTENSITY}
          max={MAX_FONT_SHADOW_INTENSITY}
          step={0.5}
          onChange={v => onChange({ fontShadowIntensity: v })}
        />
      )}

      {showAdvanced && (
        <SliderRow
          label={i18n.t("options.videoSubtitles.style.strokeWidth")}
          value={textStyle.fontStrokeWidth}
          display={`${textStyle.fontStrokeWidth}px`}
          min={MIN_FONT_STROKE_WIDTH}
          max={MAX_FONT_STROKE_WIDTH}
          step={0.5}
          onChange={v => onChange({ fontStrokeWidth: v })}
        />
      )}
    </SettingsGroup>
  )
}

const DEFAULT_TEXT_STYLE: SubtitleTextStyle = {
  fontFamily: DEFAULT_FONT_FAMILY,
  fontScale: DEFAULT_FONT_SCALE,
  color: DEFAULT_SUBTITLE_COLOR,
  fontWeight: DEFAULT_FONT_WEIGHT,
  fontShadowIntensity: DEFAULT_FONT_SHADOW_INTENSITY,
  fontStrokeWidth: DEFAULT_FONT_STROKE_WIDTH,
}

export function StyleView() {
  const [config, setConfig] = useAtom(configFieldsAtomMap.videoSubtitles, { store: subtitlesStore })
  const portalContainer = use(ShadowWrapperContext)
  const { displayMode, translationPosition, lineGap, backgroundForceMerge, mode, presetStyle, container } = config.style

  const updateStyle = (patch: Record<string, unknown>) => {
    void setConfig(deepmerge(config, { style: patch }))
  }

  const handleModeChange = (newMode: SubtitleMode) => {
    updateStyle({ mode: newMode })
  }

  const handlePresetChange = (index: number) => {
    const preset = SUBTITLE_STYLE_PRESETS[index]
    updateStyle({
      presetStyle: index,
      lineGap: preset.lineGap,
      backgroundForceMerge: preset.backgroundForceMerge,
      container: {
        backgroundStyle: preset.backgroundStyle,
        backgroundOpacity: preset.backgroundOpacity,
      },
    })
  }

  const isAdvanced = mode === "advanced"

  return (
    <div className="min-h-[calc(100cqh-6rem)] px-3 pb-4 pt-3">
      <SettingsGroup
        icon={<IconSettings className="size-3.5" />}
        title={i18n.t("options.videoSubtitles.style.generalSettings")}
        onReset={() => updateStyle({
          displayMode: DEFAULT_DISPLAY_MODE,
          translationPosition: DEFAULT_TRANSLATION_POSITION,
          lineGap: DEFAULT_LINE_GAP,
          mode: DEFAULT_SUBTITLE_MODE,
          presetStyle: DEFAULT_PRESET_STYLE,
          backgroundForceMerge: DEFAULT_BACKGROUND_FORCE_MERGE,
          container: { backgroundOpacity: DEFAULT_BACKGROUND_OPACITY, backgroundStyle: undefined },
        })}
      >
        <SettingRow label={i18n.t("options.videoSubtitles.style.displayMode.title")}>
          <Select value={displayMode} onValueChange={(v: SubtitlesDisplayMode | null) => v && updateStyle({ displayMode: v })}>
            <SelectTrigger size="sm" className={SELECT_TRIGGER_CLASS}>
              <SelectValue>{i18n.t(`options.videoSubtitles.style.displayMode.${displayMode}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent container={portalContainer} className={SELECT_CONTENT_CLASS}>
              <SelectGroup>
                <SelectItem value="bilingual">{i18n.t("options.videoSubtitles.style.displayMode.bilingual")}</SelectItem>
                <SelectItem value="originalOnly">{i18n.t("options.videoSubtitles.style.displayMode.originalOnly")}</SelectItem>
                <SelectItem value="translationOnly">{i18n.t("options.videoSubtitles.style.displayMode.translationOnly")}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </SettingRow>

        <Activity mode={displayMode === "bilingual" ? "visible" : "hidden"}>
          <SettingRow label={i18n.t("options.videoSubtitles.style.translationPosition.title")}>
            <Select value={translationPosition} onValueChange={(v: SubtitlesTranslationPosition | null) => v && updateStyle({ translationPosition: v })}>
              <SelectTrigger size="sm" className={SELECT_TRIGGER_CLASS}>
                <SelectValue>{i18n.t(`options.videoSubtitles.style.translationPosition.${translationPosition}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent container={portalContainer} className={SELECT_CONTENT_CLASS}>
                <SelectGroup>
                  <SelectItem value="above">{i18n.t("options.videoSubtitles.style.translationPosition.above")}</SelectItem>
                  <SelectItem value="below">{i18n.t("options.videoSubtitles.style.translationPosition.below")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </SettingRow>
        </Activity>

        <SettingRow label={i18n.t("options.videoSubtitles.style.mode")}>
          <div className="flex gap-1 rounded-lg bg-muted p-0.5">
            {(["basic", "advanced"] as const).map(m => (
              <Button
                key={m}
                type="button"
                variant={mode === m ? "default" : "ghost"}
                size="sm"
                className="flex-1 text-[13px]"
                onClick={() => handleModeChange(m)}
              >
                {i18n.t(`options.videoSubtitles.style.modeOptions.${m}`)}
              </Button>
            ))}
          </div>
        </SettingRow>

        {!isAdvanced && (
          <SettingRow label={i18n.t("options.videoSubtitles.style.presetStyle")}>
            <Select value={String(presetStyle)} onValueChange={v => handlePresetChange(Number(v))}>
              <SelectTrigger size="sm" className={SELECT_TRIGGER_CLASS}>
                <SelectValue>{SUBTITLE_STYLE_PRESETS[presetStyle]?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent container={portalContainer} className={SELECT_CONTENT_CLASS}>
                <SelectGroup>
                  {SUBTITLE_STYLE_PRESETS.map((p, i) => (
                    <SelectItem key={i} value={String(i)}>{p.label}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </SettingRow>
        )}

        {isAdvanced && (
          <>
            <SettingRow label="Background Style">
              <Select value={container.backgroundStyle ?? "solid"} onValueChange={(v: string | null) => v && updateStyle({ container: { backgroundStyle: v as BackgroundStyle } })}>
                <SelectTrigger size="sm" className={SELECT_TRIGGER_CLASS}>
                  <SelectValue>{BACKGROUND_STYLE_OPTIONS.find(o => o.value === (container.backgroundStyle ?? "solid"))?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent container={portalContainer} className={SELECT_CONTENT_CLASS}>
                  <SelectGroup>
                    {BACKGROUND_STYLE_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </SettingRow>

            <SliderRow
              label={i18n.t("options.videoSubtitles.style.backgroundOpacity")}
              value={container.backgroundOpacity}
              display={`${container.backgroundOpacity}%`}
              min={MIN_BACKGROUND_OPACITY}
              max={MAX_BACKGROUND_OPACITY}
              step={5}
              onChange={v => updateStyle({ container: { backgroundOpacity: v } })}
            />

            <SettingRow label={i18n.t("options.videoSubtitles.style.backgroundForceMerge")}>
              <Switch
                checked={backgroundForceMerge ?? false}
                onCheckedChange={v => updateStyle({ backgroundForceMerge: v })}
              />
            </SettingRow>

            <SliderRow
              label={i18n.t("options.videoSubtitles.style.lineGap")}
              value={lineGap}
              display={`${lineGap}px`}
              min={MIN_LINE_GAP}
              max={MAX_LINE_GAP}
              step={1}
              onChange={v => updateStyle({ lineGap: v })}
            />
          </>
        )}
      </SettingsGroup>

      <TextStyleGroup
        icon={<IconSubtitles className="size-3.5" />}
        title={i18n.t("options.videoSubtitles.style.mainSubtitle")}
        textStyle={config.style.main}
        onChange={patch => updateStyle({ main: patch })}
        onReset={() => updateStyle({ main: DEFAULT_TEXT_STYLE })}
        portalContainer={portalContainer}
        showAdvanced={isAdvanced}
      />

      <TextStyleGroup
        icon={<IconLanguage className="size-3.5" />}
        title={i18n.t("options.videoSubtitles.style.translationSubtitle")}
        textStyle={config.style.translation}
        onChange={patch => updateStyle({ translation: patch })}
        onReset={() => updateStyle({ translation: DEFAULT_TEXT_STYLE })}
        portalContainer={portalContainer}
        showAdvanced={isAdvanced}
      />
    </div>
  )
}
