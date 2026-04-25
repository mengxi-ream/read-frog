import type { ReactNode } from "react"
import type { SubtitlesDisplayMode, SubtitlesFontFamily, SubtitlesTranslationPosition, SubtitleTextStyle } from "@/types/config/subtitles"
import { i18n } from "#imports"
import { IconLanguage, IconRefresh, IconSettings, IconSubtitles } from "@tabler/icons-react"
import { deepmerge } from "deepmerge-ts"
import { useAtom } from "jotai"
import { Activity, use } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/base-ui/select"
import { Slider } from "@/components/ui/base-ui/slider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import {
  DEFAULT_BACKGROUND_OPACITY,
  DEFAULT_DISPLAY_MODE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SCALE,
  DEFAULT_FONT_WEIGHT,
  DEFAULT_SUBTITLE_COLOR,
  DEFAULT_TRANSLATION_POSITION,
  MAX_BACKGROUND_OPACITY,
  MAX_FONT_SCALE,
  MAX_FONT_WEIGHT,
  MIN_BACKGROUND_OPACITY,
  MIN_FONT_SCALE,
  MIN_FONT_WEIGHT,
  SUBTITLE_FONT_FAMILIES,
} from "@/utils/constants/subtitles"
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host"
import { subtitlesStore } from "../../../atoms"

const SELECT_TRIGGER_CLASS = "min-w-[5.5rem] text-[13px] [&_[data-slot=select-value]]:text-white/92"
const SELECT_CONTENT_CLASS = "[&_[role=option]]:text-[13px]"
const SLIDER_CLASS = "[&_[role=slider]]:border-0 [&_[role=slider]]:shadow-[0_2px_4px_rgba(0,0,0,0.3)]"

const FONT_FAMILY_OPTIONS = Object.keys(SUBTITLE_FONT_FAMILIES) as SubtitlesFontFamily[]

function SettingsGroup({ icon, title, onReset, children }: {
  icon: ReactNode
  title: string
  onReset: () => void
  children: ReactNode
}) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-white/90">
          {icon}
          {title}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onReset}
          className="cursor-pointer text-white/62 hover:bg-white/8 hover:text-white/90"
        >
          <IconRefresh className="size-3.5" />
        </Button>
      </div>
      <div className="divide-y divide-white/6 rounded-xl bg-white/[0.04]">
        {children}
      </div>
    </div>
  )
}

