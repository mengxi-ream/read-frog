import type { Config } from "@/types/config/config"
import { matchDomainPattern } from "./url"

export function isSiteEnabled(url: string, config: Config | null): boolean {
  if (!config)
    return true

  const { mode, blacklistPatterns, whitelistPatterns } = config.siteControl

  if (mode === "blacklist")
    return !blacklistPatterns.some(pattern => matchDomainPattern(url, pattern))

  return whitelistPatterns.some(pattern => matchDomainPattern(url, pattern))
}
