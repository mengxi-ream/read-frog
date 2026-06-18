import { storage } from "#imports";
import { configSchema } from "@/types/config/config";
import { isAPIProviderConfig } from "@/types/config/provider";
import { CONFIG_SCHEMA_VERSION, CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "../constants/config";
import { logger } from "../logger";
import { runMigration } from "./migration";
/**
 * Initialize the config, this function should only be called once in the background script
 * @returns The extension config
 */
export async function initializeConfig() {
    const [storedConfig, configMeta] = await Promise.all([
        storage.getItem(`local:${CONFIG_STORAGE_KEY}`),
        storage.getMeta(`local:${CONFIG_STORAGE_KEY}`),
    ]);
    let config;
    let currentVersion;
    let didConfigChange = false;
    if (!storedConfig) {
        config = DEFAULT_CONFIG;
        currentVersion = CONFIG_SCHEMA_VERSION;
        didConfigChange = true;
    }
    else {
        config = storedConfig;
        currentVersion = configMeta?.schemaVersion ?? 1;
    }
    while (currentVersion < CONFIG_SCHEMA_VERSION) {
        const nextVersion = currentVersion + 1;
        try {
            config = await runMigration(nextVersion, config);
            didConfigChange = true;
            currentVersion = nextVersion;
        }
        catch (error) {
            console.error(`Migration to version ${nextVersion} failed:`, error);
            currentVersion = nextVersion;
        }
    }
    if (!configSchema.safeParse(config).success) {
        logger.warn("Config is invalid, using default config");
        config = DEFAULT_CONFIG;
        currentVersion = CONFIG_SCHEMA_VERSION;
        didConfigChange = true;
    }
    if (import.meta.env.DEV) {
        const apiKeyResult = applyAPIKeysFromEnv(config);
        config = apiKeyResult.config;
        didConfigChange = didConfigChange || apiKeyResult.changed;
        const betaResult = applyDevBetaExperience(config);
        config = betaResult.config;
        didConfigChange = didConfigChange || betaResult.changed;
    }
    const didMetaNeedUpdate = configMeta?.schemaVersion !== currentVersion
        || configMeta?.lastModifiedAt === undefined;
    if (didConfigChange) {
        await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, config);
    }
    if (didConfigChange || didMetaNeedUpdate) {
        await storage.setMeta(`local:${CONFIG_STORAGE_KEY}`, {
            schemaVersion: currentVersion,
            lastModifiedAt: configMeta?.lastModifiedAt ?? Date.now(),
        });
    }
}
function applyAPIKeysFromEnv(config) {
    let changed = false;
    const providersConfig = config.providersConfig.map((providerConfig) => {
        if (!isAPIProviderConfig(providerConfig)) {
            return providerConfig;
        }
        const apiKeyEnvName = `WXT_${providerConfig.provider.toUpperCase()}_API_KEY`;
        const envApiKey = import.meta.env[apiKeyEnvName];
        if (!envApiKey || providerConfig.apiKey === envApiKey) {
            return providerConfig;
        }
        changed = true;
        return {
            ...providerConfig,
            apiKey: envApiKey,
        };
    });
    if (!changed) {
        return { config, changed: false };
    }
    return {
        config: {
            ...config,
            providersConfig,
        },
        changed: true,
    };
}
function applyDevBetaExperience(config) {
    if (config.betaExperience.enabled) {
        return { config, changed: false };
    }
    return {
        config: {
            ...config,
            betaExperience: {
                ...config.betaExperience,
                enabled: true,
            },
        },
        changed: true,
    };
}
