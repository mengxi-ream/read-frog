const INVISIBLE_TRANSLATION_CHARACTERS_REGEX = /[\u200B-\u200D\uFEFF]/g;
export function prepareTranslationText(value) {
    return value?.replace(INVISIBLE_TRANSLATION_CHARACTERS_REGEX, "").trim() ?? "";
}
