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
  notebaseColumnId: z.string().nonempty(),
  notebaseColumnNameSnapshot: z.string().trim().min(1),
})

export const selectionToolbarCustomActionNotebaseConnectionSchema = z.object({
  notebaseId: z.string().nonempty(),
  notebaseNameSnapshot: z.string().trim().min(1),
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
  const notebaseColumnIdSet = new Set<string>()

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

    if (notebaseColumnIdSet.has(mapping.notebaseColumnId)) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate notebase column id "${mapping.notebaseColumnId}" in notebase mappings.`,
        path: ["notebaseConnection", "mappings", index, "notebaseColumnId"],
      })
    }
    notebaseColumnIdSet.add(mapping.notebaseColumnId)
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
