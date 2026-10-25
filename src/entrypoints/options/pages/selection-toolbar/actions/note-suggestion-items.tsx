import { useAtom } from "jotai"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { useFeatureProvider } from "@/components/llm-providers/use-feature-providers"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getSelectionToolbarActions, resolveNoteSuggestionAction } from "@/utils/custom-actions"
import { i18n } from "@/utils/i18n"
import { ActionSelect } from "../../../components/action-select"
import { ConfigItem } from "../../../components/config-item"

/**
 * Whether translating a selection offers to save what it found, and which action does the
 * finding. The second row goes untitled: it only exists for the switch above it, and reads as
 * a continuation of it rather than a setting of its own.
 */
export function NoteSuggestionItems() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const actions = getSelectionToolbarActions(selectionToolbar)
  const selectedAction = resolveNoteSuggestionAction(selectionToolbar)
  const suggestionProvider = useFeatureProvider("noteSuggestion")

  return (
    <>
      <ConfigItem
        id="selection-toolbar-note-suggestion"
        title={i18n.t("options.selectionToolbar.actions.noteSuggestion.title")}
        description={i18n.t("options.selectionToolbar.actions.noteSuggestion.description")}
      >
        <Switch
          checked={selectionToolbar.noteSuggestion.enabled}
          onCheckedChange={(checked) =>
            void setSelectionToolbar({
              ...selectionToolbar,
              noteSuggestion: { ...selectionToolbar.noteSuggestion, enabled: checked },
            })
          }
        />
      </ConfigItem>
      <ConfigItem
        description={i18n.t("options.selectionToolbar.actions.noteSuggestion.actionDescription")}
      >
        {/* The row carries no title, so the control names itself. */}
        <ActionSelect
          actions={actions}
          selected={selectedAction}
          label={i18n.t("options.selectionToolbar.actions.noteSuggestion.action")}
          onSelect={(actionId) =>
            void setSelectionToolbar({
              ...selectionToolbar,
              noteSuggestion: { ...selectionToolbar.noteSuggestion, actionId },
            })
          }
        />
      </ConfigItem>
      <ConfigItem
        description={i18n.t("options.selectionToolbar.actions.noteSuggestion.providerDescription")}
      >
        <ProviderSelector
          providers={suggestionProvider.providers}
          value={suggestionProvider.providerId}
          onChange={suggestionProvider.setProviderId}
          triggerSize="sm"
        />
      </ConfigItem>
    </>
  )
}
