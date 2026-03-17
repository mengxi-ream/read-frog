import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type { CustomActionTemplate } from "@/utils/constants/custom-action-templates"
import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { useAtom, useAtomValue } from "jotai"
import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router"
import { SortableList } from "@/components/sortable-list"
import { Button } from "@/components/ui/base-ui/button"
import { Dialog, DialogTrigger } from "@/components/ui/base-ui/dialog"
import { Switch } from "@/components/ui/base-ui/switch"
import { isLLMProviderConfig } from "@/types/config/provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { DEFAULT_ACTION_NAME } from "@/utils/constants/custom-action"
import { getUniqueName } from "@/utils/name"
import { cn } from "@/utils/styles/utils"
import { EntityListRail } from "../../../components/entity-list-rail"
import { selectedCustomActionIdAtom } from "../atoms"
import { AddActionDialog } from "./add-action-dialog"

export function CustomActionCardList() {
  const [selectionToolbarConfig, setSelectionToolbarConfig] = useAtom(configFieldsAtomMap.selectionToolbar)
  const [, setSelectedCustomActionId] = useAtom(selectedCustomActionIdAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const { search } = useLocation()
  const navigate = useNavigate()
  const [dialogOpen, setDialogOpen] = useState(() => new URLSearchParams(search).has("addAction"))

  useEffect(() => {
    if (new URLSearchParams(search).has("addAction")) {
      void navigate({ search: "" }, { replace: true })
    }
  }, [search, navigate])

  const customActions = selectionToolbarConfig.customActions ?? []
  const llmProviders = useMemo(
    () => providersConfig.filter(provider => provider.enabled && isLLMProviderConfig(provider)),
    [providersConfig],
  )

  const handleTemplateSelect = (template: CustomActionTemplate) => {
    if (llmProviders.length === 0)
      return

    const newAction = template.createAction(llmProviders[0].id)

    const existingNames = new Set(customActions.map(action => action.name))
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
          render={(
            <Button variant="outline" className="h-auto p-3 border-dashed rounded-xl" disabled={llmProviders.length === 0}>
              <div className="flex items-center justify-center gap-2 w-full">
                <Icon icon="tabler:plus" className="size-4" />
                <span className="text-sm">{i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.add")}</span>
              </div>
            </Button>
          )}
        />
        <AddActionDialog onSelect={handleTemplateSelect} />
      </Dialog>

      {llmProviders.length === 0 && (
        <div className="text-sm text-amber-600 dark:text-amber-400">
          {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.noEnabledLlmProvider")}
        </div>
      )}

      {customActions.length > 0 && (
        <EntityListRail>
          <SortableList
            list={customActions}
            setList={handleReorder}
            className="flex flex-col gap-3 pt-2"
            renderItem={action => (
              <CustomActionCard action={action} />
            )}
          />
        </EntityListRail>
      )}
    </div>
  )
}

function CustomActionCard({ action }: { action: SelectionToolbarCustomAction }) {
  const [selectionToolbarConfig, setSelectionToolbarConfig] = useAtom(configFieldsAtomMap.selectionToolbar)
  const [selectedCustomActionId, setSelectedCustomActionId] = useAtom(selectedCustomActionIdAtom)
  const customActions = selectionToolbarConfig.customActions ?? []

  return (
    <div
      className={cn(
        "rounded-xl border p-3 bg-card transition-colors cursor-pointer",
        selectedCustomActionId === action.id && "border-primary",
        action.enabled === false && "opacity-70",
      )}
      onClick={() => setSelectedCustomActionId(action.id)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-4">
            <Icon icon={action.icon} className="size-4 text-zinc-600 dark:text-zinc-300 shrink-0" />
          </div>
          <span className="text-sm font-medium truncate">{action.name}</span>
        </div>
        <Switch
          checked={action.enabled !== false}
          onCheckedChange={(checked) => {
            void setSelectionToolbarConfig({
              ...selectionToolbarConfig,
              customActions: customActions.map(item =>
                item.id === action.id ? { ...item, enabled: checked } : item,
              ),
            })
          }}
          onPointerDown={event => event.stopPropagation()}
          onClick={event => event.stopPropagation()}
        />
      </div>
    </div>
  )
}
