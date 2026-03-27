import { z } from "zod"

export const selectionToolbarCustomActionOutputTypeSchema = z.enum(["string", "number"])

export const selectionToolbarCustomActionOutputFieldSchema = z.object({
  id: z.string().nonempty(),
  name: z.string().trim().min(1),
  type: selectionToolbarCustomActionOutputTypeSchema,
  description: z.string(),
  speaking: z.boolean(),
})

export const selectionToolbarCustomActionNotebaseMappingSchema = z.object({
  id: z.string().nonempty(),
  localFieldId: z.string().nonempty(),
  remoteColumnId: z.string().nonempty(),
  remoteColumnNameSnapshot: z.string().trim().min(1),
})

export const selectionToolbarCustomActionNotebaseConnectionSchema = z.object({
  tableId: z.string().nonempty(),
  tableNameSnapshot: z.string().trim().min(1),
  mappings: z.array(selectionToolbarCustomActionNotebaseMappingSchema),
})

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
  const nameSet = new Set<string>()
  const outputFieldIds = new Set<string>()

  action.outputSchema.forEach((field, index) => {
    if (nameSet.has(field.name)) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate output schema name "${field.name}".`,
        path: ["outputSchema", index, "name"],
      })
      return
    }
    nameSet.add(field.name)
    outputFieldIds.add(field.id)
  })

  const connection = action.notebaseConnection
  if (!connection) {
    return
  }

  const mappingIdSet = new Set<string>()
  const localFieldIdSet = new Set<string>()
  const remoteColumnIdSet = new Set<string>()

  connection.mappings.forEach((mapping, index) => {
    if (mappingIdSet.has(mapping.id)) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate notebase mapping id "${mapping.id}".`,
        path: ["notebaseConnection", "mappings", index, "id"],
      })
    }
    mappingIdSet.add(mapping.id)

    if (!outputFieldIds.has(mapping.localFieldId)) {
      ctx.addIssue({
        code: "custom",
        message: `Unknown output field id "${mapping.localFieldId}" in notebase mapping.`,
        path: ["notebaseConnection", "mappings", index, "localFieldId"],
      })
    }

    if (localFieldIdSet.has(mapping.localFieldId)) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate local field id "${mapping.localFieldId}" in notebase mappings.`,
        path: ["notebaseConnection", "mappings", index, "localFieldId"],
      })
    }
    localFieldIdSet.add(mapping.localFieldId)

    if (remoteColumnIdSet.has(mapping.remoteColumnId)) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate remote column id "${mapping.remoteColumnId}" in notebase mappings.`,
        path: ["notebaseConnection", "mappings", index, "remoteColumnId"],
      })
    }
    remoteColumnIdSet.add(mapping.remoteColumnId)
  })
})

export const selectionToolbarCustomActionsSchema = z.array(selectionToolbarCustomActionSchema).superRefine(
  (actions, ctx) => {
    const idSet = new Set<string>()
    actions.forEach((action, index) => {
      if (idSet.has(action.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate action id "${action.id}"`,
          path: [index, "id"],
        })
      }
      idSet.add(action.id)
    })

    const nameSet = new Set<string>()
    actions.forEach((action, index) => {
      if (nameSet.has(action.name)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate action name "${action.name}"`,
          path: [index, "name"],
        })
      }
      nameSet.add(action.name)
    })
  },
)

export type SelectionToolbarCustomActionOutputType = z.infer<typeof selectionToolbarCustomActionOutputTypeSchema>
export type SelectionToolbarCustomActionOutputField = z.infer<typeof selectionToolbarCustomActionOutputFieldSchema>
export type SelectionToolbarCustomActionNotebaseMapping = z.infer<typeof selectionToolbarCustomActionNotebaseMappingSchema>
export type SelectionToolbarCustomActionNotebaseConnection = z.infer<typeof selectionToolbarCustomActionNotebaseConnectionSchema>
export type SelectionToolbarCustomAction = z.infer<typeof selectionToolbarCustomActionSchema>
