export function isDarkMode() {
  return (
    // TODO: change this to storage API for browser extension
    localStorage.theme === 'dark'
    || (!('theme' in localStorage)
      && typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-color-scheme: dark)').matches)
  )
}
