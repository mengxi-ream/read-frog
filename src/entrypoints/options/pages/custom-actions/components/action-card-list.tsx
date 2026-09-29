import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type { CustomActionTemplate } from "@/utils/constants/custom-action-templates"
import { Icon } from "@iconify/react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { useMemo, useState } from "react"
import { useLocation } from "react-router"
import { requestEditorNavigationAtom } from "@/components/form/autosave-navigation"
import { SortableList } from "@/components/sortable-list"
import { Button } from "@/components/ui/base-ui/button"
import { Dialog, DialogTrigger } from "@/components/ui/base-ui/dialog"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import {
  BUILT_IN_DICTIONARY_ACTION_ID,
  BUILT_IN_IMPROVE_WRITING_ACTION_ID,
  BUILT_IN_SENTENCE_ANALYSIS_ACTION_ID,
  DEFAULT_ACTION_NAME,
} from "@/utils/constants/custom-action"
import { getBuiltInActions, patchSelectionToolbarAction } from "@/utils/custom-actions"
import { i18n } from "@/utils/i18n"
import { createLayoutSampleData } from "@/utils/layout-host/sample"
import { getUniqueName } from "@/utils/name"
import { CUSTOM_ACTION_ADD_QUERY_PARAM } from "@/utils/navigation"
import { getSelectableProvidersForCapability } from "@/utils/providers/provider-registry"
import { setSelectionToolbarCustomActions } from "@/utils/selection-toolbar-items"
import { EntityListItem } from "../../../components/entity-list-item"
import { EntityListRail } from "../../../components/entity-list-rail"
import { customActionEditorTabAtom, selectedCustomActionIdAtom } from "../atoms"
import { AddActionDialog } from "./add-action-dialog"
import { RecentChangeBadge } from "./recent-change-badge"

