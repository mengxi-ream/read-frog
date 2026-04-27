import z from "zod"

export const floatingButtonSides = ["left", "right"] as const
export type FloatingButtonSide = (typeof floatingButtonSides)[number]
export const floatingButtonSideSchema = z.enum(floatingButtonSides)

export const floatingButtonClickActions = ["panel", "translate"] as const
export type FloatingButtonClickAction = (typeof floatingButtonClickActions)[number]
export const floatingButtonClickActionSchema = z.enum(floatingButtonClickActions)

export const floatingButtonSchema = z.object({
  enabled: z.boolean(),
  position: z.number().min(0).max(1),
  side: floatingButtonSideSchema,
  disabledFloatingButtonPatterns: z.array(z.string()),
  clickAction: floatingButtonClickActionSchema,
  locked: z.boolean(),
})

export type FloatingButtonConfig = z.infer<typeof floatingButtonSchema>
