export function getLobeIconsCDNUrlFn(iconSlug: string) {
  return (isDark: boolean = false) => {
    return `https://registry.npmmirror.com/@lobehub/icons-static-webp/latest/files/${isDark ? 'dark' : 'light'}/${iconSlug}.webp`
  }
}
