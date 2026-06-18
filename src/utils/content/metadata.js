function normalizeMetaContent(value) {
    return value?.replace(/\s+/g, " ").trim() ?? "";
}
export function getDocumentDescription(doc = document) {
    const selectors = [
        "meta[name=\"description\"]",
        "meta[property=\"og:description\"]",
        "meta[name=\"twitter:description\"]",
    ];
    for (const selector of selectors) {
        const content = normalizeMetaContent(doc.querySelector(selector)?.content);
        if (content) {
            return content;
        }
    }
    return "";
}
