import { getFinalSourceCode } from "@/utils/config/languages";
import { matchDomainPattern } from "@/utils/url";
export async function shouldEnableAutoTranslation(url, detectedCodeOrUnd, config) {
    const autoTranslatePatterns = config?.translate.page.autoTranslatePatterns;
    const neverAutoTranslatePatterns = config?.translate.page.neverAutoTranslatePatterns;
    const autoTranslateLanguages = config?.translate.page.autoTranslateLanguages;
    const { sourceCode } = config?.language || {};
    const doesMatchNeverTranslatePattern = neverAutoTranslatePatterns?.some(pattern => matchDomainPattern(url, pattern)) ?? false;
    if (doesMatchNeverTranslatePattern) {
        return false;
    }
    const doesMatchPattern = autoTranslatePatterns?.some(pattern => matchDomainPattern(url, pattern)) ?? false;
    let doesMatchLanguage = false;
    if (detectedCodeOrUnd !== "und") {
        doesMatchLanguage = autoTranslateLanguages?.includes(getFinalSourceCode(sourceCode, detectedCodeOrUnd));
    }
    return doesMatchPattern || doesMatchLanguage;
}
