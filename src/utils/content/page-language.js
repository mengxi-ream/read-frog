import { ISO6393_TO_6391, LANG_CODE_ISO6393_OPTIONS, LOCALE_TO_ISO6393, } from "@read-frog/definitions";
import { detectLanguageWithSource } from "./language";
export const PAGE_LANGUAGE_TEXT_SAMPLE_LIMIT = 3000;
const MIN_TEXT_LENGTH_FOR_METADATA_VERIFICATION = 80;
const SHOW_TEXT = 4;
const FILTER_ACCEPT = 1;
const FILTER_REJECT = 2;
const LANGUAGE_META_KEYS = new Set([
    "content-language",
    "dc.language",
    "dcterms.language",
    "inlanguage",
    "language",
    "og:locale",
]);
const SKIPPED_TEXT_PARENT_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "IFRAME",
    "SVG",
]);
const TRADITIONAL_CHINESE_REGIONS = new Set(["hk", "mo", "tw"]);
const ISO6393_BY_LOWERCASE = new Map(LANG_CODE_ISO6393_OPTIONS.map(code => [code.toLowerCase(), code]));
const ISO6391_TO_ISO6393 = createISO6391ToISO6393Map();
function createISO6391ToISO6393Map() {
    const localeMap = new Map();
    for (const [iso6393, iso6391] of Object.entries(ISO6393_TO_6391)) {
        if (iso6391 && !localeMap.has(iso6391.toLowerCase())) {
            localeMap.set(iso6391.toLowerCase(), iso6393);
        }
    }
    for (const [locale, iso6393] of Object.entries(LOCALE_TO_ISO6393)) {
        if (iso6393) {
            localeMap.set(locale.toLowerCase(), iso6393);
        }
    }
    return localeMap;
}
function resolveLanguageToken(token) {
    const normalizedToken = token
        .replace(/_/g, "-")
        .replace(/\..*$/, "")
        .trim();
    if (!normalizedToken)
        return null;
    const lowercaseToken = normalizedToken.toLowerCase();
    const exactISO6393 = ISO6393_BY_LOWERCASE.get(lowercaseToken);
    if (exactISO6393)
        return exactISO6393;
    const parts = lowercaseToken.split("-").filter(Boolean);
    if (parts[0] === "zh") {
        if (parts.includes("yue"))
            return "yue";
        if (parts.includes("hant") || parts.some(part => TRADITIONAL_CHINESE_REGIONS.has(part)))
            return "cmn-Hant";
        return "cmn";
    }
    const exactLocale = ISO6391_TO_ISO6393.get(lowercaseToken);
    if (exactLocale)
        return exactLocale;
    const primaryLanguage = parts[0];
    return primaryLanguage ? ISO6391_TO_ISO6393.get(primaryLanguage) ?? null : null;
}
export function resolveLanguageCodeFromLocale(value) {
    if (!value)
        return null;
    const tokens = value.split(/[,;]/);
    for (const token of tokens) {
        const code = resolveLanguageToken(token);
        if (code)
            return code;
    }
    return null;
}
function getMetaLanguageCandidates(doc) {
    const candidates = [];
    const htmlLang = doc.documentElement?.getAttribute("lang");
    if (htmlLang)
        candidates.push(htmlLang);
    for (const meta of Array.from(doc.querySelectorAll("meta"))) {
        const keys = [
            meta.getAttribute("http-equiv"),
            meta.getAttribute("name"),
            meta.getAttribute("property"),
            meta.getAttribute("itemprop"),
        ].map(value => value?.trim().toLowerCase()).filter((value) => Boolean(value));
        if (keys.some(key => LANGUAGE_META_KEYS.has(key))) {
            const content = meta.getAttribute("content");
            if (content)
                candidates.push(content);
        }
    }
    return candidates;
}
function normalizeTextSample(text) {
    return text.replace(/\s+/g, " ").trim();
}
function getTextParentElement(node) {
    const parent = node.parentNode;
    return parent?.nodeType === Node.ELEMENT_NODE ? parent : null;
}
function collectPageTextSample(root, maxLength = PAGE_LANGUAGE_TEXT_SAMPLE_LIMIT) {
    if (!root || maxLength <= 0)
        return "";
    const doc = root.nodeType === Node.DOCUMENT_NODE
        ? root
        : root.ownerDocument;
    if (!doc?.createTreeWalker)
        return normalizeTextSample(root.textContent ?? "").slice(0, maxLength);
    const walker = doc.createTreeWalker(root, SHOW_TEXT, {
        acceptNode(node) {
            const parentElement = getTextParentElement(node);
            if (!parentElement || SKIPPED_TEXT_PARENT_TAGS.has(parentElement.tagName))
                return FILTER_REJECT;
            return normalizeTextSample(node.textContent ?? "") ? FILTER_ACCEPT : FILTER_REJECT;
        },
    });
    let sample = "";
    let currentNode = walker.nextNode();
    while (currentNode && sample.length < maxLength) {
        const text = normalizeTextSample(currentNode.textContent ?? "");
        if (text) {
            const separator = sample ? " " : "";
            const remainingLength = maxLength - sample.length - separator.length;
            if (remainingLength <= 0)
                break;
            sample += `${separator}${text.slice(0, remainingLength)}`;
        }
        currentNode = walker.nextNode();
    }
    return sample;
}
function areCompatibleDetectedCodes(metadataCode, textCode) {
    return textCode === metadataCode || (metadataCode === "cmn-Hant" && textCode === "cmn");
}
export async function detectPageLanguageLightweight(doc = document) {
    let metadataCode = null;
    for (const candidate of getMetaLanguageCandidates(doc)) {
        const code = resolveLanguageCodeFromLocale(candidate);
        if (code) {
            metadataCode = code;
            break;
        }
    }
    const textForDetection = [
        doc.title,
        collectPageTextSample(doc.body),
    ].filter(Boolean).join("\n\n");
    if (metadataCode && textForDetection.trim().length < MIN_TEXT_LENGTH_FOR_METADATA_VERIFICATION) {
        return {
            detectedCodeOrUnd: metadataCode,
            detectionSource: "metadata",
        };
    }
    const { code, source } = await detectLanguageWithSource(textForDetection, {
        enableLLM: false,
    });
    if (metadataCode && (code === "und" || areCompatibleDetectedCodes(metadataCode, code))) {
        return {
            detectedCodeOrUnd: metadataCode,
            detectionSource: "metadata",
        };
    }
    return {
        detectedCodeOrUnd: code,
        detectionSource: source,
    };
}
