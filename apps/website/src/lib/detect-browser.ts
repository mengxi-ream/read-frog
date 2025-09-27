'use client'

export function detectBrowser() {
  if (navigator.userAgent?.includes('Edg')) {
    return 'edge'
  }
  else if (navigator.userAgent?.includes('Firefox')) {
    return 'firefox'
  }
  else if (navigator.userAgent?.includes('Chrome')) {
    return 'chrome'
  }

  return ''
}
