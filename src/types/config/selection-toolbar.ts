import { z } from "zod"

export const selectionToolbarCustomActionOutputTypeSchema = z.enum(["string", "number"])

export const selectionToolbarCustomActionOutputFieldSchema = z.object({
  id: z.string().nonempty(),
  name: z.string().trim().min(1),
  type: selectionToolbarCustomActionOutputTypeSchema,
  description: z.string(),
  speaking: z.boolean(),
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
}).superRefine((action, ctx) => {
  const nameSet = new Set<string>()

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
export type SelectionToolbarCustomAction = z.infer<typeof selectionToolbarCustomActionSchema>
