// Dynamically adapt to all API key situations, theoretically should not fail
export function getObjectWithoutAPIKeys(originalObject) {
    function deepClean(obj) {
        if (Array.isArray(obj)) {
            return obj.map(deepClean);
        }
        if (obj && typeof obj === "object") {
            const newObj = {};
            for (const key in obj) {
                if (key === "apiKey") {
                    continue;
                }
                newObj[key] = deepClean(obj[key]);
            }
            return newObj;
        }
        return obj;
    }
    try {
        return deepClean(originalObject);
    }
    catch {
        return originalObject;
    }
}
export function hasAPIKey(obj) {
    function deepCheck(obj) {
        if (Array.isArray(obj)) {
            return obj.some(deepCheck);
        }
        if (obj && typeof obj === "object") {
            for (const key in obj) {
                if (key === "apiKey" && obj[key]) {
                    return true;
                }
                if (deepCheck(obj[key])) {
                    return true;
                }
            }
        }
        return false;
    }
    try {
        return deepCheck(obj);
    }
    catch {
        return false;
    }
}
