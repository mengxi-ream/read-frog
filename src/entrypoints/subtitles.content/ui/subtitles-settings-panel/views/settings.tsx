import type { ReactNode } from "react"
import type { NavigateToSubpage } from "."
import type {
  SubtitlesDisplayMode,
  SubtitlesStyle,
  SubtitlesTranslationPosition,
} from "@/types/config/subtitles"
import { deepmerge } from "deepmerge-ts"
import { useAtom } from "jotai"
import { use } from "react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { SUBTITLES_PLATFORM_NAMES } from "@/utils/constants/subtitles"
import { i18n } from "@/utils/i18n"
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host"
import { subtitlesStore } from "../../../atoms"
import { useSubtitlesUI } from "../../subtitles-ui-context"
import { SELECT_CONTENT_CLASS, SELECT_TRIGGER_CLASS } from "./style"
import { SubpageLink } from "./subpage-link"

const DISPLAY_MODES: SubtitlesDisplayMode[] = ["bilingual", "translationOnly", "originalOnly"]
const TRANSLATION_POSITIONS: SubtitlesTranslationPosition[] = ["above", "below"]

function SelectRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    // The transparent border matches the button rows', so labels line up with "Subtitle style".
    <div className="flex items-center justify-between gap-2 border border-transparent px-2 py-1.5">
      <span className="min-w-0 truncate text-xs leading-5">{label}</span>
      {children}
    </div>
  )
}

/**
 * Whether this site's videos start translated: moves the site between "manual" and "auto".
 * "Off" is left to the options page, since it takes away the button this panel opens from.
 * Like the auto-start setting itself, it applies from the next video on.
 */
function AutoStartRow() {
  const { platform } = useSubtitlesUI()
  const [config, setConfig] = useAtom(configFieldsAtomMap.videoSubtitles, { store: subtitlesStore })
  const switchId = "read-frog-subtitles-auto-start"
  const label = i18n.t("subtitles.autoStartOnPlatform", [SUBTITLES_PLATFORM_NAMES[platform]])

  return (
    // Laid out like SelectRow, but the label wraps: a switch is narrow, and the site name in
    // the label is what tells this row apart from a general setting.
    <div className="flex items-center justify-between gap-2 border border-transparent px-2 py-1.5">
      <label htmlFor={switchId} className="min-w-0 cursor-pointer text-xs leading-5">
        {label}
      </label>
      <Switch
        id={switchId}
        checked={config.platforms[platform] === "auto"}
        onCheckedChange={(checked) => {
          void setConfig((current) => ({
            platforms: { ...current.platforms, [platform]: checked ? "auto" : "manual" },
          }))
        }}
      />
    </div>
  )
}

export function SettingsView({ onNavigate }: { onNavigate: NavigateToSubpage }) {
  const [config, setConfig] = useAtom(configFieldsAtomMap.videoSubtitles, { store: subtitlesStore })
  const portalContainer = use(ShadowWrapperContext)
  const { displayMode, translationPosition } = config.style

  const updateStyle = (patch: Partial<SubtitlesStyle>) => {
    void setConfig(deepmerge(config, { style: patch }))
  }

  const displayModeLabel = i18n.t("options.videoSubtitles.style.displayMode.title")
  const translationPositionLabel = i18n.t("options.videoSubtitles.style.translationPosition.title")

  return (
    <div className="p-1">
      <div className="space-y-0.5">
        <SelectRow label={displayModeLabel}>
          <Select
            value={displayMode}
            onValueChange={(v: SubtitlesDisplayMode | null) => v && updateStyle({ displayMode: v })}
          >
            <SelectTrigger size="sm" aria-label={displayModeLabel} className={SELECT_TRIGGER_CLASS}>
              <SelectValue>
                {i18n.t(`options.videoSubtitles.style.displayMode.${displayMode}`)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent container={portalContainer} className={SELECT_CONTENT_CLASS}>
              <SelectGroup>
                {DISPLAY_MODES.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {i18n.t(`options.videoSubtitles.style.displayMode.${mode}`)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </SelectRow>

        {/* Where the translation sits only means something when both lines are shown. */}
        {displayMode === "bilingual" && (
          <SelectRow label={translationPositionLabel}>
            <Select
              value={translationPosition}
              onValueChange={(v: SubtitlesTranslationPosition | null) =>
                v && updateStyle({ translationPosition: v })
              }
            >
              <SelectTrigger
                size="sm"
                aria-label={translationPositionLabel}
                className={SELECT_TRIGGER_CLASS}
              >
                <SelectValue>
                  {i18n.t(
                    `options.videoSubtitles.style.translationPosition.${translationPosition}`,
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent container={portalContainer} className={SELECT_CONTENT_CLASS}>
                <SelectGroup>
                  {TRANSLATION_POSITIONS.map((position) => (
                    <SelectItem key={position} value={position}>
                      {i18n.t(`options.videoSubtitles.style.translationPosition.${position}`)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </SelectRow>
        )}

        <AutoStartRow />

        <SubpageLink id="style" onNavigate={onNavigate} />
      </div>
    </div>
  )
}
