import type { APIProviderConfig, ProvidersConfig } from "@/types/config/provider"
import { dequal } from "dequal"
import { useAtomValue, useSetAtom, useStore } from "jotai"
import { useEffect, useState } from "react"
import {
  AutosaveBoundary,
  requestEditorNavigationAtom,
} from "@/components/form/autosave-navigation"
import { toAutosaveSession } from "@/components/form/use-autosave"
import { useHostedAiStatus } from "@/components/llm-providers/use-hosted-ai-status"
import { toastManager } from "@/components/ui/base-ui/toast"
import {
  isAPIProviderConfig,
  isLLMProvider,
  isNonAPIProvider,
  isTranslateProvider,
} from "@/types/config/provider"
import { configAtom, configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { patchProviderConfigAtom } from "@/utils/atoms/entity-config"
import { providerConfigAtom } from "@/utils/atoms/provider"
import {
  computeLanguageDetectionFallbackAfterDeletion,
  computeProviderFallbacksAfterDeletion,
  computeSelectionToolbarCustomActionFallbacksAfterDeletion,
  findFeatureMissingProvider,
} from "@/utils/config/helpers"
import {
  buildFeatureProviderPatch,
  FEATURE_KEYS,
  FEATURE_PROVIDER_DEFS,
  getFeatureLabelI18nKey,
} from "@/utils/constants/feature-providers"
import { getSelectionToolbarActions } from "@/utils/custom-actions"
import { i18n } from "@/utils/i18n"
import { EntityEditor } from "../../../../components/entity-editor"
import { selectedProviderIdAtom } from "../atoms"
import { CustomProviderEditor, ProviderEditor, useProviderForm } from "../provider-editor"
import { duplicateProvider } from "../utils"

export function ProviderConfigForm() {
  const selectedProviderId = useAtomValue(selectedProviderIdAtom)
  const providerConfig = useAtomValue(providerConfigAtom(selectedProviderId ?? ""))

  const [lastProvider, setLastProvider] = useState<APIProviderConfig | undefined>(undefined)
  if (
    providerConfig &&
    isAPIProviderConfig(providerConfig) &&
    !dequal(providerConfig, lastProvider)
  ) {
    setLastProvider(providerConfig)
  }
  const editorProvider =
    providerConfig && isAPIProviderConfig(providerConfig)
      ? providerConfig
      : lastProvider?.id === selectedProviderId
        ? lastProvider
        : undefined
  if (!editorProvider) {
    return null
  }

  return <EditableProviderConfig key={editorProvider.id} providerConfig={editorProvider} />
}

function EditableProviderConfig({ providerConfig }: { providerConfig: APIProviderConfig }) {
  const store = useStore()
  const requestNavigation = useSetAtom(requestEditorNavigationAtom)
  const setSelectedProviderId = useSetAtom(selectedProviderIdAtom)
  const currentProviderConfig = useAtomValue(providerConfigAtom(providerConfig.id))
  const setAllProvidersConfig = useSetAtom(configFieldsAtomMap.providersConfig)
  const setConfig = useSetAtom(writeConfigAtom)
  const config = useAtomValue(configAtom)
  // Decides which built-in tiers count as usable below. Unknown status reads as
  // usable, so an unreachable status endpoint never traps someone with a
  // credential they want gone.
  const { status: hostedAiStatus } = useHostedAiStatus()
  const patchProvider = useSetAtom(patchProviderConfigAtom)
  const { form, autosave } = useProviderForm(providerConfig, async (_snapshot, changes) => {
    await patchProvider({ id: providerConfig.id, changes })
  })

  useEffect(() => {
    autosave.reconcile(
      currentProviderConfig && isAPIProviderConfig(currentProviderConfig)
        ? currentProviderConfig
        : undefined,
    )
  }, [currentProviderConfig, autosave])

  const chooseNextProviderConfig = (providersConfig: ProvidersConfig) => {
    const firstProvider = providersConfig.find((provider) => !isNonAPIProvider(provider.provider))
    return firstProvider ?? providersConfig[0]
  }

  const handleDuplicate = async () => {
    await requestNavigation(async () => {
      const latest = store.get(providerConfigAtom(providerConfig.id))
      if (!latest || !isAPIProviderConfig(latest)) return
      await duplicateProvider(
        latest,
        store.get(configFieldsAtomMap.providersConfig),
        setAllProvidersConfig,
        setSelectedProviderId,
      )
    })
  }

  const handleDelete = async () => {
    await autosave.discard()
    const updatedAllProviders = store
      .get(configFieldsAtomMap.providersConfig)
      .filter((provider) => provider.id !== providerConfig.id)

    const unsatisfied = findFeatureMissingProvider(updatedAllProviders, config, hostedAiStatus)
    if (unsatisfied) {
      // Name the feature. The block is worth nothing if the user cannot tell
      // which slot it is protecting — and it fires for switched-off features
      // too, whose stored providerId would otherwise be left dangling.
      toastManager.add({
        type: "error",
        title: i18n.t("options.apiProviders.form.featureWouldLoseProvider", [
          unsatisfied === "languageDetection"
            ? i18n.t("options.apiProviders.languageDetection.title")
            : i18n.t(getFeatureLabelI18nKey(unsatisfied)),
        ]),
      })
      return
    }

    const updatedSelectionToolbar = computeSelectionToolbarCustomActionFallbacksAfterDeletion(
      providerConfig.id,
      config,
      updatedAllProviders,
      hostedAiStatus,
    )
    const hasAffectedCustomActions = getSelectionToolbarActions(config.selectionToolbar).some(
      (action) => action.providerId === providerConfig.id,
    )

    if (hasAffectedCustomActions && !updatedSelectionToolbar) {
      toastManager.add({
        type: "error",
        title: i18n.t("options.apiProviders.form.atLeastOneLLMProvider"),
      })
      return
    }

    const fallbacks = computeProviderFallbacksAfterDeletion(
      providerConfig.id,
      config,
      updatedAllProviders,
      hostedAiStatus,
    )
    let patch = buildFeatureProviderPatch(fallbacks)
    if (updatedSelectionToolbar) {
      patch = {
        ...patch,
        selectionToolbar: updatedSelectionToolbar,
      }
    }

    const languageDetectionFallback = computeLanguageDetectionFallbackAfterDeletion(
      providerConfig.id,
      config,
      updatedAllProviders,
      hostedAiStatus,
    )
    if (languageDetectionFallback !== null) {
      patch = {
        ...patch,
        languageDetection: {
          ...config.languageDetection,
          providerId: languageDetectionFallback,
        },
      }
    }

    if (Object.keys(patch).length > 0) {
      await setConfig(patch)
    }

    await setAllProvidersConfig(updatedAllProviders)
    const nextProvider = chooseNextProviderConfig(updatedAllProviders)
    if (nextProvider) {
      await setSelectedProviderId(nextProvider.id)
    }
  }

  const providerType = providerConfig.provider
  const hasTranslationModelFields = isTranslateProvider(providerType) && isLLMProvider(providerType)
  const hasAdvancedFields = isLLMProvider(providerType)
  const hasAssignments =
    hasAdvancedFields ||
    FEATURE_KEYS.some((featureKey) => FEATURE_PROVIDER_DEFS[featureKey].isProvider(providerType))

  return (
    <AutosaveBoundary session={toAutosaveSession(autosave)}>
      <CustomProviderEditor.Provider
        providerConfig={providerConfig}
        form={form}
        duplicate={handleDuplicate}
        delete={handleDelete}
      >
        <ProviderEditor.Form>
          <EntityEditor.Root>
            <EntityEditor.Body>
              <ProviderEditor.ConfigHeader />
              <ProviderEditor.NameField />
              <ProviderEditor.DescriptionField />
              <ProviderEditor.ConnectionFields />
              <ProviderEditor.ProviderSpecificFields />
              {hasTranslationModelFields && <ProviderEditor.TranslationModelFields />}
              {hasAssignments && (
                <ProviderEditor.Assignments>
                  <ProviderEditor.CompatibleFeatureAssignments />
                  <ProviderEditor.LanguageDetectionAssignment />
                  <ProviderEditor.CustomActionAssignments />
                </ProviderEditor.Assignments>
              )}
              {hasAdvancedFields && <ProviderEditor.AdvancedFields />}
            </EntityEditor.Body>
            <EntityEditor.Footer>
              <ProviderEditor.DuplicateButton />
              <ProviderEditor.DeleteButton />
            </EntityEditor.Footer>
          </EntityEditor.Root>
        </ProviderEditor.Form>
      </CustomProviderEditor.Provider>
    </AutosaveBoundary>
  )
}
