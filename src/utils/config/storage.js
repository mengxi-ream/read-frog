import { storage } from "#imports";
import { configSchema } from "@/types/config/config";
import { CONFIG_SCHEMA_VERSION, CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "../constants/config";
import { logger } from "../logger";
export async function getLocalConfig() {
    const config = await storage.getItem(`local:${CONFIG_STORAGE_KEY}`);
    if (!config) {
        logger.warn("No config found in storage");
        return null;
    }
    const parsedConfig = configSchema.safeParse(config);
    if (!parsedConfig.success) {
        logger.error("Config is invalid, using default config");
        return DEFAULT_CONFIG;
    }
    return parsedConfig.data;
}
export async function setLocalConfig(config) {
    const parsedConfig = configSchema.safeParse(config);
    if (!parsedConfig.success) {
        throw new Error("Config is invalid");
    }
    await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, parsedConfig.data);
    await storage.setMeta(`local:${CONFIG_STORAGE_KEY}`, { lastModifiedAt: Date.now() });
}
export async function getLocalConfigAndMeta() {
    try {
        const [config, meta] = await Promise.all([
            storage.getItem(`local:${CONFIG_STORAGE_KEY}`),
            storage.getMeta(`local:${CONFIG_STORAGE_KEY}`),
        ]);
        if (!config) {
            throw new Error("Local config not found");
        }
        const parsedConfig = configSchema.safeParse(config);
        if (!parsedConfig.success) {
            throw new Error("Local config is invalid");
        }
        return {
            value: parsedConfig.data,
            meta: {
                schemaVersion: meta?.schemaVersion ?? CONFIG_SCHEMA_VERSION,
                lastModifiedAt: meta?.lastModifiedAt ?? Date.now(),
            },
        };
    }
    catch (error) {
        logger.error("Failed to get local config", error);
        throw error;
    }
}
export async function setLocalConfigAndMeta(config, meta) {
    const lastModifiedAt = meta.lastModifiedAt ?? Date.now();
    const parsedConfig = configSchema.safeParse(config);
    if (!parsedConfig.success) {
        throw new Error("Config is invalid");
    }
    await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, parsedConfig.data);
    await storage.setMeta(`local:${CONFIG_STORAGE_KEY}`, { ...meta, lastModifiedAt });
}
