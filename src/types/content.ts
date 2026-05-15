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
  videoTitle?: string | null
  videoDescription?: string | null
  videoSummary?: string | null
}
