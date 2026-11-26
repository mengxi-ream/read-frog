// @vitest-environment jsdom
import type { ComponentProps, ReactNode } from "react"
import type { Config } from "@/types/config/config"
import type { HostedAiStatus, HostedAiTierStatus } from "@/utils/hosted-ai/types"
import { render } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import ProvidersField from "@/entrypoints/popup/components/providers-field"
import { configAtom } from "@/utils/atoms/config"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import { PROVIDER_ITEMS } from "@/utils/constants/providers"
import {
  LUNA_PROVIDER_ID,
  SOL_PROVIDER_ID,
  testHostedAiModels,
} from "@/utils/hosted-ai/__tests__/test-models"
import { sanitizeHostedAiModels } from "@/utils/hosted-ai/models"
import {
  BUILT_IN_AI_PROVIDER_LOGO,
  getBuiltInAiProviderId,
} from "@/utils/providers/provider-registry"

const { hostedAiState } = vi.hoisted(() => {
  const state: { status: unknown } = { status: undefined }
  return { hostedAiState: state }
})

const { builtInAiModelsState } = vi.hoisted(() => {
  const state: { models: unknown } = { models: null }
  return { builtInAiModelsState: state }
})

vi.mock("@/components/llm-providers/use-hosted-ai-status", () => ({
  useHostedAiStatus: () => ({ status: hostedAiState.status, isPending: false, isError: false }),
}))

vi.mock("@/components/llm-providers/use-built-in-ai-models", () => ({
  useBuiltInAiModels: () => ({ models: builtInAiModelsState.models, isLive: true }),
}))

vi.mock("@/components/providers/theme-provider", () => ({
  useTheme: () => ({ theme: "light" }),
}))

// Only the avatars on the drawer's trigger are under test.
vi.mock("@/components/llm-providers/feature-provider-selector-list", () => ({
  FeatureProviderSelectorList: () => null,
}))

// base-ui renders an avatar's image only once it has loaded, which never
// happens in jsdom.
vi.mock("@/components/ui/base-ui/avatar", () => ({
  Avatar: ({ children }: { children: ReactNode }) => <span data-slot="avatar">{children}</span>,
  AvatarGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AvatarGroupCount: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  AvatarImage: (props: ComponentProps<"img">) => <img {...props} />,
}))

const HAIKU_PROVIDER_ID = getBuiltInAiProviderId("claude-haiku-5-5")
const DEEPSEEK_PROVIDER_ID = getBuiltInAiProviderId("deepseek-v4.1-flash")
const GOOGLE_PROVIDER_ID = "google-translate-default"
const GOOGLE_NAME = DEFAULT_CONFIG.providersConfig.find(({ id }) => id === GOOGLE_PROVIDER_ID)!.name

function logo(provider: keyof typeof PROVIDER_ITEMS): string {
  return PROVIDER_ITEMS[provider].logo("light")
}

/** The five features on these providers; their avatars come first, in this order. */
function configWith(providerIds: {
  pageTranslation: string
  videoSubtitles: string
  selectionTranslation: string
  inputTranslation: string
  noteSuggestion: string
}): Config {
  const config = structuredClone(DEFAULT_CONFIG)
  config.pageTranslation.providerId = providerIds.pageTranslation
  config.videoSubtitles.providerId = providerIds.videoSubtitles
  config.selectionToolbar.features.translate.providerId = providerIds.selectionTranslation
  config.inputTranslation.providerId = providerIds.inputTranslation
  config.selectionToolbar.noteSuggestion.providerId = providerIds.noteSuggestion
  return config
}

async function renderField(config: Config) {
  // The config atom rereads storage when it mounts.
  await fakeBrowser.storage.local.set({ [CONFIG_STORAGE_KEY]: config })
  const store = createStore()
  store.set(configAtom, config)
  return render(
    <Provider store={store}>
      <ProvidersField />
    </Provider>,
  )
}

/** What each stacked avatar shows, in order. */
function avatars(container: HTMLElement) {
  return [...container.querySelectorAll("[data-slot=avatar]")].map((avatar) => {
    const images = [...avatar.querySelectorAll("img")]
    return {
      name: images[0]?.getAttribute("alt"),
      logo: images[0]?.getAttribute("src"),
      images: images.length,
      dimmed:
        images[0]?.classList.contains("opacity-40") === true &&
        images[0].classList.contains("grayscale"),
    }
  })
}

function tier(overrides: Partial<HostedAiTierStatus> = {}): HostedAiTierStatus {
  return {
    accessAllowed: true,
    available: true,
    unavailableReason: null,
    upgradeTo: null,
    modelRevision: "r1",
    ...overrides,
  }
}

