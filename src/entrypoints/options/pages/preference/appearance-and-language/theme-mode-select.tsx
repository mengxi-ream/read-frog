import type { ComponentProps } from "react"
import type { ThemeMode } from "@/types/config/theme"
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
import { i18n } from "@/utils/i18n"

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

/**
 * Bare theme-mode control. Callers own the surrounding label/layout, including width:
 * `SelectTrigger` defaults to `w-fit`, so pass `w-full` to fill the container instead.
 */
export function ThemeModeSelect({
  className,
  size,
}: {
  className?: string
  size?: ComponentProps<typeof SelectTrigger>["size"]
}) {
  const { themeMode, setThemeMode } = useTheme()

  return (
    <Select value={themeMode} onValueChange={(value) => setThemeMode(value as ThemeMode)}>
      <SelectTrigger className={className} size={size}>
        <SelectValue render={<span />}>
          <span className="flex items-center gap-2">
            <Icon icon={MODE_ICON[themeMode]} className="size-4" />
            {i18n.t(MODE_LABEL_KEY[themeMode])}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectGroup>
          {themeModes.map((mode) => (
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
  )
}
