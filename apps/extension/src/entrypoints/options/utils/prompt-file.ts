import type { TranslatePrompt } from '@/types/config/provider'
import { saveAs } from 'file-saver'
import { APP_NAME } from '@/utils/constants/app'

export type PromptConfig = Omit<TranslatePrompt, 'id'>
export type PromptConfigList = PromptConfig[]

const TRANSLATE_PROMPTS_FILE = `${APP_NAME}: translate_prompts`

const reader = new FileReader()

export function checkPromptConfig(list: PromptConfig[]) {
  if (!Array.isArray(list)) {
    return false
  }
  list.forEach((item) => {
    if (!item.name || !item.prompt) {
      return false
    }
  })

  return true
}

export function downloadJSONFile(data: object) {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'text/json' })
  saveAs(blob, `${TRANSLATE_PROMPTS_FILE}.json`)
}

export function analysisJSONFile(file: File): Promise<PromptConfigList> {
  return new Promise((resolve, reject) => {
    reader.readAsText(file)
    reader.onload = (e) => {
      try {
        const fileResult = e.target?.result ?? '[]'
        if (typeof fileResult === 'string') {
          const list = JSON.parse(fileResult)
          const checked = checkPromptConfig(list)
          checked ? resolve(list) : reject(new Error('Prompt config is invalid'))
        }
        reject(new Error('Prompt config is invalid'))
      }
      catch (e) {
        reject(e)
      }
    }
    reader.onerror = error => reject(error)
  })
}
