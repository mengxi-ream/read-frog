import { cn } from '@repo/ui/lib/utils'
import { isDarkMode } from './theme'

export function insertShadowRootUIWrapperInto(container: HTMLElement) {
  const wrapper = document.createElement('div')
  wrapper.className = cn(
    'text-base antialiased font-sans z-[2147483647]',
    isDarkMode() && 'dark',
  )
  wrapper.style.colorScheme = isDarkMode() ? 'dark' : 'light'
  container.append(wrapper)
  return wrapper
}
