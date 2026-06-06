import { z } from "zod"
import { KNOWLEDGE_BASE_SURFACES } from "@/types/knowledge-base"

export const knowledgeBaseSurfaceSchema = z.enum(KNOWLEDGE_BASE_SURFACES)

export const knowledgeBaseConfigSchema = z.object({
  enabled: z.boolean(),
  captureSurfaces: z.array(knowledgeBaseSurfaceSchema),
  remoteSync: z.object({
    enabled: z.boolean(),
    endpoint: z.string(),
    token: z.string(),
  }),
})
