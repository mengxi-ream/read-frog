import type { APIProviderConfig } from "@/types/config/provider"
import type { FeatureKey } from "@/utils/constants/feature-providers"
import { Icon } from "@iconify/react"
import { useSelector } from "@tanstack/react-store"
import { useAtomValue, useSetAtom } from "jotai"
import { createContext, use, useState } from "react"
import ProviderIcon from "@/components/provider-icon"
import { useTheme } from "@/components/providers/theme-provider"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/base-ui/alert-dialog"
import { Button } from "@/components/ui/base-ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/base-ui/collapsible"
import { Switch } from "@/components/ui/base-ui/switch"
import { isLLMProvider } from "@/types/config/provider"
import { configAtom, configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import {
  buildFeatureProviderPatch,
  FEATURE_KEYS,
  FEATURE_PROVIDER_DEFS,
  getFeatureLabelI18nKey,
} from "@/utils/constants/feature-providers"
import { API_PROVIDER_ITEMS } from "@/utils/constants/providers"
import { getSelectionToolbarActions, patchSelectionToolbarAction } from "@/utils/custom-actions"
import { i18n } from "@/utils/i18n"
import {
  BUILT_IN_AI_PROVIDER_ID,
  BUILT_IN_AI_PROVIDER_LOGO,
} from "@/utils/providers/provider-registry"
import { cn } from "@/utils/styles/utils"
import { APIKeyField } from "./provider-config-form/api-key-field"
import { BaseURLField } from "./provider-config-form/base-url-field"
import { CodexOAuthField } from "./provider-config-form/codex-oauth-field"
import { AdvancedOptionsSection } from "./provider-config-form/components/advanced-options-section"
import { ConfigHeader as ProviderConfigHeader } from "./provider-config-form/config-header"
import { formOpts, useAppForm } from "./provider-config-form/form"
import { ProviderHeadersField } from "./provider-config-form/provider-headers-field"
import { ProviderOptionsField } from "./provider-config-form/provider-options-field"
import { ProviderSpecificSettingsField } from "./provider-config-form/provider-specific-settings-field"
import { ReasoningField } from "./provider-config-form/reasoning-field"
import { TemperatureField } from "./provider-config-form/temperature-field"
import { TranslateModelSelector } from "./provider-config-form/translate-model-selector"

interface ProviderIdentity {
  id: string
  logo: string
  name: string
}

interface ProviderEditorContextValue {
  state: {
    identity: ProviderIdentity
    assignmentTarget: {
      providerId: string
      providerType?: APIProviderConfig["provider"]
    }
  }
  actions: {
    assignFeature: (featureKey: FeatureKey) => Promise<void>
    assignLanguageDetection: () => Promise<void>
    assignCustomAction: (actionId: string) => Promise<void>
    duplicate?: () => Promise<void>
    delete?: () => Promise<void>
  }
}

const ProviderEditorContext = createContext<ProviderEditorContextValue | null>(null)

export function useProviderEditor() {
  const context = use(ProviderEditorContext)
  if (!context) {
    throw new Error("ProviderEditor components must be rendered inside a ProviderEditor Provider")
  }
  return context
}

function useRequiredProviderCommand(command: "duplicate" | "delete") {
  const action = useProviderEditor().actions[command]
  if (!action) {
    throw new Error(`ProviderEditor.${command} is unavailable in this composition`)
  }
  return action
}

function useProviderEditorValue({
  identity,
  providerType,
  duplicate,
  delete: deleteProvider,
}: {
  identity: ProviderIdentity
  providerType?: APIProviderConfig["provider"]
  duplicate?: () => Promise<void>
  delete?: () => Promise<void>
}): ProviderEditorContextValue {
  const config = useAtomValue(configAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const providerId = identity.id

  const getEnabledProvidersConfig = () => {
    const provider = config.providersConfig.find((item) => item.id === providerId)
    if (!provider || provider.enabled) {
      return undefined
    }

    return config.providersConfig.map((item) =>
      item.id === providerId ? { ...item, enabled: true } : item,
    )
  }

  const getAssignmentProvidersPatch = () => {
    const providersConfig = getEnabledProvidersConfig()
    return providersConfig ? { providersConfig } : {}
  }

  return {
    state: {
      identity,
      assignmentTarget: {
        providerId,
        ...(providerType ? { providerType } : {}),
      },
    },
    actions: {
      assignFeature: async (featureKey) => {
        await setConfig({
          ...buildFeatureProviderPatch({ [featureKey]: providerId }),
          ...getAssignmentProvidersPatch(),
        })
      },
      assignLanguageDetection: async () => {
        await setConfig({
          languageDetection: {
            mode: "llm",
            providerId,
          },
          ...getAssignmentProvidersPatch(),
        })
      },
      assignCustomAction: async (actionId) => {
        await setConfig({
          selectionToolbar: patchSelectionToolbarAction(config.selectionToolbar, actionId, {
            providerId,
          }),
          ...getAssignmentProvidersPatch(),
        })
      },
      ...(duplicate ? { duplicate } : {}),
      ...(deleteProvider ? { delete: deleteProvider } : {}),
    },
  }
}

function BuiltInProvider({ children }: { children: React.ReactNode }) {
  const value = useProviderEditorValue({
    identity: {
      id: BUILT_IN_AI_PROVIDER_ID,
      logo: BUILT_IN_AI_PROVIDER_LOGO,
      name: i18n.t("options.apiProviders.providers.name.builtInAi"),
    },
  })

  return <ProviderEditorContext value={value}>{children}</ProviderEditorContext>
}

export function useProviderForm(
  providerConfig: APIProviderConfig,
  save: (providerConfig: APIProviderConfig) => Promise<void>,
) {
  return useAppForm({
    ...formOpts,
    defaultValues: providerConfig,
    onSubmit: async ({ value }) => {
      await save(value)
    },
  })
}

type ProviderForm = ReturnType<typeof useProviderForm>

const ApiProviderFormContext = createContext<ProviderForm | null>(null)

function useApiProviderForm() {
  const form = use(ApiProviderFormContext)
  if (!form) {
    throw new Error("ProviderEditor form fields require a CustomProviderEditor Provider")
  }
  return form
}

function CustomProvider({
  providerConfig,
  form,
  duplicate,
  delete: deleteProvider,
  children,
}: {
  providerConfig: APIProviderConfig
  form: ProviderForm
  duplicate: () => Promise<void>
  delete: () => Promise<void>
  children: React.ReactNode
}) {
  const { theme } = useTheme()
  const provider = API_PROVIDER_ITEMS[providerConfig.provider]
  const value = useProviderEditorValue({
    identity: {
      id: providerConfig.id,
      logo: provider.logo(theme),
      name: providerConfig.name,
    },
    providerType: providerConfig.provider,
    duplicate,
    delete: deleteProvider,
  })

  return (
    <ProviderEditorContext value={value}>
      <ApiProviderFormContext value={form}>{children}</ApiProviderFormContext>
    </ProviderEditorContext>
  )
}

function Form({ children }: { children: React.ReactNode }) {
  const form = useApiProviderForm()
  return <form.AppForm>{children}</form.AppForm>
}

function Identity() {
  const { identity } = useProviderEditor().state
  return (
    <ProviderIcon
      logo={identity.logo}
      name={identity.name}
      size="base"
      textClassName="font-medium"
    />
  )
}

function Attribution({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-6 text-muted-foreground">{children}</p>
}

function SponsorCTA({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <Button variant="brand" render={<a href={href} target="_blank" rel="noreferrer" />}>
      {children}
    </Button>
  )
}

function ConfigHeader() {
  const form = useApiProviderForm()
  const providerType = useSelector(form.store, (state) => state.values.provider)
  const apiKey = useSelector(form.store, (state) => state.values.apiKey)
  return <ProviderConfigHeader providerType={providerType} apiKey={apiKey} />
}

function NameField() {
  const form = useApiProviderForm()
  const providerId = useProviderEditor().state.identity.id
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  return (
    <form.AppField
      name="name"
      validators={{
        onChange: ({ value }) => {
          const providerWithSameName = providersConfig.find(
            (provider) => provider.name === value && provider.id !== providerId,
          )
          return providerWithSameName
            ? i18n.t("options.apiProviders.form.duplicateProviderName", [value])
            : undefined
        },
      }}
    >
      {(field) => (
        <field.InputFieldAutoSave
          formForSubmit={form}
          label={i18n.t("options.apiProviders.form.fields.name")}
        />
      )}
    </form.AppField>
  )
}

function DescriptionField() {
  const form = useApiProviderForm()
  return (
    <form.AppField name="description">
      {(field) => (
        <field.InputFieldAutoSave
          formForSubmit={form}
          label={i18n.t("options.apiProviders.form.fields.description")}
        />
      )}
    </form.AppField>
  )
}

function ConnectionFields() {
  const form = useApiProviderForm()
  const providerConfig = useSelector(form.store, (state) => state.values)

  if (providerConfig.provider === "openai-codex") {
    return <CodexOAuthField providerConfig={providerConfig} />
  }

  return (
    <>
      <APIKeyField form={form} />
      <BaseURLField form={form} />
    </>
  )
}

function ProviderSpecificFields() {
  return <ProviderSpecificSettingsField form={useApiProviderForm()} />
}

function TranslationModelFields() {
  const form = useApiProviderForm()
  return (
    <>
      <TranslateModelSelector form={form} />
      <ReasoningField form={form} />
    </>
  )
}

function AdvancedFields() {
  const form = useApiProviderForm()
  return (
    <AdvancedOptionsSection>
      <TemperatureField form={form} />
      <ProviderOptionsField form={form} />
      <ProviderHeadersField form={form} />
    </AdvancedOptionsSection>
  )
}

function Assignments({
  children,
  defaultOpen = false,
}: {
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex cursor-pointer items-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground">
        <Icon
          icon="tabler:chevron-right"
          className={cn("size-4 transition-transform duration-200", isOpen && "rotate-90")}
        />
        <span>{i18n.t("options.apiProviders.form.featureProviders")}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function AssignmentRow({
  checked,
  children,
  onCheckedChange,
}: {
  checked: boolean
  children: React.ReactNode
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch checked={checked} disabled={checked} onCheckedChange={onCheckedChange} />
      <span className="text-sm">{children}</span>
    </div>
  )
}

function CompatibleFeatureAssignments() {
  const {
    state: {
      assignmentTarget: { providerId, providerType },
    },
    actions,
  } = useProviderEditor()
  const config = useAtomValue(configAtom)

  if (!providerType) {
    return null
  }

  return FEATURE_KEYS.filter((featureKey) =>
    FEATURE_PROVIDER_DEFS[featureKey].isProvider(providerType),
  ).map((featureKey) => {
    const isAssigned = FEATURE_PROVIDER_DEFS[featureKey].getProviderId(config) === providerId
    return (
      <AssignmentRow
        key={featureKey}
        checked={isAssigned}
        onCheckedChange={(checked) => {
          if (checked) void actions.assignFeature(featureKey)
        }}
      >
        {i18n.t(getFeatureLabelI18nKey(featureKey))}
      </AssignmentRow>
    )
  })
}

function LanguageDetectionAssignment() {
  const {
    state: {
      assignmentTarget: { providerId, providerType },
    },
    actions,
  } = useProviderEditor()
  const config = useAtomValue(configAtom)

  if (!providerType || !isLLMProvider(providerType)) {
    return null
  }

  const isAssigned =
    config.languageDetection.mode === "llm" && config.languageDetection.providerId === providerId

  return (
    <AssignmentRow
      checked={isAssigned}
      onCheckedChange={(checked) => {
        if (checked) void actions.assignLanguageDetection()
      }}
    >
      {i18n.t("options.general.languageDetection.title")}
    </AssignmentRow>
  )
}

function CustomActionAssignments() {
  const {
    state: {
      assignmentTarget: { providerId, providerType },
    },
    actions,
  } = useProviderEditor()
  const config = useAtomValue(configAtom)

  if (providerType && !isLLMProvider(providerType)) {
    return null
  }

  return getSelectionToolbarActions(config.selectionToolbar).map((action) => {
    const isAssigned = action.providerId === providerId
    return (
      <AssignmentRow
        key={action.id}
        checked={isAssigned}
        onCheckedChange={(checked) => {
          if (checked) void actions.assignCustomAction(action.id)
        }}
      >
        {action.name}
      </AssignmentRow>
    )
  })
}

function DuplicateButton() {
  const duplicate = useRequiredProviderCommand("duplicate")
  return (
    <Button type="button" variant="outline" onClick={() => void duplicate()}>
      {i18n.t("options.apiProviders.form.duplicate")}
    </Button>
  )
}

function DeleteButton() {
  const deleteProvider = useRequiredProviderCommand("delete")
  const [open, setOpen] = useState(false)

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button type="button" variant="destructive" />}>
        {i18n.t("options.apiProviders.form.delete")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {i18n.t("options.apiProviders.form.deleteDialog.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {i18n.t("options.apiProviders.form.deleteDialog.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {i18n.t("options.apiProviders.form.deleteDialog.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void deleteProvider()}>
            {i18n.t("options.apiProviders.form.deleteDialog.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export const ProviderEditor = {
  Form,
  Identity,
  Attribution,
  SponsorCTA,
  ConfigHeader,
  NameField,
  DescriptionField,
  ConnectionFields,
  ProviderSpecificFields,
  TranslationModelFields,
  AdvancedFields,
  Assignments,
  AssignmentRow,
  CompatibleFeatureAssignments,
  LanguageDetectionAssignment,
  CustomActionAssignments,
  DuplicateButton,
  DeleteButton,
}

export const BuiltInProviderEditor = {
  Provider: BuiltInProvider,
}

export const CustomProviderEditor = {
  Provider: CustomProvider,
}
