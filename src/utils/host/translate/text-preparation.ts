const INVISIBLE_TRANSLATION_CHARACTERS_REGEX = /[\u200B-\u200D\uFEFF]/g

export function prepareTranslationText(value: string | null | undefined): string {
  return value?.replace(INVISIBLE_TRANSLATION_CHARACTERS_REGEX, "").trim() ?? ""
}
