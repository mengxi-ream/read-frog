import type { ThemeMode } from "@/types/config/theme"
import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { useTheme } from "@/components/providers/theme-provider"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { themeModes } from "@/types/config/theme"
import { ConfigCard } from "../../components/config-card"

const MODE_ICON: Record<ThemeMode, string> = {
  system: "tabler:device-desktop",
  light: "tabler:sun",
  dark: "tabler:moon",
}

const MODE_LABEL_KEY = {
  system: "options.general.appearance.system",
  light: "options.general.appearance.light",
  dark: "options.general.appearance.dark",
} as const

export default function AppearanceSettings() {
  const { themeMode, setThemeMode } = useTheme()

  return (
    <ConfigCard
      id="appearance"
      title={i18n.t("options.general.appearance.title")}
      description={i18n.t("options.general.appearance.theme")}
    >
      <div className="w-full flex justify-start md:justify-end">
        <Select
          value={themeMode}
          onValueChange={value => setThemeMode(value as ThemeMode)}
        >
          <SelectTrigger className="w-full">
            <SelectValue render={<span />}>
              <span className="flex items-center gap-2">
                <Icon icon={MODE_ICON[themeMode]} className="size-4" />
                {i18n.t(MODE_LABEL_KEY[themeMode])}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {themeModes.map(mode => (
                <SelectItem key={mode} value={mode}>
                  <span className="flex items-center gap-2">
                    <Icon icon={MODE_ICON[mode]} className="size-4" />
                    {i18n.t(MODE_LABEL_KEY[mode])}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </ConfigCard>
  )
}
