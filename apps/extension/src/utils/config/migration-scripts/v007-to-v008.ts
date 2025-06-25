import { DEFAULT_TRANSLATE_PROMPTS_CONFIG } from '@/utils/constants/prompt'

export function migrate(oldConfig: any): any {
  // 添加自定义 Prompt

  const promptsConfig = DEFAULT_TRANSLATE_PROMPTS_CONFIG

  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      promptsConfig,
    },
  }
}
