import { getRandomUUID } from "@/utils/crypto-polyfill";
import { sanitizeCustomActionNotebaseConnection } from "./connection";
export function createNotebaseMapping(localFieldId, notebaseColumnId, notebaseColumnNameSnapshot) {
    return {
        id: getRandomUUID(),
        localFieldId,
        notebaseColumnId,
        notebaseColumnNameSnapshot,
    };
}
export function isSupportedNotebaseColumnConfig(config) {
    return config.type === "string" || config.type === "number";
}
export function isNotebaseMappingCompatible(localType, notebaseColumnConfig) {
    return isSupportedNotebaseColumnConfig(notebaseColumnConfig)
        && localType === notebaseColumnConfig.type;
}
export function resolveNotebaseMappings(action, schema) {
    const connection = sanitizeCustomActionNotebaseConnection(action.notebaseConnection, action.outputSchema);
    if (!connection) {
        return [];
    }
    const outputFields = new Map(action.outputSchema.map(field => [field.id, field]));
    const notebaseColumns = new Map(schema?.notebaseColumns.map(column => [column.id, column]) ?? []);
    return connection.mappings.map((mapping) => {
        const localField = outputFields.get(mapping.localFieldId) ?? null;
        const notebaseColumn = notebaseColumns.get(mapping.notebaseColumnId) ?? null;
        if (!localField) {
            return { localField, mapping, notebaseColumn, status: "missing_local" };
        }
        if (!schema) {
            return { localField, mapping, notebaseColumn, status: "missing_schema" };
        }
        if (!notebaseColumn) {
            return { localField, mapping, notebaseColumn, status: "missing_remote" };
        }
        if (!isNotebaseMappingCompatible(localField.type, notebaseColumn.config)) {
            return { localField, mapping, notebaseColumn, status: "incompatible" };
        }
        return { localField, mapping, notebaseColumn, status: "valid" };
    });
}
export function validateNotebaseMappings(action, schema) {
    const resolvedMappings = resolveNotebaseMappings(action, schema);
    if (resolvedMappings.length === 0) {
        return { kind: "empty", resolvedMappings };
    }
    const invalidMapping = resolvedMappings.find((mapping) => mapping.status !== "valid");
    if (invalidMapping) {
        return {
            kind: "invalid",
            reason: invalidMapping.status,
            resolvedMappings,
        };
    }
    return { kind: "valid", resolvedMappings };
}
export function buildNotebaseRowCells(action, schema, result) {
    const cells = {};
    const resolvedMappings = resolveNotebaseMappings(action, schema);
    for (const resolvedMapping of resolvedMappings) {
        if (resolvedMapping.status !== "valid" || !resolvedMapping.localField || !resolvedMapping.notebaseColumn) {
            continue;
        }
        cells[resolvedMapping.notebaseColumn.id] = result?.[resolvedMapping.localField.name] ?? null;
    }
    return {
        cells,
        resolvedMappings,
    };
}
