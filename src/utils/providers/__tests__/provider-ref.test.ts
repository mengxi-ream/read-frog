import type {
  ProviderAvailability,
  PromptableProviderRef,
  SerializableProviderRef,
} from "../provider-ref"
import type { ResolvedProviderRef, SystemProviderRef } from "../provider-registry"
import type { LLMProviderConfig, TranslateProviderConfig } from "@/types/config/provider"
import type { HostedAiStatus, HostedAiTierStatus } from "@/utils/hosted-ai/types"
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import {
  LUNA_PROVIDER_ID,
  SOL_PROVIDER_ID,
  testHostedAiModels,
} from "@/utils/hosted-ai/__tests__/test-models"
import { formatUiAlternatives } from "@/utils/i18n"

// The background owns the request and its cache; content only asks for it.
const hostedAiStatus = vi.fn<(...args: unknown[]) => Promise<unknown>>()

vi.mock("@/utils/message", () => ({
  sendMessage: (...args: unknown[]) => hostedAiStatus(...args),
}))

// The plan decides whether a spent pool offers an upgrade; it is read from billing.
const getBuiltInAiUpgradePlan = vi.fn<() => Promise<"free" | "pro" | null>>()

vi.mock("@/utils/hosted-ai/upgrade-plan", () => ({
  getBuiltInAiUpgradePlan: () => getBuiltInAiUpgradePlan(),
}))

const {
  canProviderRefGenerateText,
  canResolvedProviderRefGenerateText,
  checkProviderAvailability,
  HostedAiProviderUnavailableError,
  resolvePageTranslationProvider,
  serializeProviderRef,
} = await import("../provider-ref")

const SYSTEM_PROVIDER: SystemProviderRef = {
  kind: "system",
  id: LUNA_PROVIDER_ID,
  name: "GPT-6 Luna",
  model: "gpt-6-luna",
}

const SOL_PROVIDER: SystemProviderRef = {
  kind: "system",
  id: SOL_PROVIDER_ID,
  name: "GPT-6.2 Sol",
  model: "gpt-6.2-sol",
}

const LUNA_REF = {
  kind: "system",
  providerId: LUNA_PROVIDER_ID,
  model: "gpt-6-luna",
  modelTier: "normal",
  modelRevision: "gpt-6-luna-r1",
  reasoning: "none",
}

function tier(overrides: Partial<HostedAiTierStatus> = {}): HostedAiTierStatus {
  return {
    accessAllowed: true,
    available: true,
    unavailableReason: null,
    upgradeTo: null,
    modelRevision: "normal-r7",
    ...overrides,
  }
}

function status(
  normal: HostedAiTierStatus = tier(),
  models: HostedAiStatus["models"] = testHostedAiModels(),
): HostedAiStatus {
  const advance = tier({ modelRevision: "advance-r4" })
  return {
    pools: [],
    models,
    features: {
      pageTranslation: { normal, advance },
      videoSubtitles: { normal, advance },
      languageDetection: { normal, advance },
    } as unknown as HostedAiStatus["features"],
  }
}

