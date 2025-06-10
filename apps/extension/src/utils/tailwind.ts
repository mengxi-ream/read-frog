import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...classes: ClassValue[]) {
  return twMerge(clsx(classes))
}

export function isDarkMode() {
  return (
    // TODO: change this to storage API for browser extension
    localStorage.theme === 'dark'
    || (!('theme' in localStorage)
      && window.matchMedia('(prefers-color-scheme: dark)').matches)
  )
}
