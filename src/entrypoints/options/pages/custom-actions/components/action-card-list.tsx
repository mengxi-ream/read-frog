import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type { CustomActionTemplate } from "@/utils/constants/custom-action-templates"
import { Icon } from "@iconify/react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router"
import { SortableList } from "@/components/sortable-list"
import { Button } from "@/components/ui/base-ui/button"
import { Dialog, DialogTrigger } from "@/components/ui/base-ui/dialog"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { BUILT_IN_DICTIONARY_ACTION_ID, DEFAULT_ACTION_NAME } from "@/utils/constants/custom-action"
import { getBuiltInDictionaryAction, patchSelectionToolbarAction } from "@/utils/custom-actions"
import { i18n } from "@/utils/i18n"
import { getUniqueName } from "@/utils/name"
import { getSelectableProvidersForCapability } from "@/utils/providers/provider-registry"
import { EntityListItem } from "../../../components/entity-list-item"
import { EntityListRail } from "../../../components/entity-list-rail"
import { selectedCustomActionIdAtom } from "../atoms"
import { AddActionDialog } from "./add-action-dialog"

export function CustomActionCardList() {
  const [selectionToolbarConfig, setSelectionToolbarConfig] = useAtom(
    configFieldsAtomMap.selectionToolbar,
  )
  const setSelectedCustomActionId = useSetAtom(selectedCustomActionIdAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const { search } = useLocation()
  const navigate = useNavigate()
  const [dialogOpen, setDialogOpen] = useState(() => new URLSearchParams(search).has("addAction"))
  const customActions = selectionToolbarConfig.customActions
  const builtInDictionary = getBuiltInDictionaryAction(selectionToolbarConfig)

  useEffect(() => {
    const params = new URLSearchParams(search)
    const actionId = params.get("actionId")

    if (
      actionId === BUILT_IN_DICTIONARY_ACTION_ID ||
      (actionId && customActions.some((action) => action.id === actionId))
    ) {
      setSelectedCustomActionId(actionId)
    }

    if (params.has("addAction") || params.has("actionId")) {
      params.delete("addAction")
      params.delete("actionId")
      const nextSearch = params.toString()
      void navigate({ search: nextSearch ? `?${nextSearch}` : "" }, { replace: true })
    }
  }, [search, navigate, customActions, setSelectedCustomActionId])

  const customActionProviders = useMemo(
    () => getSelectableProvidersForCapability("selectionToolbar.customAction", providersConfig),
    [providersConfig],
  )

  const handleTemplateSelect = (template: CustomActionTemplate) => {
    if (customActionProviders.length === 0) return

    const newAction = template.createAction(customActionProviders[0]!.id)

    const existingNames = new Set(customActions.map((action) => action.name))
    const baseName = template.id === "blank" ? DEFAULT_ACTION_NAME : newAction.name
    newAction.name = getUniqueName(baseName, existingNames)

    void setSelectionToolbarConfig({
      ...selectionToolbarConfig,
      customActions: [...customActions, newAction],
    })
    setSelectedCustomActionId(newAction.id)
    setDialogOpen(false)
  }

  const handleReorder = (newList: SelectionToolbarCustomAction[]) => {
    void setSelectionToolbarConfig({
      ...selectionToolbarConfig,
      customActions: newList,
    })
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
                  {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.add")}
                </span>
              </div>
            </Button>
          }
        />
        <AddActionDialog onSelect={handleTemplateSelect} />
      </Dialog>

      {customActionProviders.length === 0 && (
        <div className="text-sm text-amber-600 dark:text-amber-400">
          {i18n.t(
            "options.floatingButtonAndToolbar.selectionToolbar.customActions.noEnabledLlmProvider",
          )}
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
          {i18n.t(
            "options.floatingButtonAndToolbar.selectionToolbar.customActions.builtIn" as never,
          )}
        </h3>
        <BuiltInDictionaryCard action={builtInDictionary} />
      </section>
    </div>
  )
}

function BuiltInDictionaryCard({ action }: { action: SelectionToolbarCustomAction }) {
  const [selectionToolbarConfig, setSelectionToolbarConfig] = useAtom(
    configFieldsAtomMap.selectionToolbar,
  )
  const [selectedCustomActionId, setSelectedCustomActionId] = useAtom(selectedCustomActionIdAtom)

  return (
    <EntityListItem.Root
      data-action-id={BUILT_IN_DICTIONARY_ACTION_ID}
      selected={selectedCustomActionId === action.id}
      className={action.enabled === false ? "opacity-70" : undefined}
      onClick={() => setSelectedCustomActionId(action.id)}
    >
      <EntityListItem.Content>
        <EntityListItem.Identity>
          <Icon icon={action.icon} className="size-4 shrink-0 text-zinc-600 dark:text-zinc-300" />
          <span className="truncate text-sm font-medium">{action.name}</span>
        </EntityListItem.Identity>
        <EntityListItem.Toggle
          aria-label={action.name}
          checked={action.enabled !== false}
          onCheckedChange={(enabled) => {
            void setSelectionToolbarConfig(
              patchSelectionToolbarAction(selectionToolbarConfig, action.id, { enabled }),
            )
          }}
        />
      </EntityListItem.Content>
    </EntityListItem.Root>
  )
}

function CustomActionCard({ action }: { action: SelectionToolbarCustomAction }) {
  const [selectionToolbarConfig, setSelectionToolbarConfig] = useAtom(
    configFieldsAtomMap.selectionToolbar,
  )
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
            void setSelectionToolbarConfig(
              patchSelectionToolbarAction(selectionToolbarConfig, action.id, { enabled }),
            )
          }}
        />
      </EntityListItem.Content>
    </EntityListItem.Root>
  )
}
