import type { Theme } from "@/types/config/theme"

const lobeIconUrls = import.meta.glob<string>("../assets/providers/lobe/*.webp", {
  eager: true,
  import: "default",
  query: "?url&no-inline",
})

export function getBundledLobeIconUrlFn(iconSlug: string) {
  return (theme: Theme = "light") => {
    const assetPath = `../assets/providers/lobe/${theme}-${iconSlug}.webp`
    const iconUrl = lobeIconUrls[assetPath]

    if (!iconUrl) {
      throw new Error(`Unknown bundled Lobe icon: ${theme}/${iconSlug}`)
    }

    return iconUrl
  }
}
