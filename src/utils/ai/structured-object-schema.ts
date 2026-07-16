import type { BackgroundStructuredObjectOutputField } from "@/types/background-stream"
import { z } from "zod"

export function createStructuredObjectSchema(
  outputSchema: BackgroundStructuredObjectOutputField[],
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const fieldTypeToZodSchema: Record<string, z.ZodTypeAny> = {
    string: z.string().nullable(),
    number: z.number().nullable(),
  }

  const schemaShape: Record<string, z.ZodTypeAny> = {}
  for (const field of outputSchema) {
    schemaShape[field.name] = fieldTypeToZodSchema[field.type] ?? z.string().nullable()
  }

  return z.strictObject(schemaShape)
}
