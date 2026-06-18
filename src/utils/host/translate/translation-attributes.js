import { getLanguageDirectionAndLang } from "@/utils/content/language-direction";
export function setTranslationDirAndLang(element, config) {
    const { dir, lang } = getLanguageDirectionAndLang(config.language.targetCode);
    element.setAttribute("dir", dir);
    if (lang) {
        element.setAttribute("lang", lang);
    }
}
