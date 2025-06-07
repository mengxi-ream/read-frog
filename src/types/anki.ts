// Anki 卡片类型接口
export interface AnkiNote {
  deckName: string
  modelName: string
  fields: Record<string, string>
  options?: {
    allowDuplicate?: boolean
    duplicateScope?: string
    duplicateScopeOptions?: {
      deckName?: string
      checkChildren?: boolean
    }
  }
  tags?: string[]
}

// Anki 连接配置
export interface AnkiConnectConfig {
  url: string
  version: number
}

// Anki 卡片模板
export interface AnkiCardTemplate {
  id: string
  name: string
  deckName: string
  modelName: string
  fields: {
    front: string
    back: string
    context?: string
    pronunciation?: string
    examples?: string
    link?: string
  }
}

// Anki 响应类型
export interface AnkiConnectResponse<T = any> {
  result: T
  error: string | null
}

// Anki 可用的动作
export type AnkiAction =
  | 'addNote'
  | 'addNotes'
  | 'deckNames'
  | 'modelNames'
  | 'modelFieldNames'
  | 'version'
  | 'requestPermission'
  | 'canAddNotes'

// Anki 请求参数
export interface AnkiRequest {
  action: AnkiAction
  version: number
  params?: Record<string, any>
}

// 高亮转换为 Anki 卡片的选项
export interface HighlightToAnkiOptions {
  deckName: string
  modelName: string
  includePronunciation: boolean
  includeExamples: boolean
  includeContext: boolean
  includeLink: boolean
}
