import type { LLMProviderConfig } from "@/types/config/provider"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { detectLanguageWithSource } from "../language"

const { cleanTextMock, francMock, toastWarningMock } = vi.hoisted(() => ({
  cleanTextMock: vi.fn<(text: string, maxLength: number) => string>((text: string) => text),
  francMock: vi.fn<(text: string) => string>(() => "eng"),
  toastWarningMock: vi.fn(),
}))

vi.mock("#imports", () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

vi.mock("franc", () => ({
  franc: (text: string) => francMock(text),
}))

vi.mock("sonner", () => ({
  toast: {
    warning: (...args: unknown[]) => toastWarningMock(...args),
  },
}))

vi.mock("../utils", () => ({
  cleanText: (text: string, maxLength: number) => cleanTextMock(text, maxLength),
}))

vi.mock("@/utils/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}))

describe("detectLanguageWithSource", () => {
  beforeEach(() => {
    cleanTextMock.mockReset()
    cleanTextMock.mockImplementation((text: string) => text)
    francMock.mockReset()
    francMock.mockReturnValue("eng")
    toastWarningMock.mockReset()
  })

  it("shows the fallback warning toast by default when llm detection fails", async () => {
    cleanTextMock.mockImplementationOnce(() => {
      throw new Error("llm detection setup failed")
    })

    const result = await detectLanguageWithSource("This text is long enough for detection.", {
      enableLLM: true,
      providerConfig: {} as LLMProviderConfig,
    })

    expect(result).toEqual({ code: "eng", source: "franc" })
    expect(toastWarningMock).toHaveBeenCalledWith("languageDetection.llmFailed", {
      id: "llm-detection-fallback",
    })
  })

  it("suppresses the fallback warning toast when requested", async () => {
    cleanTextMock.mockImplementationOnce(() => {
      throw new Error("llm detection setup failed")
    })

    const result = await detectLanguageWithSource("This text is long enough for detection.", {
      enableLLM: true,
      providerConfig: {} as LLMProviderConfig,
      suppressFallbackToast: true,
    })

    expect(result).toEqual({ code: "eng", source: "franc" })
    expect(toastWarningMock).not.toHaveBeenCalled()
  })
})
