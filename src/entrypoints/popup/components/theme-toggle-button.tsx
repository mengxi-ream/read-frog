import type { ThemeMode } from "@/types/config/theme"
import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { useTheme } from "@/components/providers/theme-provider"
import { Button } from "@/components/ui/base-ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { themeModes } from "@/types/config/theme"

const MODE_ICON: Record<ThemeMode, string> = {
  system: "tabler:device-desktop",
  light: "tabler:sun",
  dark: "tabler:moon",
}

export function ThemeToggleButton() {
  const { themeMode, setThemeMode } = useTheme()

  const next = () => {
    const idx = themeModes.indexOf(themeMode)
    setThemeMode(themeModes[(idx + 1) % themeModes.length])
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={(
          <Button
            variant="ghost"
            size="icon"
            onClick={next}
          />
        )}
      >
        <Icon
          icon={MODE_ICON[themeMode]}
          className="transition-transform duration-200"
        />
      </TooltipTrigger>
      <TooltipContent>
        {i18n.t("popup.theme")}
      </TooltipContent>
    </Tooltip>
  )
}
