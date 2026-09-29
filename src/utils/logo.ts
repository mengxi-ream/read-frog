import type { Theme } from "@/types/config/theme"

export function getLobeIconsCDNUrlFn(iconSlug: string) {
  return (theme: Theme = "light") => {
    return `https://unpkg.com/@lobehub/icons-static-webp@latest/${theme}/${iconSlug}.webp`
  }
}
