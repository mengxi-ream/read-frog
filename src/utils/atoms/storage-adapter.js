import { storage } from "#imports";
import { isNonNullish } from "@/utils/utils";
export const storageAdapter = {
    async get(key, fallback, schema) {
        const value = await storage.getItem(`local:${key}`);
        if (isNonNullish(value)) {
            const parsedValue = schema.safeParse(value);
            if (parsedValue.success) {
                return parsedValue.data;
            }
        }
        return fallback;
    },
    async set(key, value, schema) {
        const parsedValue = schema.safeParse(value);
        if (parsedValue.success) {
            await storage.setItem(`local:${key}`, parsedValue.data);
        }
        else {
            throw new Error(parsedValue.error.message);
        }
    },
    async setMeta(key, meta) {
        await storage.setMeta(`local:${key}`, meta);
    },
    watch(key, callback) {
        const unwatch = storage.watch(`local:${key}`, (newValue) => {
            if (isNonNullish(newValue))
                callback(newValue);
        });
        return unwatch;
    },
};
