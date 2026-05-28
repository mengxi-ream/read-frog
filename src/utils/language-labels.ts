import type { LangCodeISO6393 } from "@read-frog/definitions"
import { LANG_CODE_TO_LOCALE_NAME } from "@read-frog/definitions"
import { camelCase } from "case-anything"
import { i18n } from "#imports"

export function getLanguageName(code: LangCodeISO6393) {
  return i18n.t(`languages.${camelCase(code)}` as Parameters<typeof i18n.t>[0])
}

export function getLanguageLabel(code: LangCodeISO6393) {
  return `${getLanguageName(code)} (${LANG_CODE_TO_LOCALE_NAME[code]})`
}
