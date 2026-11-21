import { IconSettings } from "@tabler/icons-react"
import { useAtom, useAtomValue } from "jotai"
import { browser } from "#imports"
import { ProviderOptionContent } from "@/components/llm-providers/provider-selector"
import { useBuiltInAiModels } from "@/components/llm-providers/use-built-in-ai-models"
import { useHostedAiProviderOptions } from "@/components/llm-providers/use-hosted-ai-provider-options"
import ProviderIcon from "@/components/provider-icon"
import { useTheme } from "@/components/providers/theme-provider"
import { Button } from "@/components/ui/base-ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import {
  filterEnabledProvidersConfig,
  getLLMProvidersConfig,
  getNonAPIProvidersConfig,
  getPureAPIProvidersConfig,
  getTranslateProvidersConfig,
} from "@/utils/config/helpers"
import { PROVIDER_ITEMS } from "@/utils/constants/providers"
import { i18n } from "@/utils/i18n"
import { createLogger } from "@/utils/logging/logger"
import { isSystemProviderSelectorItem } from "@/utils/providers/provider-display"
import { getSelectableProvidersForCapability } from "@/utils/providers/provider-registry"
import { selectedProviderIdsAtom } from "../atoms"

const log = createLogger("translation-hub/translation-service-dropdown")

export function TranslationServiceDropdown() {
  const { theme } = useTheme()
  const [selectedIds, setSelectedIds] = useAtom(selectedProviderIdsAtom)
  const { models: builtInAiModels } = useBuiltInAiModels()
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const translateProviders = getTranslateProvidersConfig(providersConfig)
  const filteredProvidersConfig = filterEnabledProvidersConfig(translateProviders)

  const handleConfigureAPI = async () => {
    try {
      await browser.tabs.create({
        url: browser.runtime.getURL("/options.html#/api-providers"),
      })
    } catch (error) {
      log.error("Failed to open the API provider settings", { error })
    }
  }

  const llmProviders = getLLMProvidersConfig(filteredProvidersConfig)
  const nonAPIProviders = getNonAPIProvidersConfig(filteredProvidersConfig)
  const pureAPIProviders = getPureAPIProvidersConfig(filteredProvidersConfig)
  const selectableProviders = getSelectableProvidersForCapability(
    "pageTranslation",
    providersConfig,
    builtInAiModels,
    selectedIds,
  )
  const providerOptions = useHostedAiProviderOptions("pageTranslation", selectableProviders)
  const builtInProviders = providerOptions.filter(isSystemProviderSelectorItem)

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Select multiple value={selectedIds} onValueChange={setSelectedIds}>
        <SelectTrigger className="w-52 min-w-0">
          <SelectValue className="min-w-0" placeholder={i18n.t("translateService.selectServices")}>
            {selectedIds.length > 0 ? (
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate">{i18n.t("translateService.translationProviders")}</span>
                <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                  {selectedIds.length}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">
                {i18n.t("translateService.selectServices")}
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {builtInProviders.length > 0 && (
            <SelectGroup>
              <SelectLabel>{i18n.t("translateService.builtInModels")}</SelectLabel>
              {builtInProviders.map((provider) => (
                <SelectItem key={provider.id} value={provider.id} disabled={provider.disabled}>
                  <ProviderOptionContent
                    provider={provider}
                    providers={builtInProviders}
                    theme={theme}
                  />
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {(nonAPIProviders.length > 0 || pureAPIProviders.length > 0) && (
            <SelectGroup>
              <SelectLabel>{i18n.t("translateService.normalTranslator")}</SelectLabel>
              {nonAPIProviders.map(({ id, name, provider }) => (
                <SelectItem key={id} value={id}>
                  <ProviderIcon logo={PROVIDER_ITEMS[provider].logo(theme)} name={name} size="sm" />
                </SelectItem>
              ))}
              {pureAPIProviders.map(({ id, name, provider }) => (
                <SelectItem key={id} value={id}>
                  <ProviderIcon logo={PROVIDER_ITEMS[provider].logo(theme)} name={name} size="sm" />
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {llmProviders.length > 0 && (
            <SelectGroup>
              <SelectLabel>{i18n.t("translateService.llmModels")}</SelectLabel>
              {llmProviders.map(({ id, name, provider }) => (
                <SelectItem key={id} value={id}>
                  <ProviderIcon logo={PROVIDER_ITEMS[provider].logo(theme)} name={name} size="sm" />
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon"
        className="shrink-0"
        onClick={handleConfigureAPI}
        title={i18n.t("translateService.configureAPI")}
      >
        <IconSettings />
      </Button>
    </div>
  )
}
