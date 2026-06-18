export function hasRenderableSubtitleByMode(subtitle, displayMode) {
    if (!subtitle)
        return false;
    if (displayMode === "translationOnly")
        return !!subtitle.translation;
    return true;
}
export function isAwaitingTranslation(subtitle, stateData) {
    return subtitle ? !subtitle.translation : stateData?.state === "loading";
}
