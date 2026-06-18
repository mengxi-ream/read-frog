import { selectionToolbarCustomActionNotebaseAccountSchema } from "@/types/config/selection-toolbar";
export function createNotebaseConnectedAccountSnapshot(account) {
    const parsedAccount = selectionToolbarCustomActionNotebaseAccountSchema.safeParse(account);
    return parsedAccount.success ? parsedAccount.data : undefined;
}
export function isSameNotebaseAccount(storedAccount, currentAccount) {
    return !!storedAccount && !!currentAccount && storedAccount.id === currentAccount.id;
}
export function isConnectedNotebaseInList(connection, notebases) {
    return !!connection && !!notebases?.some(notebase => notebase.id === connection.notebaseId);
}
export function classifyConnectedNotebaseOwnership({ connection, currentAccount, isOwned, }) {
    if (isOwned) {
        return { kind: "owned" };
    }
    return isSameNotebaseAccount(connection.connectedAccount, currentAccount)
        ? { kind: "notebase_unavailable" }
        : { kind: "foreign_account" };
}
export function refreshNotebaseConnectionAccountSnapshot(connection, connectedAccount, notebaseNameSnapshot) {
    return {
        ...connection,
        notebaseNameSnapshot: notebaseNameSnapshot?.trim() || connection.notebaseNameSnapshot,
        connectedAccount,
    };
}
export function formatNotebaseConnectedAccountLabel(account) {
    return account ? `${account.name} (${account.email})` : null;
}
export function sanitizeCustomActionNotebaseConnection(connection, outputSchema) {
    if (!connection) {
        return undefined;
    }
    const notebaseId = connection.notebaseId.trim();
    if (!notebaseId) {
        return undefined;
    }
    const outputFieldIds = new Set(outputSchema.map(field => field.id));
    const connectedAccount = createNotebaseConnectedAccountSnapshot(connection.connectedAccount);
    if (!connectedAccount) {
        return undefined;
    }
    const mappingIds = new Set();
    const localFieldIds = new Set();
    const notebaseColumnIds = new Set();
    const mappings = connection.mappings.filter((mapping) => {
        if (!outputFieldIds.has(mapping.localFieldId)) {
            return false;
        }
        if (!mapping.localFieldId.trim() || !mapping.notebaseColumnId.trim()) {
            return false;
        }
        if (mappingIds.has(mapping.id) || localFieldIds.has(mapping.localFieldId) || notebaseColumnIds.has(mapping.notebaseColumnId)) {
            return false;
        }
        mappingIds.add(mapping.id);
        localFieldIds.add(mapping.localFieldId);
        notebaseColumnIds.add(mapping.notebaseColumnId);
        return true;
    }).map(mapping => ({
        ...mapping,
        notebaseColumnNameSnapshot: mapping.notebaseColumnNameSnapshot.trim() || mapping.notebaseColumnId,
    }));
    return {
        notebaseId,
        notebaseNameSnapshot: connection.notebaseNameSnapshot.trim() || notebaseId,
        connectedAccount,
        mappings,
    };
}
export function sanitizeSelectionToolbarCustomAction(action) {
    return {
        ...action,
        notebaseConnection: sanitizeCustomActionNotebaseConnection(action.notebaseConnection, action.outputSchema),
    };
}
