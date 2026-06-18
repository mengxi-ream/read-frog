import z from "zod";
export const floatingButtonSides = ["left", "right"];
export const floatingButtonSideSchema = z.enum(floatingButtonSides);
export const floatingButtonClickActions = ["panel", "translate"];
export const floatingButtonClickActionSchema = z.enum(floatingButtonClickActions);
export const floatingButtonSchema = z.object({
    enabled: z.boolean(),
    position: z.number().min(0).max(1),
    side: floatingButtonSideSchema,
    disabledFloatingButtonPatterns: z.array(z.string()),
    clickAction: floatingButtonClickActionSchema,
    locked: z.boolean(),
});
