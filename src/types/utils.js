export function pick(obj, keys) {
    const res = {};
    for (const key of keys) {
        if (key in obj) {
            res[key] = obj[key];
        }
    }
    return res;
}
export function omit(obj, keys) {
    const res = { ...obj };
    for (const key of keys) {
        delete res[key];
    }
    return res;
}
/**
 * Remove entries with empty string, null, or undefined values from an object.
 */
export function compactObject(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== "" && v != null));
}
