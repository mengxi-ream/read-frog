import { isAPIProviderConfig, isLLMProviderConfig, isNonAPIProviderConfig, isPureAPIProviderConfig, isTranslateProviderConfig } from "@/types/config/provider";
import { FEATURE_KEYS, FEATURE_PROVIDER_DEFS } from "@/utils/constants/feature-providers";
export function getProviderConfigById(providersConfig, providerId) {
    return providersConfig.find(p => p.id === providerId);
}
export function getLLMProvidersConfig(providersConfig) {
    return providersConfig.filter(isLLMProviderConfig);
}
export function getAPIProvidersConfig(providersConfig) {
    return providersConfig.filter(isAPIProviderConfig);
}
export function getPureAPIProvidersConfig(providersConfig) {
    return providersConfig.filter(isPureAPIProviderConfig);
}
export function getNonAPIProvidersConfig(providersConfig) {
    return providersConfig.filter(isNonAPIProviderConfig);
}
export function getTranslateProvidersConfig(providersConfig) {
    return providersConfig.filter(isTranslateProviderConfig);
}
export function filterEnabledProvidersConfig(providersConfig) {
    return providersConfig.filter(p => p.enabled);
}
export function getEnabledLLMProvidersConfig(providersConfig) {
    return filterEnabledProvidersConfig(providersConfig).filter(isLLMProviderConfig);
}
export function getProviderKeyByName(providersConfig, providerId) {
    const provider = getProviderConfigById(providersConfig, providerId);
    return provider?.provider;
}
export function getProviderModelConfig(config, providerId) {
    const providerConfig = getProviderConfigById(config.providersConfig, providerId);
    if (providerConfig && isLLMProviderConfig(providerConfig)) {
        return providerConfig.model;
    }
    return undefined;
}
export function getProviderApiKey(providersConfig, providerId) {
    const providerConfig = getProviderConfigById(providersConfig, providerId);
    if (providerConfig && isAPIProviderConfig(providerConfig)) {
        return providerConfig.apiKey;
    }
    return undefined;
}
export function getProviderBaseURL(providersConfig, providerId) {
    const providerConfig = getProviderConfigById(providersConfig, providerId);
    if (providerConfig && isAPIProviderConfig(providerConfig) && "baseURL" in providerConfig) {
        return providerConfig.baseURL;
    }
    return undefined;
}
export function resolveLanguageDetectionConfigForModeChange(currentConfig, nextMode, providersConfig) {
    if (nextMode === "basic") {
        return { mode: "basic" };
    }
    const enabledLLMProviders = getEnabledLLMProvidersConfig(providersConfig);
    if (enabledLLMProviders.length === 0) {
        return null;
    }
    const hasSelectedProvider = enabledLLMProviders.some(provider => provider.id === currentConfig.providerId);
    return {
        mode: "llm",
        providerId: hasSelectedProvider ? currentConfig.providerId : enabledLLMProviders[0].id,
    };
}
/**
 * Compute fallback provider assignments when a provider is deleted.
 * For each feature using the deleted provider, picks the first compatible remaining provider.
 */
export function computeProviderFallbacksAfterDeletion(deletedProviderId, config, remainingProviders) {
    const updates = {};
    for (const key of FEATURE_KEYS) {
        const def = FEATURE_PROVIDER_DEFS[key];
        const currentId = def.getProviderId(config);
        if (currentId !== deletedProviderId)
            continue;
        const candidates = remainingProviders.filter(p => p.enabled && def.isProvider(p.provider));
        if (candidates.length > 0)
            updates[key] = candidates[0].id;
    }
    return updates;
}
export function findFeatureMissingProvider(remainingProviders) {
    for (const key of FEATURE_KEYS) {
        const def = FEATURE_PROVIDER_DEFS[key];
        if (!remainingProviders.some(p => p.enabled && def.isProvider(p.provider)))
            return key;
    }
    return null;
}
/**
 * Reassign selection toolbar custom actions that reference the deleted provider.
 * Fallback target must be the first enabled LLM provider.
 * Returns null when no custom action is affected or when no fallback exists.
 */
export function computeSelectionToolbarCustomActionFallbacksAfterDeletion(deletedProviderId, config, remainingProviders) {
    const hasAffectedCustomAction = config.selectionToolbar.customActions
        .some(action => action.providerId === deletedProviderId);
    if (!hasAffectedCustomAction) {
        return null;
    }
    const fallbackProvider = getEnabledLLMProvidersConfig(remainingProviders)[0];
    if (!fallbackProvider) {
        return null;
    }
    return config.selectionToolbar.customActions.map((action) => {
        if (action.providerId !== deletedProviderId) {
            return action;
        }
        return {
            ...action,
            providerId: fallbackProvider.id,
        };
    });
}
/**
 * Compute languageDetection fallback when a provider is deleted.
 * Only applies when mode is "llm" and the deleted provider is the current one.
 * Returns the new providerId (first enabled LLM), or undefined if none available.
 * Returns null when no change is needed.
 */
export function computeLanguageDetectionFallbackAfterDeletion(deletedProviderId, config, remainingProviders) {
    if (config.languageDetection.mode !== "llm")
        return null;
    if (config.languageDetection.providerId !== deletedProviderId)
        return null;
    const fallback = getEnabledLLMProvidersConfig(remainingProviders)[0];
    return fallback?.id;
}
