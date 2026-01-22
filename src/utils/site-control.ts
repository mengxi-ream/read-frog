import type { Config } from '@/types/config/config'
import { matchDomainPattern } from './url'

export function isSiteEnabled(url: string, config: Config | null): boolean {
  if (!config)
    return true

  const { mode, patterns } = config.siteControl

  if (mode === 'all')
    return true

  // whitelist mode: only enabled if matches a pattern
  return patterns.some(pattern => matchDomainPattern(url, pattern))
}
