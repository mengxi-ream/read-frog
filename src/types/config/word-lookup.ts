import { z } from "zod"
import {
  BUILT_IN_DICTIONARY_ACTION_ID,
  BUILT_IN_SENTENCE_ANALYSIS_ACTION_ID,
} from "@/utils/constants/custom-action"

export const wordLookupConfigSchema = z
  .object({
    clickActionId: z.string().nonempty().default(BUILT_IN_DICTIONARY_ACTION_ID),
    dragActionId: z.string().nonempty().default(BUILT_IN_SENTENCE_ANALYSIS_ACTION_ID),
  })
  .default({
    clickActionId: BUILT_IN_DICTIONARY_ACTION_ID,
    dragActionId: BUILT_IN_SENTENCE_ANALYSIS_ACTION_ID,
  })
