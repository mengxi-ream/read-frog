import { langCodeISO6393Schema } from "@read-frog/definitions";
import { DEFAULT_DETECTED_CODE } from "../constants/config";
import { sendMessage } from "../message";
export function getFinalSourceCode(sourceCode, detectedCode) {
    return sourceCode === "auto" ? detectedCode : sourceCode;
}
export function normalizeDetectedCode(value) {
    const parsedCode = langCodeISO6393Schema.safeParse(value);
    return parsedCode.success ? parsedCode.data : DEFAULT_DETECTED_CODE;
}
export async function getDetectedCodeFromStorage() {
    try {
        const detectedCode = await sendMessage("getDetectedCode", undefined);
        return normalizeDetectedCode(detectedCode);
    }
    catch {
        return DEFAULT_DETECTED_CODE;
    }
}
