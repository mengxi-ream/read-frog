import { getRandomUUID } from "@/utils/crypto-polyfill";
import { getUniqueName } from "@/utils/name";
export const ICON_PATTERN = /^[^:\s]+:[^:\s]+$/;
export const DEFAULT_ACTION_NAME = "Custom AI Action";
export function createOutputSchemaField(name, type = "string", description = "", id, speaking = false) {
    return {
        id: id ?? getRandomUUID(),
        name,
        type,
        description,
        speaking,
    };
}
export function getNextOutputFieldName(fields, prefix) {
    const existingNames = new Set(fields.map(f => f.name));
    existingNames.add(prefix);
    return getUniqueName(prefix, existingNames, "");
}
export function normalizeOutputSchemaFieldName(name) {
    return name.trim();
}
export function isOutputSchemaFieldNameBlank(name) {
    return normalizeOutputSchemaFieldName(name).length === 0;
}
export function isDuplicateOutputSchemaFieldName(name, fields, currentFieldId) {
    const normalizedName = normalizeOutputSchemaFieldName(name);
    return fields.some(field => field.id !== currentFieldId && normalizeOutputSchemaFieldName(field.name) === normalizedName);
}
export function getOutputSchemaFieldNameError(name, fields, currentFieldId) {
    if (isOutputSchemaFieldNameBlank(name)) {
        return "blank";
    }
    if (isDuplicateOutputSchemaFieldName(name, fields, currentFieldId)) {
        return "duplicate";
    }
    return undefined;
}
export const SELECTION_TOOLBAR_CUSTOM_ACTION_TOKENS = ["selection", "paragraphs", "targetLanguage", "webTitle", "webContent"];
export function getSelectionToolbarCustomActionTokenCellText(token) {
    return `{{${token}}}`;
}
