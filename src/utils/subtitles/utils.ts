import { MAX_CHARS_CJK, MAX_WORDS } from "@/utils/constants/subtitles"

export function isCJKLanguage(lang?: string): boolean {
  if (!lang)
    return false
  return ["zh", "ja", "ko", "th", "lo", "km", "my"].some(l => lang.startsWith(l))
}

export function getTextLength(text: string, isCJK: boolean): number {
  if (isCJK) {
    return text.length
  }
  return text.split(/\s+/).filter(Boolean).length
}

export function getMaxLength(isCJK: boolean): number {
  if (isCJK) {
    return MAX_CHARS_CJK
  }
  return MAX_WORDS
}
