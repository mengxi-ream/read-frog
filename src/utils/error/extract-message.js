/**
 * Extract error message from API response
 * Handles various error formats: JSON string, { error: { message } }, { message }, plain text
 */
export async function extractErrorMessage(response) {
    const fallback = `${response.status} ${response.statusText}`;
    const text = await response.text();
    if (!text)
        return fallback;
    try {
        const json = JSON.parse(text);
        if (typeof json === "string")
            return json;
        if (json.error?.message)
            return json.error.message;
        if (json.message)
            return json.message;
        return fallback;
    }
    catch {
        return text.slice(0, 100);
    }
}
function getNonEmptyString(value) {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
export function extractAISDKErrorMessage(error) {
    if (typeof error === "string") {
        return error;
    }
    if (typeof error === "object" && error !== null) {
        const source = error;
        const message = getNonEmptyString(source.message);
        const responseBody = getNonEmptyString(source.responseBody);
        const text = getNonEmptyString(source.text);
        if (isGenericAISDKErrorMessage(message)) {
            return responseBody ?? text ?? message ?? "Unexpected error occurred";
        }
        return message
            ?? responseBody
            ?? text
            ?? "Unexpected error occurred";
    }
    return "Unexpected error occurred";
}
function isGenericAISDKErrorMessage(message) {
    if (!message) {
        return true;
    }
    const normalizedMessage = message.trim().toLowerCase();
    return normalizedMessage === "something went wrong"
        || normalizedMessage === "unexpected error occurred";
}
