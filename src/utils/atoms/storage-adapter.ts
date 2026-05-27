import type { ZodSchema } from "zod"
import { storage } from "#imports"
import { isNonNullish } from "@/utils/utils"
import { logger } from "../logger"

export const storageAdapter = {
  async get<T>(key: string, fallback: T, schema: ZodSchema<T>): Promise<T> {
    try {
      const value = await storage.getItem<T>(`local:${key}`)
      if (isNonNullish(value)) {
        const parsedValue = schema.safeParse(value)
        if (parsedValue.success) {
          return parsedValue.data
        }
      }
      return fallback
    }
    catch (error) {
      logger.error("storageAdapter.get failed", error)
      return fallback
    }
  },
  async set<T>(key: string, value: T, schema: ZodSchema<T>) {
    const parsedValue = schema.safeParse(value)
    if (parsedValue.success) {
      try {
        await storage.setItem(`local:${key}`, parsedValue.data)
      }
      catch (error) {
        logger.error("storageAdapter.set failed", error)
        throw error
      }
    }
    else {
      throw new Error(parsedValue.error.message)
    }
  },
  async setMeta(key: string, meta: Record<string, unknown>) {
    try {
      await storage.setMeta(`local:${key}`, meta)
    }
    catch (error) {
      logger.error("storageAdapter.setMeta failed", error)
      throw error
    }
  },
  watch<T>(key: string, callback: (newValue: T) => void) {
    try {
      const unwatch = storage.watch<T>(`local:${key}`, (newValue) => {
        if (isNonNullish(newValue))
          callback(newValue)
      })
      return unwatch
    }
    catch (error) {
      logger.error("storageAdapter.watch setup failed", error)
      return () => {}
    }
  },
}
