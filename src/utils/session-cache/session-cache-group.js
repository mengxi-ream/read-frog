import { storage } from "#imports";
import { DEFAULT_PROXY_CACHE_TTL_MS } from "@/utils/constants/proxy-fetch";
import { logger } from "@/utils/logger";
// TODO: solve race condition of cache group registry
export class SessionCache {
    prefix;
    keysListKey;
    isInitialized = false;
    constructor(groupKey = "default") {
        this.prefix = `cache_${groupKey}`;
        this.keysListKey = `session:${this.prefix}__meta_keys`;
    }
    makeKey(reqMethod, targetUrl) {
        return `session:${this.prefix}_${reqMethod.toUpperCase()}_${targetUrl}`;
    }
    async ensureKeysListInitialized() {
        if (this.isInitialized)
            return;
        const existing = await storage.getItem(this.keysListKey);
        if (existing === null) {
            await storage.setItem(this.keysListKey, []);
        }
        this.isInitialized = true;
    }
    async get(reqMethod, targetUrl, ttl = DEFAULT_PROXY_CACHE_TTL_MS) {
        try {
            const key = this.makeKey(reqMethod, targetUrl);
            const [item, metadata] = await Promise.all([
                storage.getItem(key),
                storage.getMeta(key),
            ]);
            if (!item || !metadata) {
                return undefined;
            }
            if (Date.now() - metadata.timestamp > ttl) {
                await this.delete(reqMethod, targetUrl);
                return undefined;
            }
            logger.info("[SessionCache] Cache hit:", { reqMethod, targetUrl });
            return item;
        }
        catch (error) {
            logger.error("[SessionCache] Get error:", error);
            return undefined;
        }
    }
    async set(reqMethod, targetUrl, response) {
        try {
            await this.ensureKeysListInitialized();
            const key = this.makeKey(reqMethod, targetUrl);
            const now = Date.now();
            // Set cache item and metadata in parallel
            await Promise.all([
                storage.setItem(key, response),
                storage.setMeta(key, {
                    timestamp: now,
                }),
            ]);
            // Track this key for group clearing
            const keysList = await storage.getItem(this.keysListKey) || [];
            if (!keysList.includes(key)) {
                keysList.push(key);
                await storage.setItem(this.keysListKey, keysList);
            }
            logger.info("[SessionCache] Cache set:", { reqMethod, targetUrl });
        }
        catch (error) {
            logger.error("[SessionCache] Set error:", error);
        }
    }
    async delete(reqMethod, targetUrl) {
        try {
            await this.ensureKeysListInitialized();
            const key = this.makeKey(reqMethod, targetUrl);
            // Remove both data and metadata in parallel
            await Promise.all([
                storage.removeItem(key),
                storage.removeMeta(key),
            ]);
            // Remove from keys list
            const keysList = await storage.getItem(this.keysListKey) || [];
            const updatedKeysList = keysList.filter(k => k !== key);
            await storage.setItem(this.keysListKey, updatedKeysList);
        }
        catch (error) {
            logger.error("[SessionCache] Delete error:", error);
        }
    }
    async clear() {
        try {
            await this.ensureKeysListInitialized();
            // Get all tracked keys for this group
            const keysList = await storage.getItem(this.keysListKey) || [];
            if (keysList.length > 0) {
                // Use bulk removal for better performance
                await storage.removeItems(keysList.map(key => ({
                    key: key,
                    options: { removeMeta: true }, // Also remove metadata
                })));
            }
            // Clear the keys list itself
            await storage.removeItem(this.keysListKey);
            this.isInitialized = false; // Reset initialization flag
            logger.info("[SessionCache] Cleared cache:", { count: keysList.length });
        }
        catch (error) {
            logger.error("[SessionCache] Clear error:", error);
        }
    }
}