function SettingRow({ label, children }: { label: string, children: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="text-[13px] text-white/92">{label}</span>
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
        <span className="text-[13px] text-white/92">{label}</span>
        <span className="text-[12px] text-white/62">{display}</span>
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

function TextStyleGroup({ icon, title, textStyle, onChange, onReset, portalContainer }: {
  icon: ReactNode
  title: string
  textStyle: SubtitleTextStyle
  onChange: (patch: Partial<SubtitleTextStyle>) => void
  onReset: () => void
  portalContainer: HTMLElement | null
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

      <SettingRow label={i18n.t("options.videoSubtitles.style.color")}>
        <input
          type="color"
          value={textStyle.color}
          onChange={e => onChange({ color: e.target.value })}
          className="h-6 w-6 cursor-pointer rounded border border-white/15 bg-transparent p-0.5"
        />
      </SettingRow>

      <SettingRow label={i18n.t("options.videoSubtitles.style.fontFamily")}>
        <Select value={textStyle.fontFamily} onValueChange={v => v && onChange({ fontFamily: v as SubtitlesFontFamily })}>
          <SelectTrigger variant="dark" size="sm" className={SELECT_TRIGGER_CLASS}>
            <SelectValue>{textStyle.fontFamily}</SelectValue>
          </SelectTrigger>
          <SelectContent variant="dark" container={portalContainer} className={SELECT_CONTENT_CLASS}>
            <SelectGroup>
              {FONT_FAMILY_OPTIONS.map(key => (
                <SelectItem key={key} variant="dark" value={key}>{key}</SelectItem>
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
    </SettingsGroup>
  )
}

const DEFAULT_TEXT_STYLE: SubtitleTextStyle = {
  fontFamily: DEFAULT_FONT_FAMILY,
  fontScale: DEFAULT_FONT_SCALE,
  color: DEFAULT_SUBTITLE_COLOR,
  fontWeight: DEFAULT_FONT_WEIGHT,
}

export function StyleView() {
  const [config, setConfig] = useAtom(configFieldsAtomMap.videoSubtitles, { store: subtitlesStore })
  const portalContainer = use(ShadowWrapperContext)
  const { displayMode, translationPosition, container } = config.style

  const updateStyle = (patch: Record<string, unknown>) => {
    void setConfig(deepmerge(config, { style: patch }))
  }

  return (
    <div className="min-h-[calc(100cqh-6rem)] px-3 pb-4 pt-3">
      <SettingsGroup
        icon={<IconSettings className="size-3.5" />}
        title={i18n.t("options.videoSubtitles.style.generalSettings")}
        onReset={() => updateStyle({
          displayMode: DEFAULT_DISPLAY_MODE,
          translationPosition: DEFAULT_TRANSLATION_POSITION,
          container: { backgroundOpacity: DEFAULT_BACKGROUND_OPACITY },
        })}
      >
        <SettingRow label={i18n.t("options.videoSubtitles.style.displayMode.title")}>
          <Select value={displayMode} onValueChange={(v: SubtitlesDisplayMode | null) => v && updateStyle({ displayMode: v })}>
            <SelectTrigger variant="dark" size="sm" className={SELECT_TRIGGER_CLASS}>
              <SelectValue>{i18n.t(`options.videoSubtitles.style.displayMode.${displayMode}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent variant="dark" container={portalContainer} className={SELECT_CONTENT_CLASS}>
              <SelectGroup>
                <SelectItem variant="dark" value="bilingual">{i18n.t("options.videoSubtitles.style.displayMode.bilingual")}</SelectItem>
                <SelectItem variant="dark" value="originalOnly">{i18n.t("options.videoSubtitles.style.displayMode.originalOnly")}</SelectItem>
                <SelectItem variant="dark" value="translationOnly">{i18n.t("options.videoSubtitles.style.displayMode.translationOnly")}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </SettingRow>

        <Activity mode={displayMode === "bilingual" ? "visible" : "hidden"}>
          <SettingRow label={i18n.t("options.videoSubtitles.style.translationPosition.title")}>
            <Select value={translationPosition} onValueChange={(v: SubtitlesTranslationPosition | null) => v && updateStyle({ translationPosition: v })}>
              <SelectTrigger variant="dark" size="sm" className={SELECT_TRIGGER_CLASS}>
                <SelectValue>{i18n.t(`options.videoSubtitles.style.translationPosition.${translationPosition}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent variant="dark" container={portalContainer} className={SELECT_CONTENT_CLASS}>
                <SelectGroup>
                  <SelectItem variant="dark" value="above">{i18n.t("options.videoSubtitles.style.translationPosition.above")}</SelectItem>
                  <SelectItem variant="dark" value="below">{i18n.t("options.videoSubtitles.style.translationPosition.below")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </SettingRow>
        </Activity>

        <SliderRow
          label={i18n.t("options.videoSubtitles.style.backgroundOpacity")}
          value={container.backgroundOpacity}
          display={`${container.backgroundOpacity}%`}
          min={MIN_BACKGROUND_OPACITY}
          max={MAX_BACKGROUND_OPACITY}
          step={5}
          onChange={v => updateStyle({ container: { backgroundOpacity: v } })}
        />
      </SettingsGroup>

      <TextStyleGroup
        icon={<IconSubtitles className="size-3.5" />}
        title={i18n.t("options.videoSubtitles.style.mainSubtitle")}
        textStyle={config.style.main}
        onChange={patch => updateStyle({ main: patch })}
        onReset={() => updateStyle({ main: DEFAULT_TEXT_STYLE })}
        portalContainer={portalContainer}
      />

      <TextStyleGroup
        icon={<IconLanguage className="size-3.5" />}
        title={i18n.t("options.videoSubtitles.style.translationSubtitle")}
        textStyle={config.style.translation}
        onChange={patch => updateStyle({ translation: patch })}
        onReset={() => updateStyle({ translation: DEFAULT_TEXT_STYLE })}
        portalContainer={portalContainer}
      />
    </div>
  )
}
