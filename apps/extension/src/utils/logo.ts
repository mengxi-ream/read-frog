import type { Theme } from '@/components/providers/theme-provider'

export function getLobeIconsCDNUrlFn(iconSlug: string) {
  return (theme: Theme = 'light') => {
    return `https://registry.npmmirror.com/@lobehub/icons-static-webp/1.65.0/files/${theme}/${iconSlug}.webp`
  }
}
