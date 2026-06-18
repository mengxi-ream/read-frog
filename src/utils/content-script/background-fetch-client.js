import { sendMessage } from "@/utils/message";
function getRequestUrl(input) {
    if (typeof input === "string") {
        return input;
    }
    if (input instanceof URL) {
        return input.toString();
    }
    return input.url;
}
function getRequestHeaders(input, init) {
    const headers = init?.headers ?? (input instanceof Request ? input.headers : undefined);
    if (!headers) {
        return undefined;
    }
    const entries = [...new Headers(headers).entries()];
    return entries.length > 0 ? entries : undefined;
}
function getRequestMethod(input, init) {
    return (init?.method ?? (input instanceof Request ? input.method : undefined) ?? "GET").toUpperCase();
}
function getRequestBody(init) {
    if (typeof init?.body === "string") {
        return init.body;
    }
    if (init?.body instanceof URLSearchParams) {
        return init.body.toString();
    }
    return undefined;
}
function decodeBase64ToUint8Array(base64) {
    const decoded = atob(base64);
    const bytes = new Uint8Array(decoded.length);
    for (let index = 0; index < decoded.length; index += 1) {
        bytes[index] = decoded.charCodeAt(index);
    }
    return bytes;
}
export function proxyResponseToResponse(response) {
    const body = (response.bodyEncoding ?? "text") === "base64"
        ? decodeBase64ToUint8Array(response.body)
        : response.body;
    return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
    });
}
function buildProxyRequest(input, init, options) {
    return {
        url: getRequestUrl(input),
        method: getRequestMethod(input, init),
        headers: getRequestHeaders(input, init),
        body: getRequestBody(init),
        credentials: options?.credentials,
        cacheConfig: options?.cacheConfig,
        responseType: options?.responseType ?? "text",
    };
}
export async function backgroundFetch(input, init, options) {
    const response = await sendMessage("backgroundFetch", buildProxyRequest(input, init, options));
    return proxyResponseToResponse(response);
}
