import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { JSDOM } from "jsdom";
class HttpError extends Error {
    status;
    url;
    constructor(status, url) {
        super(`Request failed (${status}) for ${url}`);
        this.name = "HttpError";
        this.status = status;
        this.url = url;
    }
}
const WHITESPACE_RE = /\s+/g;
const TRAILING_SLASHES_RE = /\/+$/;
const WHITESPACE_SPLIT_RE = /\s+/;
const BOOLEAN_TRUE_RE = /^(?:yes|y|true|supported|available|enabled|check|checked)$/i;
const BOOLEAN_FALSE_RE = /^(?:no|n|false|unsupported|disabled|none|x|cross)$/i;
const MODEL_HEADER_RE = /\bmodel\b/i;
const MODEL_CELL_TEXT_RE = /^model$/i;
const PROVIDER_PATH_RE = /^\/providers\/ai-sdk-providers\/([^/]+)$/;
const RETRYABLE_ERROR_RE = /network|fetch|timeout/i;
const NORMALIZATION_RULES = {
    imageInput: [
        /\bimage\b/i,
        /\bvision\b/i,
    ],
    audioInput: [
        /\baudio\b/i,
        /\bspeech\b/i,
    ],
    objectGeneration: [
        /object generation/i,
        /structured output/i,
        /json schema/i,
        /json mode/i,
    ],
    toolUsage: [
        /tool usage/i,
        /function calling/i,
        /\btools?\b/i,
    ],
};
function cleanText(value) {
    return (value ?? "").replace(WHITESPACE_RE, " ").trim();
}
function slugToName(slug) {
    return slug
        .split("-")
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}
function parseArgs(argv) {
    const options = {
        baseUrl: "https://ai-sdk.dev",
        indexPath: "/providers/ai-sdk-providers",
        outPath: "scripts/output/ai-sdk-provider-models.json",
        providersHtmlFile: undefined,
        concurrency: 5,
        timeoutMs: 15000,
    };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith("--")) {
            throw new Error(`Unknown argument "${arg}". Expected flags like --out <path>.`);
        }
        const key = arg.slice(2);
        const value = argv[i + 1];
        if (!value || value.startsWith("--")) {
            throw new Error(`Missing value for --${key}`);
        }
        i++;
        switch (key) {
            case "out":
                options.outPath = value;
                break;
            case "baseUrl":
                options.baseUrl = value;
                break;
            case "indexPath":
                options.indexPath = value;
                break;
            case "providersHtmlFile":
                options.providersHtmlFile = value;
                break;
            case "concurrency":
                options.concurrency = Number.parseInt(value, 10);
                break;
            case "timeoutMs":
                options.timeoutMs = Number.parseInt(value, 10);
                break;
            default:
                throw new Error(`Unknown option --${key}`);
        }
    }
    if (!Number.isFinite(options.concurrency) || options.concurrency < 1) {
        throw new Error(`--concurrency must be a positive integer. Received: ${options.concurrency}`);
    }
    if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1000) {
        throw new Error(`--timeoutMs must be >= 1000. Received: ${options.timeoutMs}`);
    }
    const normalizedBase = options.baseUrl.replace(TRAILING_SLASHES_RE, "");
    const normalizedIndex = options.indexPath.startsWith("/") ? options.indexPath : `/${options.indexPath}`;
    return {
        ...options,
        baseUrl: normalizedBase,
        indexPath: normalizedIndex,
        outPath: resolve(process.cwd(), options.outPath),
        providersHtmlFile: options.providersHtmlFile ? resolve(process.cwd(), options.providersHtmlFile) : undefined,
    };
}
function classNameValue(el) {
    const className = el.className;
    if (typeof className === "string") {
        return className;
    }
    if (className
        && typeof className === "object"
        && "baseVal" in className
        && typeof className.baseVal === "string") {
        return className.baseVal;
    }
    return "";
}
function collectClassTokens(root) {
    const set = new Set();
    const elements = [root, ...[...root.querySelectorAll("*")]];
    for (const element of elements) {
        const tokens = classNameValue(element).split(WHITESPACE_SPLIT_RE).filter(Boolean);
        for (const token of tokens) {
            set.add(token);
        }
    }
    return [...set];
}
function textToBoolean(value) {
    const text = value.toLowerCase().trim();
    if (!text) {
        return null;
    }
    if (BOOLEAN_TRUE_RE.test(text)) {
        return true;
    }
    if (BOOLEAN_FALSE_RE.test(text)) {
        return false;
    }
    return null;
}
function parseCapabilityCell(cell) {
    const text = cleanText(cell.textContent);
    const hasSvg = Boolean(cell.querySelector("svg"));
    if (hasSvg) {
        const classTokens = collectClassTokens(cell);
        if (classTokens.some(token => token.startsWith("text-green"))) {
            return true;
        }
        if (classTokens.some(token => token.startsWith("text-gray") || token.startsWith("text-red"))) {
            return false;
        }
        const pathValues = Array.from(cell.querySelectorAll("path"), path => path.getAttribute("d") ?? "")
            .join(" ");
        if (pathValues.includes("11.5303 6.53033")) {
            return true;
        }
        if (pathValues.includes("12.4697 13.5303")) {
            return false;
        }
    }
    const boolFromText = textToBoolean(text);
    if (boolFromText !== null) {
        return boolFromText;
    }
    return text || null;
}
function booleanFromCapability(value) {
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "string") {
        return textToBoolean(value);
    }
    return null;
}
function normalizeCapabilities(raw) {
    const normalized = {
        imageInput: null,
        audioInput: null,
        objectGeneration: null,
        toolUsage: null,
    };
    const entries = Object.entries(raw);
    for (const key of Object.keys(normalized)) {
        const patterns = NORMALIZATION_RULES[key];
        const matches = entries
            .filter(([header]) => patterns.some(pattern => pattern.test(header)))
            .map(([, value]) => booleanFromCapability(value))
            .filter((value) => value !== null);
        if (matches.includes(true)) {
            normalized[key] = true;
            continue;
        }
        if (matches.includes(false)) {
            normalized[key] = false;
        }
    }
    return normalized;
}
function assignUniqueKey(target, key, value) {
    if (!(key in target)) {
        target[key] = value;
        return;
    }
    let suffix = 2;
    let candidate = `${key} (${suffix})`;
    while (candidate in target) {
        suffix++;
        candidate = `${key} (${suffix})`;
    }
    target[candidate] = value;
}
function extractHeadersAndRows(table) {
    const allRows = [...table.rows];
    if (allRows.length === 0) {
        return { headers: [], rows: [] };
    }
    const headRow = table.tHead?.rows.item(0);
    if (headRow) {
        const headers = Array.from(headRow.cells, cell => cleanText(cell.textContent) || "Column");
        const bodyRows = table.tBodies.length > 0
            ? [...table.tBodies].flatMap(body => [...body.rows])
            : allRows.filter(row => row !== headRow);
        return { headers, rows: bodyRows };
    }
    const firstRow = allRows[0];
    const headerLike = [...firstRow.cells].every(cell => cell.tagName === "TH");
    if (headerLike) {
        const headers = Array.from(firstRow.cells, cell => cleanText(cell.textContent) || "Column");
        return {
            headers,
            rows: allRows.slice(1),
        };
    }
    const headers = Array.from(firstRow.cells, (_cell, index) => `Column ${index + 1}`);
    return { headers, rows: allRows };
}
function extractModelCellText(row, index) {
    const cell = row.cells.item(index) ?? row.cells.item(0);
    if (!cell) {
        return "";
    }
    const codeText = cleanText(cell.querySelector("code")?.textContent);
    if (codeText) {
        return codeText;
    }
    return cleanText(cell.textContent);
}
function tableLooksLikeModelTable(headers, rows) {
    const hasModelHeader = headers.some(header => MODEL_HEADER_RE.test(header));
    if (hasModelHeader) {
        return true;
    }
    return rows.some(row => Boolean(row.querySelector("code")));
}
function extractModelTables(providerHtml) {
    const dom = new JSDOM(providerHtml);
    const document = dom.window.document;
    const tables = [...document.querySelectorAll("table")];
    const parsedTables = [];
    for (const table of tables) {
        const { headers, rows } = extractHeadersAndRows(table);
        if (headers.length === 0 || rows.length === 0) {
            continue;
        }
        if (!tableLooksLikeModelTable(headers, rows)) {
            continue;
        }
        const modelColumnIndex = headers.findIndex(header => MODEL_HEADER_RE.test(header));
        const resolvedModelColumnIndex = modelColumnIndex >= 0 ? modelColumnIndex : 0;
        const models = [];
        for (const row of rows) {
            if (row.cells.length === 0) {
                continue;
            }
            const model = extractModelCellText(row, resolvedModelColumnIndex);
            if (!model || MODEL_CELL_TEXT_RE.test(model)) {
                continue;
            }
            const rawCapabilities = {};
            for (let cellIndex = 0; cellIndex < row.cells.length; cellIndex++) {
                if (cellIndex === resolvedModelColumnIndex) {
                    continue;
                }
                const header = cleanText(headers[cellIndex] ?? `Column ${cellIndex + 1}`);
                if (!header) {
                    continue;
                }
                const value = parseCapabilityCell(row.cells[cellIndex]);
                assignUniqueKey(rawCapabilities, header, value);
            }
            models.push({
                model,
                normalizedCapabilities: normalizeCapabilities(rawCapabilities),
                rawCapabilities,
            });
        }
        if (models.length > 0) {
            parsedTables.push({ headers, models });
        }
    }
    return parsedTables;
}
function discoverProvidersFromHtml(html, baseUrl) {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const anchors = [...document.querySelectorAll("a[href]")];
    const providers = new Map();
    for (const anchor of anchors) {
        const href = anchor.getAttribute("href");
        if (!href) {
            continue;
        }
        let url;
        try {
            url = new URL(href, baseUrl);
        }
        catch {
            continue;
        }
        const normalizedPath = url.pathname.replace(TRAILING_SLASHES_RE, "");
        const match = normalizedPath.match(PROVIDER_PATH_RE);
        if (!match) {
            continue;
        }
        const slug = decodeURIComponent(match[1]);
        if (!slug || providers.has(slug)) {
            continue;
        }
        const name = cleanText(anchor.textContent) || slugToName(slug);
        providers.set(slug, {
            slug,
            name,
            path: normalizedPath,
            url: new URL(normalizedPath, baseUrl).toString(),
        });
    }
    return [...providers.values()];
}
function isRetryable(error) {
    if (error instanceof HttpError) {
        return error.status === 429 || error.status >= 500;
    }
    if (error && typeof error === "object" && "name" in error && error.name === "AbortError") {
        return true;
    }
    if (error instanceof Error) {
        return RETRYABLE_ERROR_RE.test(error.message);
    }
    return false;
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function fetchText(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                "accept": "text/html,application/xhtml+xml",
                "user-agent": "read-frog-ai-sdk-provider-scraper/1.0",
            },
        });
        if (!response.ok) {
            throw new HttpError(response.status, url);
        }
        return await response.text();
    }
    finally {
        clearTimeout(timer);
    }
}
async function fetchTextWithRetry(url, timeoutMs, retries = 1) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fetchText(url, timeoutMs);
        }
        catch (error) {
            lastError = error;
            if (attempt === retries || !isRetryable(error)) {
                break;
            }
            await sleep(500 * (attempt + 1));
        }
    }
    if (lastError instanceof Error) {
        throw lastError;
    }
    throw new Error(String(lastError));
}
async function mapWithConcurrency(values, concurrency, worker) {
    if (values.length === 0) {
        return [];
    }
    const results = Array.from({ length: values.length });
    let cursor = 0;
    const workerCount = Math.min(concurrency, values.length);
    const runners = Array.from({ length: workerCount }, async () => {
        while (true) {
            const index = cursor;
            cursor++;
            if (index >= values.length) {
                return;
            }
            results[index] = await worker(values[index], index);
        }
    });
    await Promise.all(runners);
    return results;
}
async function main() {
    const options = parseArgs(process.argv.slice(2));
    const indexUrl = new URL(options.indexPath, `${options.baseUrl}/`).toString();
    const discoveryHtml = options.providersHtmlFile
        ? await readFile(options.providersHtmlFile, "utf8")
        : await fetchTextWithRetry(indexUrl, options.timeoutMs);
    const providers = discoverProvidersFromHtml(discoveryHtml, options.baseUrl);
    if (providers.length === 0) {
        throw new Error("No provider pages were discovered from the index HTML.");
    }
    const providerResults = [];
    const errors = [];
    const processed = await mapWithConcurrency(providers, options.concurrency, async (provider) => {
        try {
            const html = await fetchTextWithRetry(provider.url, options.timeoutMs);
            const tables = extractModelTables(html);
            return { provider: { ...provider, tables }, error: null };
        }
        catch (error) {
            return {
                provider: null,
                error: {
                    slug: provider.slug,
                    url: provider.url,
                    stage: "fetch",
                    message: error instanceof Error ? error.message : String(error),
                },
            };
        }
    });
    for (const item of processed) {
        if (item.provider) {
            providerResults.push(item.provider);
        }
        if (item.error) {
            errors.push(item.error);
        }
    }
    const totalModels = providerResults.reduce((sum, provider) => {
        return sum + provider.tables.reduce((tableSum, table) => tableSum + table.models.length, 0);
    }, 0);
    const output = {
        meta: {
            scrapedAt: new Date().toISOString(),
            baseUrl: options.baseUrl,
            indexPath: options.indexPath,
            providersDiscovered: providers.length,
            providersSucceeded: providerResults.length,
            providersFailed: errors.length,
            totalModels,
        },
        providers: providerResults,
        errors,
    };
    await mkdir(dirname(options.outPath), { recursive: true });
    await writeFile(options.outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    console.log(`Scrape completed.`);
    console.log(`Discovered providers: ${providers.length}`);
    console.log(`Succeeded: ${providerResults.length}`);
    console.log(`Failed: ${errors.length}`);
    console.log(`Total models parsed: ${totalModels}`);
    console.log(`Output: ${options.outPath}`);
}
main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
