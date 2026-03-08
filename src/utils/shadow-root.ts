import type { ThemeMode } from "@/types/config/theme"
import { cn } from "@/utils/styles/utils"
import { isDarkMode } from "./theme"

export function insertShadowRootUIWrapperInto(container: HTMLElement, themeMode: ThemeMode = "system") {
  const isDark = isDarkMode(themeMode)
  const wrapper = document.createElement("div")
  wrapper.className = cn(
    "text-base antialiased font-sans z-[2147483647]",
    isDark && "dark",
  )
  wrapper.style.colorScheme = isDark ? "dark" : "light"
  container.append(wrapper)

  return wrapper
}
