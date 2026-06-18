import { ISO6393_TO_6391, RTL_LANG_CODES } from "@read-frog/definitions";
export function getLanguageDirectionAndLang(targetCode) {
    const dir = RTL_LANG_CODES.includes(targetCode) ? "rtl" : "ltr";
    const lang = ISO6393_TO_6391[targetCode];
    return { dir, lang };
}