/** A promise whose settlement the test controls, so overlap is deterministic. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("serializeProviderRef status coalescing", () => {
  beforeEach(() => {
    hostedAiStatus.mockReset()
    fakeBrowser.reset()
  })

  it("asks the background once for callers that overlap, and gives each the same verdict", async () => {
    const gate = deferred<HostedAiStatus>()
    hostedAiStatus.mockReturnValue(gate.promise)

    // Two features and two routes that collapse onto one: nothing about the
    // caller should split the shared request, since one response covers all.
    const refs = Promise.all([
      serializeProviderRef(SYSTEM_PROVIDER, "pageTranslation"),
      serializeProviderRef(SYSTEM_PROVIDER, "videoSubtitles"),
      serializeProviderRef(SYSTEM_PROVIDER, "videoSubtitlesSegmentation"),
    ])

    expect(hostedAiStatus).toHaveBeenCalledTimes(1)

    gate.resolve(status())
    const [page, subtitles, segmentation] = await refs

    expect(hostedAiStatus).toHaveBeenCalledTimes(1)
    for (const ref of [page, subtitles, segmentation]) {
      expect(ref).toEqual(LUNA_REF)
    }
  })

  it("refetches once the shared request settles, so a quota that runs out mid-page is seen", async () => {
    hostedAiStatus.mockResolvedValueOnce(status())
    await serializeProviderRef(SYSTEM_PROVIDER, "pageTranslation")

    // The next caller does not overlap the first, so it must get a fresh
    // verdict rather than a retained one — this is coalescing, not caching.
    hostedAiStatus.mockResolvedValueOnce(
      status(tier({ available: false, unavailableReason: "quota_exhausted" })),
    )
    await expect(serializeProviderRef(SYSTEM_PROVIDER, "pageTranslation")).rejects.toBeInstanceOf(
      HostedAiProviderUnavailableError,
    )

    expect(hostedAiStatus).toHaveBeenCalledTimes(2)
  })

  it("rejects every overlapping caller on an explicit unavailable verdict", async () => {
    const gate = deferred<HostedAiStatus>()
    hostedAiStatus.mockReturnValue(gate.promise)

    const results = Promise.allSettled([
      serializeProviderRef(SYSTEM_PROVIDER, "pageTranslation"),
      serializeProviderRef(SYSTEM_PROVIDER, "pageTranslation"),
    ])

    gate.resolve(status(tier({ available: false, unavailableReason: "quota_exhausted" })))

    for (const result of await results) {
      expect(result.status).toBe("rejected")
      expect((result as PromiseRejectedResult).reason).toBeInstanceOf(
        HostedAiProviderUnavailableError,
      )
    }
    expect(hostedAiStatus).toHaveBeenCalledTimes(1)
  })

  it("fails open for every overlapping caller when the background has no verdict", async () => {
    // The background catches its own fetch failure and answers null; content
    // must treat that the same as "no verdict", not as a denial.
    const gate = deferred<HostedAiStatus | null>()
    hostedAiStatus.mockReturnValue(gate.promise)

    const refs = Promise.all([
      serializeProviderRef(SYSTEM_PROVIDER, "pageTranslation"),
      serializeProviderRef(SYSTEM_PROVIDER, "pageTranslation"),
    ])

    gate.resolve(null)

    // No verdict means no block: the generation endpoints enforce access.
    for (const ref of await refs) {
      expect(ref).toMatchObject({ kind: "system", modelRevision: "unknown" })
    }

    // The empty answer must not be retained either, or one outage would pin
    // every later call to the fail-open path.
    hostedAiStatus.mockResolvedValueOnce(status())
    await expect(serializeProviderRef(SYSTEM_PROVIDER, "pageTranslation")).resolves.toMatchObject({
      modelRevision: "gpt-6-luna-r1",
    })
    expect(hostedAiStatus).toHaveBeenCalledTimes(2)
  })

  it("fails open when the message itself cannot be delivered", async () => {
    hostedAiStatus.mockRejectedValueOnce(new Error("no receiving end"))

    await expect(serializeProviderRef(SYSTEM_PROVIDER, "pageTranslation")).resolves.toMatchObject({
      kind: "system",
      modelRevision: "unknown",
    })
  })

  it("never reaches the status endpoint for a local provider", async () => {
    const local = { provider: "openai", id: "openai-1" } as unknown as LLMProviderConfig
    const localRef: ResolvedProviderRef<LLMProviderConfig> = {
      kind: "local",
      config: local,
      id: "openai-1",
      name: "OpenAI",
    }

    await expect(serializeProviderRef(localRef, "pageTranslation")).resolves.toEqual({
      kind: "local",
      config: local,
    })
    expect(hostedAiStatus).not.toHaveBeenCalled()
  })

  it("keeps the narrow overload's promise: a serialized LLM ref passes the transport guard", async () => {
    const local = { provider: "openai", id: "openai-1" } as unknown as LLMProviderConfig
    const ref = await serializeProviderRef(
      { kind: "local", config: local, id: "openai-1", name: "OpenAI" },
      "pageTranslation",
    )
    // The overload asserts PromptableProviderRef; the implementation must
    // actually deliver one, or every payload typed on the narrow ref lies.
    expect(canProviderRefGenerateText(ref)).toBe(true)
  })
})

describe("serializeProviderRef per model", () => {
  beforeEach(() => {
    hostedAiStatus.mockReset()
    fakeBrowser.reset()
    vi.mocked(formatUiAlternatives).mockClear()
  })

  it("files the ref under the model's revision and the level the user picked for it", async () => {
    await fakeBrowser.storage.local.set({
      config: { builtInAi: { models: { "gpt-6.2-sol": { reasoning: "high" } } } },
    })
    hostedAiStatus.mockResolvedValue(status())

    await expect(serializeProviderRef(SOL_PROVIDER, "pageTranslation")).resolves.toEqual({
      kind: "system",
      providerId: SOL_PROVIDER_ID,
      model: "gpt-6.2-sol",
      modelTier: "advance",
      modelRevision: "gpt-6.2-sol-r1",
      reasoning: "high",
    })
  })

  it("files a level the model does not take under the model's default", async () => {
    await fakeBrowser.storage.local.set({
      config: { builtInAi: { models: { "gpt-6.2-sol": { reasoning: "none" } } } },
    })
    hostedAiStatus.mockResolvedValue(status())

    await expect(serializeProviderRef(SOL_PROVIDER, "pageTranslation")).resolves.toMatchObject({
      reasoning: "low",
    })
  })

  it("asks for no level for language detection", async () => {
    await fakeBrowser.storage.local.set({
      config: { builtInAi: { models: { "gpt-6.2-sol": { reasoning: "high" } } } },
    })
    hostedAiStatus.mockResolvedValue(status())

    await expect(serializeProviderRef(SOL_PROVIDER, "languageDetection")).resolves.toMatchObject({
      model: "gpt-6.2-sol",
      reasoning: null,
    })
  })

  it("keeps the last stored list's revision while status cannot be reached", async () => {
    await fakeBrowser.storage.local.set({
      hostedAiModels: { models: testHostedAiModels(), savedAt: 1 },
    })
    hostedAiStatus.mockResolvedValue(null)

    await expect(serializeProviderRef(SYSTEM_PROVIDER, "pageTranslation")).resolves.toEqual(
      LUNA_REF,
    )
  })

  it("refuses a model that cannot run, naming the others and pointing at the first", async () => {
    hostedAiStatus.mockResolvedValue(
      status(tier(), testHostedAiModels({ "gpt-6-luna": { available: false } })),
    )

    const error = await serializeProviderRef(SYSTEM_PROVIDER, "pageTranslation").catch(
      (reason: unknown) => reason,
    )

    expect(error).toBeInstanceOf(HostedAiProviderUnavailableError)
    expect((error as Error).message).toBe("hostedAi.errors.modelUnavailable")
    expect(formatUiAlternatives).toHaveBeenCalledWith([
      "Claude Haiku 5.5",
      "DeepSeek V4.1 Flash",
      "GPT-6.2 Sol",
    ])
    const action = (error as InstanceType<typeof HostedAiProviderUnavailableError>).action
    expect(action?.label).toBe("hostedAi.actions.chooseModel")
    expect(action?.url).toContain(
      `/options.html#/api-providers?section=provider-config&provider=${encodeURIComponent("read-frog-ai:claude-haiku-5-5")}`,
    )
  })

  it("refuses a stored model the server stopped listing", async () => {
    hostedAiStatus.mockResolvedValue(status())
    const dropped: SystemProviderRef = {
      kind: "system",
      id: "read-frog-ai:gpt-5-mini",
      name: "gpt-5-mini",
      model: "gpt-5-mini",
    }

    const availability = await checkProviderAvailability(dropped, "pageTranslation")

    expect(availability).toMatchObject({
      available: false,
      message: "hostedAi.errors.modelUnavailable",
      action: { label: "hostedAi.actions.chooseModel" },
    })
  })

  it("refuses a model whose tier the plan does not reach with the tier's own reason", async () => {
    const wall = tier({
      accessAllowed: false,
      available: false,
      unavailableReason: "ultra_required",
      upgradeTo: "ultra",
    })
    hostedAiStatus.mockResolvedValue({
      ...status(),
      features: {
        pageTranslation: { normal: tier(), advance: wall },
      } as unknown as HostedAiStatus["features"],
    })

    await expect(checkProviderAvailability(SOL_PROVIDER, "pageTranslation")).resolves.toEqual({
      available: false,
      message: "hostedAi.availability.ultraRequired",
      action: undefined,
      reason: "ultra_required",
      error: expect.any(HostedAiProviderUnavailableError),
    })
  })

  it("asks a guest to log in", async () => {
    const guestWall = tier({
      accessAllowed: false,
      available: false,
      unavailableReason: "authentication_required",
      upgradeTo: null,
    })
    hostedAiStatus.mockResolvedValue({
      ...status(),
      features: {
        pageTranslation: { normal: guestWall, advance: guestWall },
      } as unknown as HostedAiStatus["features"],
    })

    await expect(checkProviderAvailability(SYSTEM_PROVIDER, "pageTranslation")).resolves.toEqual({
      available: false,
      message: "hostedAi.availability.authenticationRequired",
      action: { label: "account.login", url: expect.stringMatching(/\/log-in$/) },
      reason: "authentication_required",
      error: expect.any(HostedAiProviderUnavailableError),
    })
  })

  function spendPool(feature: "pageTranslation" | "videoSubtitles") {
    const spent = tier({ available: false, unavailableReason: "quota_exhausted" })
    hostedAiStatus.mockResolvedValue({
      ...status(),
      features: {
        [feature]: { normal: spent, advance: spent },
      } as unknown as HostedAiStatus["features"],
    })
  }

  it("offers a spent pool below Ultra the upgrade, named after the feature that ran dry", async () => {
    getBuiltInAiUpgradePlan.mockResolvedValue("free")
    spendPool("videoSubtitles")

    const availability = await checkProviderAvailability(
      SYSTEM_PROVIDER,
      "videoSubtitlesSegmentation",
    )

    expect(availability).toMatchObject({ available: false, reason: "quota_exhausted" })
    const action = availability.available ? undefined : availability.action
    expect(action?.label).toBe("action.upgrade")
    const url = new URL(action!.url)
    expect(url.pathname).toBe("/pricing")
    expect(url.searchParams.get("entry")).toBe("extension_quota_exhausted")
    expect(url.searchParams.get("feature")).toBe("video_subtitles")
  })

  it("offers Ultra's spent pool nothing: no plan sits above it", async () => {
    getBuiltInAiUpgradePlan.mockResolvedValue(null)
    spendPool("pageTranslation")

    await expect(checkProviderAvailability(SYSTEM_PROVIDER, "pageTranslation")).resolves.toEqual(
      expect.objectContaining({ available: false, reason: "quota_exhausted", action: undefined }),
    )
  })
})

describe("overload contracts", () => {
  it("pins the promptable overloads at the type level", () => {
    // Never called — the assertions inside are checked by the type-aware
    // linter, not executed. They are what fails if someone widens the narrow
    // overloads or lets the resolvers hand back an asymmetric ref again.
    function pinOverloadContracts(
      promptable: ResolvedProviderRef<LLMProviderConfig>,
      translate: ResolvedProviderRef<TranslateProviderConfig>,
      bareConfig: TranslateProviderConfig,
    ) {
      expectTypeOf(serializeProviderRef(promptable, "languageDetection")).toEqualTypeOf<
        Promise<PromptableProviderRef>
      >()
      expectTypeOf(serializeProviderRef(translate, "pageTranslation")).toEqualTypeOf<
        Promise<SerializableProviderRef>
      >()
      expectTypeOf(checkProviderAvailability(promptable, "selectionTranslation")).toEqualTypeOf<
        Promise<ProviderAvailability<PromptableProviderRef>>
      >()
      expectTypeOf(checkProviderAvailability(translate, "pageTranslation")).toEqualTypeOf<
        Promise<ProviderAvailability>
      >()
      expectTypeOf(resolvePageTranslationProvider).returns.toEqualTypeOf<
        ResolvedProviderRef<TranslateProviderConfig>
      >()
      if (canResolvedProviderRefGenerateText(translate)) {
        expectTypeOf(translate).toEqualTypeOf<ResolvedProviderRef<LLMProviderConfig>>()
      }
      // @ts-expect-error — a bare provider config is no longer a resolvable ref
      void serializeProviderRef(bareConfig, "pageTranslation")
    }
    expect(pinOverloadContracts).toBeInstanceOf(Function)
  })
})
