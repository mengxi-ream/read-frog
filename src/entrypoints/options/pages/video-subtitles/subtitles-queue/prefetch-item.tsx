import { useAtom } from "jotai"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"

const PREFETCH_VALUES = ["0", "2", "5", "10", "-1"] as const

export function SubtitlePrefetchItem() {
  const [config, setConfig] = useAtom(configFieldsAtomMap.videoSubtitles)
  const choices = [
    { value: "0", label: i18n.t("options.videoSubtitles.subtitlesQueue.prefetch.choice.m0") },
    { value: "2", label: i18n.t("options.videoSubtitles.subtitlesQueue.prefetch.choice.m2") },
    { value: "5", label: i18n.t("options.videoSubtitles.subtitlesQueue.prefetch.choice.m5") },
    { value: "10", label: i18n.t("options.videoSubtitles.subtitlesQueue.prefetch.choice.m10") },
    { value: "-1", label: i18n.t("options.videoSubtitles.subtitlesQueue.prefetch.choice.all") },
  ]

  return (
    <ConfigItem
      id="subtitles-prefetch"
      title={i18n.t("options.videoSubtitles.subtitlesQueue.prefetch.title")}
      description={i18n.t("options.videoSubtitles.subtitlesQueue.prefetch.description")}
    >
      <Select
        items={choices}
        value={String(config.prefetchMinutes)}
        onValueChange={(value) => {
          if (!value || !PREFETCH_VALUES.some((option) => option === value)) return
          void setConfig({ prefetchMinutes: Number(value) })
        }}
      >
        <SelectTrigger
          size="sm"
          aria-label={i18n.t("options.videoSubtitles.subtitlesQueue.prefetch.title")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectGroup>
            {choices.map((choice) => (
              <SelectItem key={choice.value} value={choice.value}>
                {choice.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </ConfigItem>
  )
}
