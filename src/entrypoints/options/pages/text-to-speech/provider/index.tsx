import type { TTSProvider } from "@/types/config/tts"
import type { GoogleProviderConfig } from "@/types/gemini-tts"
import { useAtom, useAtomValue } from "jotai"
import { useMemo } from "react"
import { Link } from "react-router"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { SetApiKeyWarning } from "@/components/llm-providers/set-api-key-warning"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { GEMINI_TTS_MODELS, TTS_PROVIDERS } from "@/types/config/tts"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { resolveTTSConfigForProviderChange } from "@/utils/config/helpers"
import { i18n } from "@/utils/i18n"
import { buildProviderConfigRoute, buildProviderTypeConfigRoute } from "@/utils/navigation"
import { getGeminiTTSProviders } from "@/utils/tts/gemini-providers"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"
import { SELECT_CONTENT_PROPS } from "../../../components/select-content-props"

/** Maps a TTSProvider to its i18n-safe key: Chrome only allows [A-Za-z0-9_] in message names. */
const TTS_PROVIDER_I18N_MAP = {
  "edge-tts": "edgeTts",
  gemini: "gemini",
} as const satisfies Record<TTSProvider, string>

/** Which engine reads aloud, and for Gemini, the provider whose key it uses and the model. */
export function ProviderSection() {
  const ttsConfig = useAtomValue(configFieldsAtomMap.tts)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const geminiProviders = useMemo(() => getGeminiTTSProviders(providersConfig), [providersConfig])

  return (
    <ConfigSection id="provider" title={i18n.t("options.tts.provider.title")}>
      <EngineItem geminiProviders={geminiProviders} />
      {ttsConfig.provider === "gemini" && (
        <>
          <GeminiProviderItem geminiProviders={geminiProviders} />
          <GeminiModelItem />
        </>
      )}
    </ConfigSection>
  )
}

function EngineItem({ geminiProviders }: { geminiProviders: GoogleProviderConfig[] }) {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)

  return (
    <ConfigItem
      id="tts-engine"
      title={i18n.t("options.tts.provider.engine.title")}
      description={
        <>
          {i18n.t("options.tts.provider.engine.description")}
          {geminiProviders.length === 0 && (
            <span className="mt-2 flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-warning" />
              <span className="text-xs">
                {i18n.t("options.tts.provider.gemini.provider.noProviders")}{" "}
                {/* Selects the Google provider, or adds one, with its API key field in view. */}
                <Link
                  to={buildProviderTypeConfigRoute("google", { highlightApiKey: true })}
                  className="underline"
                >
                  {i18n.t("options.tts.provider.gemini.provider.manage")}
                </Link>
              </span>
            </span>
          )}
        </>
      }
    >
      <Select
        value={ttsConfig.provider}
        onValueChange={(provider: TTSProvider | null) => {
          if (!provider) return
          const nextTtsConfig = resolveTTSConfigForProviderChange(
            ttsConfig,
            provider,
            geminiProviders,
          )
          if (nextTtsConfig) void setTtsConfig(nextTtsConfig)
        }}
      >
        <SelectTrigger size="sm">
          <SelectValue render={<span />}>
            {i18n.t(`options.tts.provider.engine.${TTS_PROVIDER_I18N_MAP[ttsConfig.provider]}`)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent {...SELECT_CONTENT_PROPS}>
          <SelectGroup>
            {TTS_PROVIDERS.map((provider) => (
              <SelectItem
                key={provider}
                value={provider}
                disabled={provider === "gemini" && geminiProviders.length === 0}
              >
                {i18n.t(`options.tts.provider.engine.${TTS_PROVIDER_I18N_MAP[provider]}`)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </ConfigItem>
  )
}

/** The API key lives with the provider in API Providers; this row only says which one to use. */
function GeminiProviderItem({ geminiProviders }: { geminiProviders: GoogleProviderConfig[] }) {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)
  const { providerId } = ttsConfig.gemini
  const providerConfig = geminiProviders.find((provider) => provider.id === providerId) ?? null

  return (
    <ConfigItem
      id="tts-gemini-provider"
      title={
        <span className="flex flex-wrap items-center gap-2">
          {i18n.t("options.tts.provider.gemini.provider.title")}
          <SetApiKeyWarning providerConfig={providerConfig} />
        </span>
      }
      description={
        <>
          {i18n.t("options.tts.provider.gemini.provider.description")}{" "}
          <Link
            to={
              providerId
                ? buildProviderConfigRoute(providerId)
                : buildProviderTypeConfigRoute("google")
            }
            className="underline"
          >
            {i18n.t("options.tts.provider.gemini.provider.manage")}
          </Link>
        </>
      }
    >
      <ProviderSelector
        providers={geminiProviders}
        value={providerId ?? ""}
        onChange={(nextProviderId) => {
          void setTtsConfig({ gemini: { ...ttsConfig.gemini, providerId: nextProviderId } })
        }}
        placeholder={i18n.t("options.tts.provider.gemini.provider.placeholder")}
        triggerSize="sm"
        selectContentProps={SELECT_CONTENT_PROPS}
      />
    </ConfigItem>
  )
}

function GeminiModelItem() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)

  return (
    <ConfigItem
      id="tts-gemini-model"
      title={i18n.t("options.tts.provider.gemini.model.title")}
      description={i18n.t("options.tts.provider.gemini.model.description")}
    >
      <Select
        value={ttsConfig.gemini.model}
        onValueChange={(model: string | null) => {
          if (!model) return
          void setTtsConfig({ gemini: { ...ttsConfig.gemini, model } })
        }}
      >
        <SelectTrigger size="sm">
          <SelectValue render={<span />}>{ttsConfig.gemini.model}</SelectValue>
        </SelectTrigger>
        <SelectContent {...SELECT_CONTENT_PROPS}>
          <SelectGroup>
            {GEMINI_TTS_MODELS.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </ConfigItem>
  )
}
