export function getLobeIconsCDNUrlFn(iconSlug: string) {
  return (isDark: boolean = false) => {
    return `https://registry.npmmirror.com/@lobehub/icons-static-webp/1.65.0/files/${isDark ? 'dark' : 'light'}/${iconSlug}.webp`
  }
}
