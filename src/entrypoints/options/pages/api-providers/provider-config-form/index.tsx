import type { ProvidersConfig } from "@/types/config/provider"
import { i18n } from "#imports"
import { useStore } from "@tanstack/react-form"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/base-ui/button"
import { isAPIProviderConfig, isLLMProvider, isNonAPIProvider, isTranslateProvider } from "@/types/config/provider"
import { configAtom, configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { providerConfigAtom } from "@/utils/atoms/provider"
import { computeProviderFallbacksAfterDeletion, findFeatureMissingProvider } from "@/utils/config/helpers"
import { buildFeatureProviderPatch } from "@/utils/constants/feature-providers"
import { cn } from "@/utils/styles/utils"
import { selectedProviderIdAtom } from "../atoms"
import { APIKeyField } from "./api-key-field"
import { BaseURLField } from "./base-url-field"
import { AdvancedOptionsSection } from "./components/advanced-options-section"
import { ConfigHeader } from "./config-header"
import { FeatureProviderSection } from "./feature-provider-section"
import { formOpts, useAppForm } from "./form"
import { ProviderOptionsField } from "./provider-options-field"
import { TemperatureField } from "./temperature-field"
import { TranslateModelSelector } from "./translate-model-selector"

export function ProviderConfigForm() {
  const [selectedProviderId, setSelectedProviderId] = useAtom(selectedProviderIdAtom)
  const [providerConfig, setProviderConfig] = useAtom(providerConfigAtom(selectedProviderId ?? ""))
  const [allProvidersConfig, setAllProvidersConfig] = useAtom(configFieldsAtomMap.providersConfig)
  const setConfig = useSetAtom(writeConfigAtom)
  const config = useAtomValue(configAtom)

  const specificFormOpts = {
    ...formOpts,
    defaultValues: providerConfig && isAPIProviderConfig(providerConfig) ? providerConfig : undefined,
  }

  const form = useAppForm({
    ...specificFormOpts,
    onSubmit: async ({ value }) => {
      void setProviderConfig(value)
    },
  })

  const providerType = useStore(form.store, state => state.values.provider)
  const isTranslateProviderType = isTranslateProvider(providerType)
  const isLLM = isLLMProvider(providerType)

  useEffect(() => {
    if (providerConfig && isAPIProviderConfig(providerConfig)) {
      form.reset(providerConfig)
    }
  }, [providerConfig, form])

  if (!providerConfig || !isAPIProviderConfig(providerConfig)) {
    return null
  }

  const chooseNextProviderConfig = (providersConfig: ProvidersConfig) => {
    const firstProvider = providersConfig.find(p => !isNonAPIProvider(p.provider))
    return firstProvider ?? providersConfig[0]
  }

  const handleDelete = async () => {
    const updatedAllProviders = allProvidersConfig.filter(provider => provider.id !== providerConfig.id)

    const unsatisfied = findFeatureMissingProvider(updatedAllProviders)
    if (unsatisfied) {
      toast.error(i18n.t("options.apiProviders.form.atLeastOneLLMProvider")) // TODO: make this word more general
      return
    }

    const fallbacks = computeProviderFallbacksAfterDeletion(providerConfig.id, config, updatedAllProviders)
    const patch = buildFeatureProviderPatch(fallbacks)
    if (Object.keys(patch).length > 0)
      await setConfig(patch)

    await setAllProvidersConfig(updatedAllProviders)
    setSelectedProviderId(chooseNextProviderConfig(updatedAllProviders).id)
  }

  return (
    <form.AppForm>
      <div className={cn("flex-1 bg-card rounded-xl p-4 border flex flex-col justify-between", selectedProviderId !== providerConfig.id && "hidden")}>
        <div className="flex flex-col gap-4">
          <ConfigHeader providerType={providerType} />
          <form.AppField
            name="name"
            validators={{
              onChange: ({ value }) => {
                const duplicateProvider = allProvidersConfig.find(provider =>
                  provider.name === value && provider.id !== providerConfig.id,
                )
                if (duplicateProvider) {
                  return i18n.t("options.apiProviders.form.duplicateProviderName", [value])
                }
                return undefined
              },
            }}
          >
            {field => <field.InputField formForSubmit={form} label={i18n.t("options.apiProviders.form.fields.name")} />}
          </form.AppField>
          <form.AppField name="description">
            {field => <field.InputField formForSubmit={form} label={i18n.t("options.apiProviders.form.fields.description")} />}
          </form.AppField>

          <APIKeyField form={form} />
          <BaseURLField form={form} />
          {isTranslateProviderType && (
            <TranslateModelSelector form={form} />
          )}
          <FeatureProviderSection form={form} />
          {isLLM && (
            <AdvancedOptionsSection>
              <TemperatureField form={form} />
              <ProviderOptionsField form={form} />
            </AdvancedOptionsSection>
          )}
        </div>
        <div className="flex justify-end mt-8">
          <Button type="button" variant="destructive" onClick={handleDelete}>
            {i18n.t("options.apiProviders.form.delete")}
          </Button>
        </div>
      </div>
    </form.AppForm>
  )
}
