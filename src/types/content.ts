export interface WebPageContext {
  webTitle: string
  webDescription?: string
  webContent?: string
  webSummary?: string
}

export interface WebPagePromptContext {
  webTitle?: string | null
  webDescription?: string | null
  webContent?: string | null
  webSummary?: string | null
}

export interface SubtitlePromptContext {
  webTitle?: string | null
  webDescription?: string | null
  videoSummary?: string | null
}