/** Every feature at the same pair of tiers. */
function statusWith(normal: HostedAiTierStatus, advance: HostedAiTierStatus): HostedAiStatus {
  const entry = { normal, advance }
  return {
    pools: [],
    models: testHostedAiModels(),
    features: {
      pageTranslation: entry,
      customAction: entry,
      noteSuggestion: entry,
      selectionTranslation: entry,
      videoSubtitles: entry,
      inputTranslation: entry,
      languageDetection: entry,
    },
  }
}

afterEach(() => {
  hostedAiState.status = undefined
  builtInAiModelsState.models = null
  fakeBrowser.reset()
})

describe("popup provider avatars", () => {
  it("shows a Built-in AI model by its vendor's logo alone, with no frog to be covered", async () => {
    builtInAiModelsState.models = sanitizeHostedAiModels(testHostedAiModels())
    const { container } = await renderField(
      configWith({
        pageTranslation: LUNA_PROVIDER_ID,
        videoSubtitles: GOOGLE_PROVIDER_ID,
        selectionTranslation: HAIKU_PROVIDER_ID,
        inputTranslation: DEEPSEEK_PROVIDER_ID,
        noteSuggestion: SOL_PROVIDER_ID,
      }),
    )

    expect(avatars(container).slice(0, 5)).toEqual([
      { name: "GPT-6 Luna", logo: logo("openai"), images: 1, dimmed: false },
      { name: GOOGLE_NAME, logo: logo("google-translate"), images: 1, dimmed: false },
      { name: "Claude Haiku 5.5", logo: logo("anthropic"), images: 1, dimmed: false },
      { name: "DeepSeek V4.1 Flash", logo: logo("deepseek"), images: 1, dimmed: false },
      { name: "GPT-6.2 Sol", logo: logo("openai"), images: 1, dimmed: false },
    ])
  })

  it("keeps the frog for a model whose vendor it has no logo for, or that no list names", async () => {
    builtInAiModelsState.models = sanitizeHostedAiModels(
      testHostedAiModels({ "gpt-6.2-sol": { vendor: "acme" } }),
    )
    const { container } = await renderField(
      configWith({
        pageTranslation: SOL_PROVIDER_ID,
        videoSubtitles: getBuiltInAiProviderId("gpt-5-mini"),
        selectionTranslation: LUNA_PROVIDER_ID,
        inputTranslation: LUNA_PROVIDER_ID,
        noteSuggestion: LUNA_PROVIDER_ID,
      }),
    )

    expect(avatars(container).slice(0, 3)).toEqual([
      { name: "GPT-6.2 Sol", logo: BUILT_IN_AI_PROVIDER_LOGO, images: 1, dimmed: false },
      { name: "gpt-5-mini", logo: BUILT_IN_AI_PROVIDER_LOGO, images: 1, dimmed: false },
      { name: "GPT-6 Luna", logo: logo("openai"), images: 1, dimmed: false },
    ])
  })

  it("keeps the frog while no model list is known", async () => {
    const { container } = await renderField(
      configWith({
        pageTranslation: LUNA_PROVIDER_ID,
        videoSubtitles: GOOGLE_PROVIDER_ID,
        selectionTranslation: LUNA_PROVIDER_ID,
        inputTranslation: LUNA_PROVIDER_ID,
        noteSuggestion: LUNA_PROVIDER_ID,
      }),
    )

    expect(avatars(container).slice(0, 2)).toEqual([
      { name: "gpt-6-luna", logo: BUILT_IN_AI_PROVIDER_LOGO, images: 1, dimmed: false },
      { name: GOOGLE_NAME, logo: logo("google-translate"), images: 1, dimmed: false },
    ])
  })

  it("still dims a model this account cannot run, now on its vendor's logo", async () => {
    builtInAiModelsState.models = sanitizeHostedAiModels(testHostedAiModels())
    hostedAiState.status = statusWith(
      tier(),
      tier({
        accessAllowed: false,
        available: false,
        unavailableReason: "ultra_required",
        upgradeTo: "ultra",
      }),
    )
    const { container } = await renderField(
      configWith({
        pageTranslation: SOL_PROVIDER_ID,
        videoSubtitles: GOOGLE_PROVIDER_ID,
        selectionTranslation: LUNA_PROVIDER_ID,
        inputTranslation: LUNA_PROVIDER_ID,
        noteSuggestion: LUNA_PROVIDER_ID,
      }),
    )

    expect(avatars(container).slice(0, 3)).toEqual([
      { name: "GPT-6.2 Sol", logo: logo("openai"), images: 1, dimmed: true },
      { name: GOOGLE_NAME, logo: logo("google-translate"), images: 1, dimmed: false },
      { name: "GPT-6 Luna", logo: logo("openai"), images: 1, dimmed: false },
    ])
  })
})
