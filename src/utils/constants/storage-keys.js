export const TRANSLATION_STATE_KEY_PREFIX = "session:translationState";
export function getTranslationStateKey(tabId) {
    return `${TRANSLATION_STATE_KEY_PREFIX}.${tabId}`;
}
export const DETECTED_CODE_STATE_KEY_PREFIX = "session:detectedCode";
export function getDetectedCodeStateKey(tabId) {
    return `${DETECTED_CODE_STATE_KEY_PREFIX}.${tabId}`;
}
