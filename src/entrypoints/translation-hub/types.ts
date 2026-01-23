export interface ServiceInfo {
  id: string
  name: string
  provider: string
  type: 'normal' | 'ai'
}

export interface TranslationResult {
  id: string
  name: string
  provider: string
  text?: string
  error?: string
  isLoading: boolean
}
