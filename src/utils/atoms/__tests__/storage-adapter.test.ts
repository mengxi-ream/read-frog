import { createStore } from "jotai"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { storage } from "#imports"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { configAtom, writeConfigAtom } from "../config"
import { storageAdapter } from "../storage-adapter"

const loggerWarnMock = vi.hoisted(() => vi.fn())

vi.mock("@/utils/logger", () => ({
  logger: {
    warn: loggerWarnMock,
  },
}))

function createReadonlyIndexedDBError() {
  return new DOMException(
    "A mutation operation was attempted on a database that did not allow mutations.",
    "InvalidStateError",
  )
}

describe("storageAdapter", () => {
  const storedValues = new Map<string, unknown>()
  const storedMetas = new Map<string, Record<string, unknown>>()
  const storageMock = storage as unknown as {
    getItem: ReturnType<typeof vi.fn>
    getMeta: ReturnType<typeof vi.fn>
    setItem: ReturnType<typeof vi.fn>
    setMeta: ReturnType<typeof vi.fn>
    watch: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    storedValues.clear()
    storedMetas.clear()
    vi.clearAllMocks()

    storageMock.getItem = vi.fn(async (key: string) => storedValues.get(key) ?? null)
    storageMock.getMeta = vi.fn(async (key: string) => storedMetas.get(key) ?? null)
    storageMock.setItem = vi.fn(async (key: string, value: unknown) => {
      storedValues.set(key, value)
    })
    storageMock.setMeta = vi.fn(async (key: string, meta: Record<string, unknown>) => {
      storedMetas.set(key, { ...(storedMetas.get(key) ?? {}), ...meta })
    })
    storageMock.watch = vi.fn(() => () => {})
  })

  it("soft fails readonly IndexedDB local writes and reads the volatile value back", async () => {
    const readonlyError = createReadonlyIndexedDBError()
    storageMock.setItem.mockImplementation(async (key: string, value: unknown) => {
      if (key === "local:readonly-config") {
        throw readonlyError
      }
      storedValues.set(key, value)
    })

    await expect(storageAdapter.set("readonly-config", "saved", z.string())).resolves.toBeUndefined()
    await expect(storageAdapter.get("readonly-config", "fallback", z.string())).resolves.toBe("saved")

    expect(storageMock.setItem).toHaveBeenCalledWith("local:readonly-config", "saved")
    expect(storageMock.setItem).toHaveBeenCalledWith("session:readonly-config", "saved")
    expect(loggerWarnMock).toHaveBeenCalledWith(
      "Local storage write failed; using volatile fallback for local:readonly-config",
      readonlyError,
    )
  })

  it("returns the in-memory shadow copy when a later local read fails after a successful write", async () => {
    const readonlyError = createReadonlyIndexedDBError()

    await storageAdapter.set("delayed-read-config", "saved", z.string())

    storageMock.getItem.mockImplementation(async (key: string) => {
      if (key === "local:delayed-read-config") {
        throw readonlyError
      }
      return storedValues.get(key) ?? null
    })

    await expect(storageAdapter.get("delayed-read-config", "fallback", z.string())).resolves.toBe("saved")

    expect(loggerWarnMock).toHaveBeenCalledWith(
      "Local storage read failed; using volatile fallback for local:delayed-read-config",
      readonlyError,
    )
  })

  it("does not use the shadow copy when local storage is readable and empty", async () => {
    await storageAdapter.set("removed-config", "saved", z.string())
    storedValues.delete("local:removed-config")

    await expect(storageAdapter.get("removed-config", "fallback", z.string())).resolves.toBe("fallback")
  })

  it("keeps throwing unexpected storage write errors", async () => {
    const error = new Error("quota exceeded")
    storageMock.setItem.mockRejectedValue(error)

    await expect(storageAdapter.set("unexpected-config", "saved", z.string())).rejects.toThrow("quota exceeded")
    expect(storageMock.setItem).toHaveBeenCalledTimes(1)
  })

  it("soft fails readonly IndexedDB metadata writes", async () => {
    const readonlyError = createReadonlyIndexedDBError()
    storageMock.setMeta.mockImplementation(async (key: string, meta: Record<string, unknown>) => {
      if (key === "local:meta-config") {
        throw readonlyError
      }
      storedMetas.set(key, { ...(storedMetas.get(key) ?? {}), ...meta })
    })

    await expect(storageAdapter.setMeta("meta-config", { lastModifiedAt: 123 })).resolves.toBeUndefined()

    expect(storageMock.setMeta).toHaveBeenCalledWith("local:meta-config", { lastModifiedAt: 123 })
    expect(storageMock.setMeta).toHaveBeenCalledWith("session:meta-config", { lastModifiedAt: 123 })
  })

  it("keeps options config changes in memory when Firefox private mode rejects storage", async () => {
    const readonlyError = createReadonlyIndexedDBError()
    storageMock.getItem.mockRejectedValue(readonlyError)
    storageMock.setItem.mockRejectedValue(readonlyError)
    storageMock.setMeta.mockRejectedValue(readonlyError)

    const store = createStore()
    store.set(configAtom, structuredClone(DEFAULT_CONFIG))

    await expect(store.set(writeConfigAtom, {
      translate: {
        ...DEFAULT_CONFIG.translate,
        translationNodeStyle: {
          ...DEFAULT_CONFIG.translate.translationNodeStyle,
          isCustom: true,
        },
      },
    })).resolves.toBeUndefined()

    expect(store.get(configAtom).translate.translationNodeStyle.isCustom).toBe(true)
  })
})
