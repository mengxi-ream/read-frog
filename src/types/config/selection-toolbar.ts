import { z } from "zod"

export const selectionToolbarCustomFeatureOutputTypeSchema = z.enum(["string", "number"])

export const selectionToolbarCustomFeatureOutputFieldSchema = z.object({
  id: z.string().nonempty(),
  key: z.string().trim().min(1),
  type: selectionToolbarCustomFeatureOutputTypeSchema,
})

export const selectionToolbarCustomFeatureSchema = z.object({
  id: z.string().nonempty(),
  name: z.string().nonempty(),
  enabled: z.boolean().optional(),
  icon: z.string(),
  providerId: z.string().nonempty(),
  systemPrompt: z.string(),
  prompt: z.string(),
  outputSchema: z.array(selectionToolbarCustomFeatureOutputFieldSchema).min(1),
}).superRefine((feature, ctx) => {
  const keySet = new Set<string>()

  feature.outputSchema.forEach((field, index) => {
    if (keySet.has(field.key)) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate output schema key "${field.key}".`,
        path: ["outputSchema", index, "key"],
      })
      return
    }
    keySet.add(field.key)
  })
})

export const selectionToolbarCustomFeaturesSchema = z.array(selectionToolbarCustomFeatureSchema).superRefine(
  (features, ctx) => {
    const idSet = new Set<string>()
    features.forEach((feature, index) => {
      if (idSet.has(feature.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate feature id "${feature.id}"`,
          path: [index, "id"],
        })
      }
      idSet.add(feature.id)
    })

    const nameSet = new Set<string>()
    features.forEach((feature, index) => {
      if (nameSet.has(feature.name)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate feature name "${feature.name}"`,
          path: [index, "name"],
        })
      }
      nameSet.add(feature.name)
    })
  },
)

export type SelectionToolbarCustomFeatureOutputType = z.infer<typeof selectionToolbarCustomFeatureOutputTypeSchema>
export type SelectionToolbarCustomFeatureOutputField = z.infer<typeof selectionToolbarCustomFeatureOutputFieldSchema>
export type SelectionToolbarCustomFeature = z.infer<typeof selectionToolbarCustomFeatureSchema>
