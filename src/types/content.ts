export interface WebPageContext {
  webTitle: string
  webContent?: string
  webSummary?: string
}

export interface WebPagePromptContext {
  webTitle?: string | null
  webContent?: string | null
  webSummary?: string | null
}

export interface SubtitlePromptContext {
  videoTitle?: string | null
  videoSummary?: string | null
}
