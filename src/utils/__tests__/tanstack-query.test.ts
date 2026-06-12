import { beforeEach, describe, expect, it, vi } from "vitest"
import { queryClient } from "../tanstack-query"

const toastErrorMock = vi.hoisted(() => vi.fn())

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
  },
}))

function createReadonlyIndexedDBError() {
  return new DOMException(
    "A mutation operation was attempted on a database that did not allow mutations.",
    "InvalidStateError",
  )
}

describe("queryClient", () => {
  beforeEach(() => {
    queryClient.clear()
    toastErrorMock.mockClear()
  })

  it("does not toast Firefox private local storage failures", async () => {
    await expect(queryClient.fetchQuery({
      queryKey: ["readonly-storage"],
      queryFn: async () => {
        throw createReadonlyIndexedDBError()
      },
      retry: false,
    })).rejects.toThrow("did not allow mutations")

    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it("still toasts ordinary query failures", async () => {
    await expect(queryClient.fetchQuery({
      queryKey: ["ordinary-error"],
      queryFn: async () => {
        throw new Error("network failed")
      },
      retry: false,
    })).rejects.toThrow("network failed")

    expect(toastErrorMock).toHaveBeenCalledWith("Something went wrong", {
      description: "network failed",
    })
  })
})
