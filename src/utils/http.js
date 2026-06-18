export function normalizeHeaders(headersInit) {
    if (!headersInit)
        return [];
    if (headersInit instanceof Headers)
        return [...headersInit.entries()];
    if (Array.isArray(headersInit))
        return headersInit.map(([k, v]) => [k, String(v)]);
    // plain object shape
    const entries = [];
    for (const key of Object.keys(headersInit)) {
        const value = headersInit[key];
        entries.push([key, String(value)]);
    }
    return entries;
}
