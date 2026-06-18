import { z } from "zod";
export const selectionToolbarCustomActionOutputTypeSchema = z.enum(["string", "number"]);
export const selectionToolbarCustomActionOutputFieldSchema = z.object({
    id: z.string().nonempty(),
    name: z.string().trim().min(1),
    type: selectionToolbarCustomActionOutputTypeSchema,
    description: z.string(),
    speaking: z.boolean(),
});
export const selectionToolbarCustomActionNotebaseMappingSchema = z.object({
    id: z.string().nonempty(),
    localFieldId: z.string().nonempty(),
    notebaseColumnId: z.string().nonempty(),
    notebaseColumnNameSnapshot: z.string().trim().min(1),
});
export const selectionToolbarCustomActionNotebaseAccountSchema = z.object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    email: z.string().trim().min(1),
    image: z.string().trim().min(1).nullable().optional(),
});
export const selectionToolbarCustomActionNotebaseConnectionSchema = z.object({
    notebaseId: z.string().nonempty(),
    notebaseNameSnapshot: z.string().trim().min(1),
    connectedAccount: selectionToolbarCustomActionNotebaseAccountSchema,
    mappings: z.array(selectionToolbarCustomActionNotebaseMappingSchema),
});
export const selectionToolbarCustomActionSchema = z.object({
    id: z.string().nonempty(),
    name: z.string().nonempty(),
    enabled: z.boolean().optional(),
    icon: z.string(),
    providerId: z.string().nonempty(),
    systemPrompt: z.string(),
    prompt: z.string(),
    outputSchema: z.array(selectionToolbarCustomActionOutputFieldSchema).min(1),
    notebaseConnection: selectionToolbarCustomActionNotebaseConnectionSchema.optional(),
}).superRefine((action, ctx) => {
    const nameSet = new Set();
    const outputFieldIds = new Set();
    action.outputSchema.forEach((field, index) => {
        if (nameSet.has(field.name)) {
            ctx.addIssue({
                code: "custom",
                message: `Duplicate output schema name "${field.name}".`,
                path: ["outputSchema", index, "name"],
            });
            return;
        }
        nameSet.add(field.name);
        outputFieldIds.add(field.id);
    });
    const connection = action.notebaseConnection;
    if (!connection) {
        return;
    }
    const mappingIdSet = new Set();
    const localFieldIdSet = new Set();
    const notebaseColumnIdSet = new Set();
    connection.mappings.forEach((mapping, index) => {
        if (mappingIdSet.has(mapping.id)) {
            ctx.addIssue({
                code: "custom",
                message: `Duplicate notebase mapping id "${mapping.id}".`,
                path: ["notebaseConnection", "mappings", index, "id"],
            });
        }
        mappingIdSet.add(mapping.id);
        if (!outputFieldIds.has(mapping.localFieldId)) {
            ctx.addIssue({
                code: "custom",
                message: `Unknown output field id "${mapping.localFieldId}" in notebase mapping.`,
                path: ["notebaseConnection", "mappings", index, "localFieldId"],
            });
        }
        if (localFieldIdSet.has(mapping.localFieldId)) {
            ctx.addIssue({
                code: "custom",
                message: `Duplicate local field id "${mapping.localFieldId}" in notebase mappings.`,
                path: ["notebaseConnection", "mappings", index, "localFieldId"],
            });
        }
        localFieldIdSet.add(mapping.localFieldId);
        if (notebaseColumnIdSet.has(mapping.notebaseColumnId)) {
            ctx.addIssue({
                code: "custom",
                message: `Duplicate notebase column id "${mapping.notebaseColumnId}" in notebase mappings.`,
                path: ["notebaseConnection", "mappings", index, "notebaseColumnId"],
            });
        }
        notebaseColumnIdSet.add(mapping.notebaseColumnId);
    });
});
export const selectionToolbarCustomActionsSchema = z.array(selectionToolbarCustomActionSchema).superRefine((actions, ctx) => {
    const idSet = new Set();
    actions.forEach((action, index) => {
        if (idSet.has(action.id)) {
            ctx.addIssue({
                code: "custom",
                message: `Duplicate action id "${action.id}"`,
                path: [index, "id"],
            });
        }
        idSet.add(action.id);
    });
    const nameSet = new Set();
    actions.forEach((action, index) => {
        if (nameSet.has(action.name)) {
            ctx.addIssue({
                code: "custom",
                message: `Duplicate action name "${action.name}"`,
                path: [index, "name"],
            });
        }
        nameSet.add(action.name);
    });
});
