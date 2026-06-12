import type { ZodSchema } from "zod"
import { isNonNullish } from "@/utils/utils"
import {
  getResilientLocalItem,
  setResilientLocalItem,
  setResilientLocalMeta,
  watchResilientLocalItem,
} from "../storage/resilient-local-storage"

export const storageAdapter = {
  async get<T>(key: string, fallback: T, schema: ZodSchema<T>): Promise<T> {
    const value = await getResilientLocalItem<T>(`local:${key}`)
    if (isNonNullish(value)) {
      const parsedValue = schema.safeParse(value)
      if (parsedValue.success) {
        return parsedValue.data
      }
    }
    return fallback
  },
  async set<T>(key: string, value: T, schema: ZodSchema<T>) {
    const parsedValue = schema.safeParse(value)
    if (parsedValue.success) {
      await setResilientLocalItem(`local:${key}`, parsedValue.data)
    }
    else {
      throw new Error(parsedValue.error.message)
    }
  },
  async setMeta(key: string, meta: Record<string, unknown>) {
    await setResilientLocalMeta(`local:${key}`, meta)
  },
  watch<T>(key: string, callback: (newValue: T) => void) {
    const unwatch = watchResilientLocalItem<T>(`local:${key}`, (newValue) => {
      if (isNonNullish(newValue))
        callback(newValue)
    })
    return unwatch
  },
}
