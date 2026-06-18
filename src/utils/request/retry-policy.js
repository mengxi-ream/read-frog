export const REQUEST_ERROR_META = Symbol("requestErrorMeta");
export const MAX_RETRY_AFTER_MS = 5 * 60_000;
const RATE_LIMIT_ERROR_RE = /\b429\b|too many requests|rate[ -]?limit/i;
const TIMEOUT_ERROR_RE = /timed? out|timeout/i;
const NETWORK_ERROR_RE = /network error|failed to fetch|fetch failed/i;
export function attachRequestErrorMeta(error, meta) {
    Object.defineProperty(error, REQUEST_ERROR_META, {
        value: {
            ...getRequestErrorMeta(error),
            ...meta,
        },
        configurable: true,
    });
    return error;
}
export function getRequestErrorMeta(error) {
    const source = isObject(error) ? error : undefined;
    const attachedMeta = source?.[REQUEST_ERROR_META] ?? source?.requestErrorMeta;
    const response = isObject(source?.response) ? source.response : undefined;
    const statusCode = normalizeStatusCode(attachedMeta?.statusCode
        ?? source?.statusCode
        ?? source?.status
        ?? response?.statusCode
        ?? response?.status);
    const responseHeaders = normalizeHeaders(attachedMeta?.responseHeaders
        ?? source?.responseHeaders
        ?? source?.headers
        ?? response?.responseHeaders
        ?? response?.headers);
    const retryAfterMs = normalizeNonNegativeNumber(attachedMeta?.retryAfterMs ?? source?.retryAfterMs)
        ?? getRetryAfterMsFromHeaders(responseHeaders);
    const isRetryable = normalizeBoolean(attachedMeta?.isRetryable ?? source?.isRetryable);
    const message = typeof source?.message === "string" ? source.message : "";
    const kind = normalizeKind(attachedMeta?.kind ?? source?.kind)
        ?? inferRequestErrorKind({ statusCode, message });
    return removeUndefined({
        statusCode,
        responseHeaders,
        retryAfterMs,
        isRetryable,
        kind,
    });
}
export function getRetryAfterMs(meta, now = Date.now()) {
    const directRetryAfterMs = normalizeNonNegativeNumber(meta.retryAfterMs);
    if (directRetryAfterMs !== undefined) {
        return directRetryAfterMs;
    }
    return getRetryAfterMsFromHeaders(meta.responseHeaders, now);
}
export function getHeaderValue(headers, key) {
    if (!headers) {
        return undefined;
    }
    if (typeof Headers !== "undefined" && headers instanceof Headers) {
        return headers.get(key) ?? headers.get(key.toLowerCase()) ?? undefined;
    }
    const normalizedKey = key.toLowerCase();
    if (Array.isArray(headers)) {
        const entry = headers.find((header) => {
            return Array.isArray(header) && header.length >= 2 && String(header[0]).toLowerCase() === normalizedKey;
        });
        const value = entry?.[1];
        return typeof value === "string" ? value : undefined;
    }
    if (isObject(headers)) {
        const entry = Object.entries(headers).find(([headerKey]) => headerKey.toLowerCase() === normalizedKey);
        const value = entry?.[1];
        return typeof value === "string" ? value : undefined;
    }
    return undefined;
}
export function isRateLimitRequestError(error) {
    const meta = getRequestErrorMeta(error);
    return meta.kind === "rate-limit" || meta.statusCode === 429;
}
export const defaultRequestRetryPolicy = {
    decide(error, context) {
        const meta = getRequestErrorMeta(error);
        if (isQueueFatalRequestErrorMeta(meta)) {
            return { action: "fail", failQueue: true };
        }
        if (context.retryCount >= context.maxRetries || !isRetryableRequestErrorMeta(meta)) {
            return { action: "fail" };
        }
        const baseDelayMs = context.baseRetryDelayMs * (2 ** context.retryCount);
        const delayMs = clampRetryDelay(withJitter(baseDelayMs, false));
        return { action: "retry", delayMs };
    },
};
function isQueueFatalRequestErrorMeta(meta) {
    if (meta.kind === "rate-limit" || meta.statusCode === 429) {
        return true;
    }
    return meta.statusCode === 401
        || meta.statusCode === 403
        || meta.statusCode === 404;
}
function isRetryableRequestErrorMeta(meta) {
    if (typeof meta.isRetryable === "boolean") {
        return meta.isRetryable;
    }
    if (meta.kind === "bad-request") {
        return false;
    }
    if (meta.kind === "rate-limit" || meta.kind === "timeout" || meta.kind === "network") {
        return true;
    }
    const { statusCode } = meta;
    if (statusCode !== undefined) {
        if (statusCode === 408 || statusCode === 409 || statusCode === 429 || statusCode >= 500) {
            return true;
        }
        if (statusCode >= 400 && statusCode < 500) {
            return false;
        }
    }
    return true;
}
function getRetryAfterMsFromHeaders(headers, now = Date.now()) {
    const retryAfterMs = getHeaderValue(headers, "retry-after-ms");
    if (retryAfterMs) {
        const parsed = Number.parseFloat(retryAfterMs);
        if (Number.isFinite(parsed) && parsed >= 0) {
            return parsed;
        }
    }
    const retryAfter = getHeaderValue(headers, "retry-after");
    if (!retryAfter) {
        return undefined;
    }
    const timeoutSeconds = Number.parseFloat(retryAfter);
    if (Number.isFinite(timeoutSeconds) && timeoutSeconds >= 0) {
        return timeoutSeconds * 1000;
    }
    const parsedDateMs = Date.parse(retryAfter);
    if (!Number.isNaN(parsedDateMs)) {
        return Math.max(0, parsedDateMs - now);
    }
    return undefined;
}
function normalizeHeaders(headers) {
    if (!headers) {
        return undefined;
    }
    if (typeof Headers !== "undefined" && headers instanceof Headers) {
        return headers;
    }
    if (Array.isArray(headers)) {
        const normalized = {};
        for (const entry of headers) {
            if (!Array.isArray(entry) || entry.length < 2) {
                continue;
            }
            const [key, value] = entry;
            if (typeof key === "string" && typeof value === "string") {
                normalized[key] = value;
            }
        }
        return Object.keys(normalized).length > 0 ? normalized : undefined;
    }
    if (isObject(headers)) {
        const normalized = {};
        for (const [key, value] of Object.entries(headers)) {
            if (typeof value === "string") {
                normalized[key] = value;
            }
        }
        return Object.keys(normalized).length > 0 ? normalized : undefined;
    }
    return undefined;
}
function inferRequestErrorKind({ statusCode, message }) {
    if (statusCode === 429 || RATE_LIMIT_ERROR_RE.test(message)) {
        return "rate-limit";
    }
    if (statusCode === 408) {
        return "timeout";
    }
    if (statusCode === 409) {
        return "unknown";
    }
    if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
        return "bad-request";
    }
    if (TIMEOUT_ERROR_RE.test(message)) {
        return "timeout";
    }
    if (NETWORK_ERROR_RE.test(message)) {
        return "network";
    }
    return "unknown";
}
function normalizeKind(value) {
    return value === "rate-limit"
        || value === "timeout"
        || value === "network"
        || value === "bad-request"
        || value === "unknown"
        ? value
        : undefined;
}
function normalizeStatusCode(value) {
    if (typeof value !== "number" || !Number.isInteger(value)) {
        return undefined;
    }
    return value;
}
function normalizeNonNegativeNumber(value) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        return undefined;
    }
    return value;
}
function normalizeBoolean(value) {
    return typeof value === "boolean" ? value : undefined;
}
function isObject(value) {
    return typeof value === "object" && value !== null;
}
function withJitter(delayMs, disabled) {
    if (disabled) {
        return delayMs;
    }
    return delayMs + Math.random() * 0.1 * delayMs;
}
function clampRetryDelay(delayMs) {
    return Math.min(Math.max(0, delayMs), MAX_RETRY_AFTER_MS);
}
function removeUndefined(value) {
    return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}