export function CustomActionCardList() {
  const [selectionToolbarConfig, setSelectionToolbarConfig] = useAtom(
    configFieldsAtomMap.selectionToolbar,
  )
  const requestNavigation = useSetAtom(requestEditorNavigationAtom)
  const setSelectedCustomActionId = useSetAtom(selectedCustomActionIdAtom)
  const setEditorTab = useSetAtom(customActionEditorTabAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const { targetCode } = useAtomValue(configFieldsAtomMap.language)
  const { search } = useLocation()
  // Read at mount only; `useCustomActionDeepLink` strips the param right after.
  const [dialogOpen, setDialogOpen] = useState(() =>
    new URLSearchParams(search).has(CUSTOM_ACTION_ADD_QUERY_PARAM),
  )
  const customActions = selectionToolbarConfig.customActions
  const builtInActions = getBuiltInActions(selectionToolbarConfig)

  const customActionProviders = useMemo(
    () => getSelectableProvidersForCapability("customAction", providersConfig),
    [providersConfig],
  )

  const handleTemplateSelect = (template: CustomActionTemplate) => {
    if (customActionProviders.length === 0) return
    void requestNavigation(async () => {
      const newAction = template.createAction(customActionProviders[0]!.id)
      const baseName = template.id === "blank" ? DEFAULT_ACTION_NAME : newAction.name
      await setSelectionToolbarConfig((current) => ({
        ...current,
        customActions: [
          ...current.customActions,
          {
            ...newAction,
            name: getUniqueName(baseName, new Set(current.customActions.map((item) => item.name))),
            sampleData: createLayoutSampleData(newAction.outputSchema, targetCode),
          },
        ],
      }))
      setEditorTab("config")
      await setSelectedCustomActionId(newAction.id)
      setDialogOpen(false)
    })
  }

  // The toolbar's order follows, so the selection toolbar and its menu list
  // the actions the same way.
  const handleReorder = (newList: SelectionToolbarCustomAction[]) => {
    void setSelectionToolbarConfig(
      setSelectionToolbarCustomActions(selectionToolbarConfig, newList),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger
          render={
            <Button
              variant="outline"
              className="h-auto rounded-xl border-dashed border-accent-blue bg-accent-blue/8 p-3 hover:bg-accent-blue/14 dark:border-accent-blue dark:bg-accent-blue/12 dark:hover:bg-accent-blue/20"
              disabled={customActionProviders.length === 0}
            >
              <div className="flex w-full items-center justify-center gap-2">
                <Icon icon="tabler:plus" className="size-4" />
                <span className="text-sm">
                  {i18n.t("options.selectionToolbar.customActions.add")}
                </span>
              </div>
            </Button>
          }
        />
        <AddActionDialog onSelect={handleTemplateSelect} />
      </Dialog>

      {customActionProviders.length === 0 && (
        <div className="text-sm text-amber-600 dark:text-amber-400">
          {i18n.t("options.selectionToolbar.customActions.noEnabledLlmProvider")}
        </div>
      )}

      {customActions.length > 0 && (
        <EntityListRail>
          <SortableList
            list={customActions}
            setList={handleReorder}
            className="flex flex-col gap-4 pt-2"
            renderItem={(action) => <CustomActionCard action={action} />}
          />
        </EntityListRail>
      )}

      <section className="flex flex-col gap-2 pt-1">
        <h3 className="px-1 text-xs font-medium text-muted-foreground">
          {i18n.t("options.selectionToolbar.customActions.builtIn" as never)}
        </h3>
        <div className="flex flex-col gap-4 pt-2">
          {builtInActions.map((action) => (
            <BuiltInActionCard key={action.id} action={action} />
          ))}
        </div>
      </section>
    </div>
  )
}

function BuiltInActionCard({ action }: { action: SelectionToolbarCustomAction }) {
  const setSelectionToolbarConfig = useSetAtom(configFieldsAtomMap.selectionToolbar)
  const [selectedCustomActionId, setSelectedCustomActionId] = useAtom(selectedCustomActionIdAtom)

  return (
    <EntityListItem.Root
      data-action-id={action.id}
      selected={selectedCustomActionId === action.id}
      className={action.enabled === false ? "opacity-70" : undefined}
      onClick={() => setSelectedCustomActionId(action.id)}
    >
      <EntityListItem.Badges>
        {action.id === BUILT_IN_DICTIONARY_ACTION_ID && (
          <RecentChangeBadge kind="updated" date="2026-09-27" />
        )}
        {action.id === BUILT_IN_SENTENCE_ANALYSIS_ACTION_ID && (
          <RecentChangeBadge kind="new" date="2026-09-27" />
        )}
        {action.id === BUILT_IN_IMPROVE_WRITING_ACTION_ID && (
          <RecentChangeBadge kind="new" date="2026-09-27" />
        )}
      </EntityListItem.Badges>
      <EntityListItem.Content>
        <EntityListItem.Identity>
          <Icon icon={action.icon} className="size-4 shrink-0 text-zinc-600 dark:text-zinc-300" />
          <span className="truncate text-sm font-medium">{action.name}</span>
        </EntityListItem.Identity>
        <EntityListItem.Toggle
          aria-label={action.name}
          checked={action.enabled !== false}
          onCheckedChange={(enabled) => {
            void setSelectionToolbarConfig((current) =>
              patchSelectionToolbarAction(current, action.id, { enabled }),
            )
          }}
        />
      </EntityListItem.Content>
    </EntityListItem.Root>
  )
}

function CustomActionCard({ action }: { action: SelectionToolbarCustomAction }) {
  const setSelectionToolbarConfig = useSetAtom(configFieldsAtomMap.selectionToolbar)
  const [selectedCustomActionId, setSelectedCustomActionId] = useAtom(selectedCustomActionIdAtom)

  return (
    <EntityListItem.Root
      selected={selectedCustomActionId === action.id}
      className={action.enabled === false ? "opacity-70" : undefined}
      onClick={() => setSelectedCustomActionId(action.id)}
    >
      <EntityListItem.Content>
        <EntityListItem.Identity>
          <div className="size-4">
            <Icon icon={action.icon} className="size-4 shrink-0 text-zinc-600 dark:text-zinc-300" />
          </div>
          <span className="truncate text-sm font-medium">{action.name}</span>
        </EntityListItem.Identity>
        <EntityListItem.Toggle
          aria-label={action.name}
          checked={action.enabled !== false}
          onCheckedChange={(enabled) => {
            void setSelectionToolbarConfig((current) =>
              patchSelectionToolbarAction(current, action.id, { enabled }),
            )
          }}
        />
      </EntityListItem.Content>
    </EntityListItem.Root>
  )
}
