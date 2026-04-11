export const WEB_PAGE_CONTENT_CHAR_LIMIT = 2000

export function truncateWebPageContent(text: string): string {
  return text.slice(0, WEB_PAGE_CONTENT_CHAR_LIMIT)
}
