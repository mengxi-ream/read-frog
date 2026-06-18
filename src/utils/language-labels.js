import { LANG_CODE_TO_LOCALE_NAME } from "@read-frog/definitions";
import { camelCase } from "case-anything";
import { i18n } from "#imports";
export function getLanguageName(code) {
    return i18n.t(`languages.${camelCase(code)}`);
}
export function getLanguageLabel(code) {
    return `${getLanguageName(code)} (${LANG_CODE_TO_LOCALE_NAME[code]})`;
}
