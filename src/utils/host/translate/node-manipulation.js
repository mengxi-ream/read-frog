import { getRandomUUID } from "@/utils/crypto-polyfill";
import { isHTMLElement } from "../dom/filter";
import { findNearestAncestorBlockNodeAt } from "../dom/find";
import { walkAndLabelElement } from "../dom/traversal";
import { translateWalkedElement } from "./core/translation-walker";
import { validateTranslationConfigAndToast } from "./translate-text";
// Re-export public APIs
export { translateNodes, translateNodesBilingualMode, translateNodeTranslationOnlyMode } from "./core/translation-modes";
export { translateWalkedElement } from "./core/translation-walker";
export { removeAllTranslatedWrapperNodes } from "./dom/translation-cleanup";
// High-level orchestration function
export async function removeOrShowNodeTranslation(point, config) {
    const node = findNearestAncestorBlockNodeAt(point);
    if (!node || !isHTMLElement(node))
        return false;
    if (!validateTranslationConfigAndToast({
        providersConfig: config.providersConfig,
        translate: config.translate,
        language: config.language,
    })) {
        return false;
    }
    const id = getRandomUUID();
    walkAndLabelElement(node, id, config);
    await translateWalkedElement(node, id, config, true);
    return true;
}
