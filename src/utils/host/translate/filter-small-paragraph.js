import { ISO6393_TO_6391 } from "@read-frog/definitions";
import { getDetectedCodeFromStorage, getFinalSourceCode } from "@/utils/config/languages";
function countWords(text, sourceCode) {
    // Convert ISO 639-3 (e.g., 'eng') to ISO 639-1 (e.g., 'en') for Intl.Segmenter
    const locale = ISO6393_TO_6391[sourceCode] ?? "en";
    const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
    return [...segmenter.segment(text)].filter(s => s.isWordLike).length;
}
async function getSourceCode(configSourceCode) {
    const detectedCode = await getDetectedCodeFromStorage();
    return getFinalSourceCode(configSourceCode, detectedCode);
}
export async function shouldFilterSmallParagraph(text, config) {
    const { minCharactersPerNode, minWordsPerNode } = config.translate.page;
    const { sourceCode } = config.language;
    if (minCharactersPerNode > 0 && text.length < minCharactersPerNode)
        return true;
    if (minWordsPerNode > 0) {
        const finalSourceCode = await getSourceCode(sourceCode);
        if (countWords(text, finalSourceCode) < minWordsPerNode)
            return true;
    }
    return false;
}
