import { HostedAiOutputFieldTypeSchema } from "@read-frog/api-contract"
import { z } from "zod"
import { isBuiltInActionId } from "@/utils/constants/custom-action"
import { BUILT_IN_AI_PROVIDER_ID } from "@/utils/constants/provider-ids"

// Upper bound (UTF-16 code units) of a custom action's HTML layout. NEVER lower
// it: an older build that reads a config holding a longer layout fails schema
// validation, falls back to DEFAULT_CONFIG and overwrites the synced remote
// copy. Raising it is fine only together with a CONFIG_SCHEMA_VERSION bump, so
// older builds refuse the newer config instead of choking on it.
export const MAX_CUSTOM_ACTION_LAYOUT_LENGTH = 32768

// The contract's field-type enum is the source of truth: these values ride the
// wire to hostedAi.customAction unchanged. Only the enum is shared — length
// caps and strictness stay hosted-only so BYOK actions are not constrained.
export const selectionToolbarCustomActionOutputTypeSchema = HostedAiOutputFieldTypeSchema

export const selectionToolbarCustomActionOutputFieldSchema = z.object({
  id: z.string().nonempty(),
  name: z.string().trim().min(1),
  type: selectionToolbarCustomActionOutputTypeSchema,
  description: z.string(),
})

export const selectionToolbarCustomActionNotebaseMappingSchema = z.object({
  id: z.string().nonempty(),
  localFieldId: z.string().nonempty(),
  notebaseColumnId: z.string().nonempty(),
  notebaseColumnNameSnapshot: z.string().trim().min(1),
})

export const selectionToolbarCustomActionNotebaseAccountSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  email: z.string().trim().min(1),
  image: z.string().trim().min(1).nullable().optional(),
})

export const selectionToolbarCustomActionNotebaseConnectionSchema = z.object({
  notebaseId: z.string().nonempty(),
  notebaseNameSnapshot: z.string().trim().min(1),
  connectedAccount: selectionToolbarCustomActionNotebaseAccountSchema,
  mappings: z.array(selectionToolbarCustomActionNotebaseMappingSchema),
})

export const selectionToolbarBuiltInActionStateSchema = z.object({
  enabled: z.boolean(),
  providerId: z.string().nonempty(),
  notebaseConnection: selectionToolbarCustomActionNotebaseConnectionSchema.optional(),
})

export const selectionToolbarBuiltInActionsSchema = z.object({
  dictionary: selectionToolbarBuiltInActionStateSchema,
  // `.default()` is load-bearing: a config stored before v104 still parses in
  // UI contexts that load ahead of the background migration, instead of
  // falling back to DEFAULT_CONFIG and writing that over the user's settings.
  sentenceAnalysis: selectionToolbarBuiltInActionStateSchema.default(() => ({
    enabled: true,
    providerId: BUILT_IN_AI_PROVIDER_ID,
  })),
  // For the same reason as above. Off: a config stored before v105 has not
  // been through v106 either, which turns it on and unpins it, so it must not
  // land on the toolbar in the meantime.
  improveWriting: selectionToolbarBuiltInActionStateSchema.default(() => ({
    enabled: false,
    providerId: BUILT_IN_AI_PROVIDER_ID,
  })),
})

export const selectionToolbarCustomActionSchema = z
  .object({
    id: z.string().nonempty(),
    name: z.string().nonempty(),
    enabled: z.boolean().optional(),
    icon: z.string(),
    providerId: z.string().nonempty(),
    systemPrompt: z.string(),
    prompt: z.string(),
    outputSchema: z.array(selectionToolbarCustomActionOutputFieldSchema).min(1),
    notebaseConnection: selectionToolbarCustomActionNotebaseConnectionSchema.optional(),
    // HTML + Liquid template for the result. Optional, not defaulted, and never
    // syntax-checked here: a missing or blank layout renders the default field
    // list, and a template error must not fail the whole config parse (which
    // would replace the user's config with DEFAULT_CONFIG).
    layout: z.string().max(MAX_CUSTOM_ACTION_LAYOUT_LENGTH).optional(),
  })
  .superRefine((action, ctx) => {
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

export const selectionToolbarCustomActionsSchema = z
  .array(selectionToolbarCustomActionSchema)
  .superRefine((actions, ctx) => {
    const idSet = new Set<string>()
    actions.forEach((action, index) => {
      if (isBuiltInActionId(action.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Action id "${action.id}" is reserved for a built-in action.`,
          path: [index, "id"],
        })
      }

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
  })

// TODO: make these vairbale shorter by deleteing SelectionToolbar or "selectionToolbar"
export type SelectionToolbarCustomActionOutputType = z.infer<
  typeof selectionToolbarCustomActionOutputTypeSchema
>
export type SelectionToolbarCustomActionOutputField = z.infer<
  typeof selectionToolbarCustomActionOutputFieldSchema
>
export type SelectionToolbarCustomActionNotebaseMapping = z.infer<
  typeof selectionToolbarCustomActionNotebaseMappingSchema
>
export type SelectionToolbarCustomActionNotebaseAccount = z.infer<
  typeof selectionToolbarCustomActionNotebaseAccountSchema
>
export type SelectionToolbarCustomActionNotebaseConnection = z.infer<
  typeof selectionToolbarCustomActionNotebaseConnectionSchema
>
export type SelectionToolbarBuiltInActionState = z.infer<
  typeof selectionToolbarBuiltInActionStateSchema
>
export type SelectionToolbarBuiltInActions = z.infer<typeof selectionToolbarBuiltInActionsSchema>
export type SelectionToolbarCustomAction = z.infer<typeof selectionToolbarCustomActionSchema>
