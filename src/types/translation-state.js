import { z } from "zod";
export const translationStateSchema = z.object({
    enabled: z.boolean(),
    origin: z.string().optional(),
});
