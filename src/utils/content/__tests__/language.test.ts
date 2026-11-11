import { franc } from "franc"
import { data as francData } from "franc/data.js"
import { expressions as francScripts } from "franc/expressions.js"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("franc", () => ({
  franc: vi.fn<(...args: any[]) => any>(),
}))

const { getLocalConfigMock, serializeProviderRefMock, toastAddMock } = vi.hoisted(() => ({
  toastAddMock: vi.fn<(...args: any[]) => any>(),
  getLocalConfigMock: vi.fn<(...args: any[]) => any>(),
  serializeProviderRefMock: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/components/ui/base-ui/toast", () => ({
  toastManager: { add: (...args: unknown[]) => toastAddMock(...args) },
}))

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: getLocalConfigMock,
}))

// Only the network-touching resolve is replaced; the error class stays real,
// since recognizing it is what the assertions are about.
vi.mock("@/utils/providers/provider-ref", async () => {
  const actual = await vi.importActual<any>("@/utils/providers/provider-ref")
  return { ...actual, serializeProviderRef: serializeProviderRefMock }
})

const { HostedAiProviderUnavailableError } = await import("@/utils/providers/provider-ref")
const { detectLanguageWithSource } = await import("../language")

const mockFranc = vi.mocked(franc)

const BUILT_IN_PROVIDER = {
  kind: "system" as const,
  id: "read-frog-free-ai" as const,
  name: "Built-in AI",
  modelTier: "normal" as const,
}

describe("detectLanguageWithSource", () => {
  beforeEach(() => {
    mockFranc.mockReset()
  })

  it("returns franc result when it is a supported language code", async () => {
    mockFranc.mockReturnValue("eng")

    await expect(
      detectLanguageWithSource("This is enough text to detect language."),
    ).resolves.toEqual({
      code: "en",
      source: "franc",
    })
  })

  it("reads franc's ISO 639-3 answer as the language's tag", async () => {
    mockFranc.mockReturnValue("cmn")
    await expect(detectLanguageWithSource("这是一段足够长的中文文本。")).resolves.toEqual({
      code: "zh-Hans",
      source: "franc",
    })

    // franc's Albanian, which the ISO 639-3 list never matched.
    mockFranc.mockReturnValue("als")
    await expect(detectLanguageWithSource("Përshëndetje, si jeni sot?")).resolves.toEqual({
      code: "sq",
      source: "franc",
    })
  })

  it("falls back when franc returns an unsupported language code", async () => {
    mockFranc.mockReturnValue("vmw")

    await expect(
      detectLanguageWithSource("Eyi je oro ni ede Yoruba fun idanwo wiwa ede."),
    ).resolves.toEqual({
      code: "und",
      source: "fallback",
    })
  })

  it("reads every language franc can answer with", async () => {
    // franc names a script it reads as one language by that language's code,
    // and lists the languages of every other script in its trigram data.
    const francCodes = [
      ...new Set([
        ...Object.keys(francScripts).filter((script) => !(script in francData)),
        ...Object.values(francData).flatMap((languages) => Object.keys(languages)),
      ]),
    ].toSorted()

    const lines: string[] = []
    for (const francCode of francCodes) {
      mockFranc.mockReturnValue(francCode)
      const { code } = await detectLanguageWithSource("This is enough text to detect language.")
      lines.push(`${francCode} -> ${code}`)
    }

    await expect(`${lines.join("\n")}\n`).toMatchFileSnapshot("./__snapshots__/franc-languages.txt")
  })

  describe("when LLM detection is enabled but the account cannot run it", () => {
    beforeEach(() => {
      toastAddMock.mockReset()
      serializeProviderRefMock.mockReset()
      getLocalConfigMock.mockResolvedValue({
        languageDetection: { mode: "llm", providerId: "read-frog-free-ai" },
        providersConfig: [],
      })
    })

    it("says so instead of quietly resolving with franc", async () => {
      serializeProviderRefMock.mockRejectedValue(
        new HostedAiProviderUnavailableError(BUILT_IN_PROVIDER, "Ultra plan required"),
      )
      mockFranc.mockReturnValue("eng")

      // franc still answers — the degrade is deliberate. What changed is that
      // the user is now told why, instead of a denial being folded into the
      // same null that means "no LLM detection is configured".
      await expect(
        detectLanguageWithSource("This is enough text to detect language.", { enableLLM: true }),
      ).resolves.toEqual({ code: "en", source: "franc" })

      expect(toastAddMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: "warning", title: "Ultra plan required" }),
      )
    })

    it("explains the fallback for speaking without presenting it as a login gate", async () => {
      serializeProviderRefMock.mockRejectedValue(
        new HostedAiProviderUnavailableError(BUILT_IN_PROVIDER, "Log in to use this provider"),
      )
      mockFranc.mockReturnValue("eng")

      await expect(
        detectLanguageWithSource("This is enough text to detect language.", {
          enableLLM: true,
          llmFallbackToastContext: "speak",
        }),
      ).resolves.toEqual({ code: "en", source: "franc" })

      expect(toastAddMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "warning",
          title: "speak.languageDetectionFallback",
          description: "speak.languageDetectionSettingsHint",
        }),
      )
    })

    it("stays silent when no provider is configured at all", async () => {
      getLocalConfigMock.mockResolvedValue({
        languageDetection: { mode: "llm", providerId: "" },
        providersConfig: [],
      })
      mockFranc.mockReturnValue("eng")

      // Not the same condition: nothing was denied, so there is nothing to
      // report. This is the meaning the denial used to collapse into.
      await expect(
        detectLanguageWithSource("This is enough text to detect language.", { enableLLM: true }),
      ).resolves.toEqual({ code: "en", source: "franc" })

      expect(toastAddMock).not.toHaveBeenCalled()
    })
  })
})
