import type { Config } from '@/types/config/config'

export async function shouldAutoEnable(url: string, config: Config): Promise<boolean> {
  const autoTranslatePatterns = config?.translate.page.autoTranslatePatterns
  if (!autoTranslatePatterns)
    return false

  return autoTranslatePatterns.some(pattern => url.toLowerCase().includes(pattern.toLowerCase()))
}
