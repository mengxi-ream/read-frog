import type { HostedAiModel } from "@/utils/hosted-ai/models"
import type { HostedAiReasoning } from "@/utils/hosted-ai/types"
import type { I18nKey } from "@/utils/i18n"
import type { BuiltInAiUnavailability } from "@/utils/providers/provider-display"
import { IconAlertTriangle } from "@tabler/icons-react"
import { useAtomValue, useSetAtom } from "jotai"
import { useId } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/base-ui/alert"
import { Badge } from "@/components/ui/base-ui/badge"
import { Field, FieldDescription, FieldTitle } from "@/components/ui/base-ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { configAtom, writeConfigAtom } from "@/utils/atoms/config"
import { formatHostedAiModelAlternatives } from "@/utils/hosted-ai/model-errors"
import { getEffectiveHostedAiReasoning } from "@/utils/hosted-ai/models"
import { i18n } from "@/utils/i18n"

const REASONING_LEVEL_LABEL_KEYS = {
  none: "options.apiProviders.builtInModel.reasoningLevels.none",
  minimal: "options.apiProviders.builtInModel.reasoningLevels.minimal",
  low: "options.apiProviders.builtInModel.reasoningLevels.low",
  medium: "options.apiProviders.builtInModel.reasoningLevels.medium",
  high: "options.apiProviders.builtInModel.reasoningLevels.high",
  xhigh: "options.apiProviders.builtInModel.reasoningLevels.xhigh",
} as const satisfies Record<HostedAiReasoning, I18nKey>

function getReasoningLevelLabel(level: HostedAiReasoning): string {
  return i18n.t(REASONING_LEVEL_LABEL_KEYS[level])
}

/**
 * How hard one Built-in AI model thinks, offered with the levels the server
 * lists for it. A model with one level has nothing to choose, so no field.
 * The choice is kept per model and goes with every request to it, except
 * language detection, which the server always runs at the default.
 */
export function BuiltInModelReasoningField({ model }: { model: HostedAiModel }) {
  const choice = useAtomValue(configAtom).builtInAi.models[model.id]?.reasoning
  const setConfig = useSetAtom(writeConfigAtom)
  const titleId = useId()

  if (model.reasoning.levels.length < 2) {
    return null
  }

  const value = getEffectiveHostedAiReasoning(model, choice)
  const defaultLabel = i18n.t("options.apiProviders.builtInModel.reasoningDefault")

  return (
    <Field>
      <FieldTitle id={titleId}>{i18n.t("options.apiProviders.form.reasoning.title")}</FieldTitle>
      <Select<HostedAiReasoning>
        value={value}
        onValueChange={(level) => {
          if (!level) return
          void setConfig({ builtInAi: { models: { [model.id]: { reasoning: level } } } })
        }}
      >
        <SelectTrigger className="w-full" aria-labelledby={titleId}>
          {/* The level's name alone: "Default" marks a choice in the list, not the value. */}
          <SelectValue placeholder={defaultLabel}>
            {(level: HostedAiReasoning | null) =>
              level ? getReasoningLevelLabel(level) : defaultLabel
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {model.reasoning.levels.map((level) => (
              <SelectItem key={level} value={level}>
                <span className="flex items-center gap-2">
                  <span>{getReasoningLevelLabel(level)}</span>
                  {level === model.reasoning.default && (
                    <Badge variant="secondary" size="sm">
                      {defaultLabel}
                    </Badge>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <FieldDescription>
        {i18n.t("options.apiProviders.builtInModel.reasoningDescription", [model.name])}
      </FieldDescription>
    </Field>
  )
}

/**
 * Says at the top of a model's panel that it cannot run, why, and which models
 * to switch its features to. Nothing switches by itself: the user picks.
 */
export function BuiltInModelUnavailableAlert({
  name,
  unavailability,
  alternativeNames,
}: {
  name: string
  unavailability: BuiltInAiUnavailability
  alternativeNames: readonly string[]
}) {
  return (
    <Alert variant="warning">
      <IconAlertTriangle aria-hidden />
      <AlertTitle>
        {unavailability === "removed"
          ? i18n.t("options.apiProviders.builtInModel.unavailableTitle.removed", [name])
          : i18n.t("options.apiProviders.builtInModel.unavailableTitle.temporary", [name])}
      </AlertTitle>
      <AlertDescription>
        {alternativeNames.length > 0
          ? i18n.t("options.apiProviders.builtInModel.unavailableDescription", [
              formatHostedAiModelAlternatives(alternativeNames),
            ])
          : i18n.t("options.apiProviders.builtInModel.unavailableDescriptionNoAlternatives")}
      </AlertDescription>
    </Alert>
  )
}
