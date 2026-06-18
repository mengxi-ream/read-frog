import { isTranslateProvider } from "@/types/config/provider";
import { mergeWithArrayOverwrite } from "../atoms/config";
import { getProviderConfigById } from "../config/helpers";
export const FEATURE_KEYS = [
    "translate",
    "videoSubtitles",
    "selectionToolbar.translate",
    "inputTranslation",
];
export const FEATURE_PROVIDER_DEFS = {
    "translate": {
        isProvider: isTranslateProvider,
        getProviderId: (c) => c.translate.providerId,
        configPath: ["translate", "providerId"],
    },
    "videoSubtitles": {
        isProvider: isTranslateProvider,
        getProviderId: (c) => c.videoSubtitles.providerId,
        configPath: ["videoSubtitles", "providerId"],
    },
    "selectionToolbar.translate": {
        isProvider: isTranslateProvider,
        getProviderId: (c) => c.selectionToolbar.features.translate.providerId,
        configPath: ["selectionToolbar", "features", "translate", "providerId"],
    },
    "inputTranslation": {
        isProvider: isTranslateProvider,
        getProviderId: (c) => c.inputTranslation.providerId,
        configPath: ["inputTranslation", "providerId"],
    },
};
/** Maps FeatureKey (with dots) to i18n-safe key (with underscores) for `options.general.featureProviders.features.*` */
export const FEATURE_KEY_I18N_MAP = {
    "translate": "translate",
    "videoSubtitles": "videoSubtitles",
    "selectionToolbar.translate": "selectionToolbar_translate",
    "inputTranslation": "inputTranslation",
};
export function getFeatureLabelI18nKey(featureKey) {
    return `options.general.featureProviders.features.${FEATURE_KEY_I18N_MAP[featureKey]}`;
}
export function resolveProviderConfig(config, featureKey) {
    const providerConfig = resolveProviderConfigOrNull(config, featureKey);
    if (!providerConfig) {
        const providerId = FEATURE_PROVIDER_DEFS[featureKey].getProviderId(config);
        throw new Error(`No provider config for id "${providerId}" (feature "${featureKey}")`);
    }
    return providerConfig;
}
export function resolveProviderConfigOrNull(config, featureKey) {
    const def = FEATURE_PROVIDER_DEFS[featureKey];
    const providerId = def.getProviderId(config);
    return getProviderConfigById(config.providersConfig, providerId) ?? null;
}
/**
 * Convert a feature→providerId mapping into a Partial<Config> using FEATURE_PROVIDER_DEFS.configPath.
 * Generic — works for any scenario that assigns provider IDs to features.
 */
export function buildFeatureProviderPatch(assignments) {
    let patch = {};
    for (const key of FEATURE_KEYS) {
        const newId = assignments[key];
        if (newId === undefined)
            continue;
        const def = FEATURE_PROVIDER_DEFS[key];
        const fragment = {};
        let current = fragment;
        for (let i = 0; i < def.configPath.length - 1; i++) {
            const next = {};
            current[def.configPath[i]] = next;
            current = next;
        }
        current[def.configPath[def.configPath.length - 1]] = newId;
        patch = mergeWithArrayOverwrite(patch, fragment);
    }
    return patch;
}
