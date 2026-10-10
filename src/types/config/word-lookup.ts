import { z } from "zod"
import { BUILT_IN_DICTIONARY_ACTION_ID } from "@/utils/constants/custom-action"

export const wordLookupConfigSchema = z
  .object({
    actionId: z.string().nonempty(),
  })
  .default({ actionId: BUILT_IN_DICTIONARY_ACTION_ID })
