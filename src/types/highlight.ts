// 高亮数据接口定义
export interface HighlightData {
  id: string
  text: string
  color: string
  timestamp: number
  // 存储位置信息用于重建
  selector: string // 目标容器的选择器
  startPath: number[] // 起始文本节点的路径
  startOffset: number
  endPath: number[] // 结束文本节点的路径
  endOffset: number
  isSegmented: boolean // 是否为分段高亮
  // AI 解释相关字段
  context?: string // 高亮文本的上下文
  explanation?: string // AI 生成的解释
  examples?: string[] // 例句
  pronunciation?: string // 发音
  link?: string | null // 相关链接
}

export interface HighlightState {
  id: string
  text: string
  element: HTMLElement
  segments?: HTMLElement[]
}

export interface ConflictCheckResult {
  hasConflict: boolean
  reason?: string
  conflictElement?: Element
}

export interface ColorOption {
  color: string
  name: string
}

// Prompt 导出相关接口
export interface HighlightPromptData {
  highlight: string
  context: string
  id: string // 用于关联导入的解释
}

export interface HighlightExplanationData {
  highlight: string
  context: string
  explanation: string
  examples: string[]
  pronunciation: string
  link: string | null
  id?: string // 可选的 ID，用于关联原始 highlight
}

export interface HighlightPromptExport {
  highlights: HighlightPromptData[]
  metadata: {
    timestamp: number
    totalCount: number
    selector: string
  }
}

export interface HighlightExplanationImport {
  explanations: HighlightExplanationData[]
  metadata?: {
    timestamp: number
    totalCount: number
  }
}
