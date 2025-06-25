import { DEFAULT_TRANSLATE_PROMPT } from '@/utils/constants/prompt'

export function migrate(oldConfig: any): any {
  // 添加自定义 Prompt

  const prompts = [DEFAULT_TRANSLATE_PROMPT]

  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      prompts,
    },
  }
}
