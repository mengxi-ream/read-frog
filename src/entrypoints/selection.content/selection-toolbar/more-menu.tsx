import type { DragEndEvent } from "@dnd-kit/core"
import type { SelectionToolbarItem } from "@/utils/selection-toolbar-items"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Icon } from "@iconify/react"
import { RiTranslate } from "@remixicon/react"
import {
  IconDotsVertical,
  IconGripVertical,
  IconLoader2,
  IconPin,
  IconPinnedFilled,
  IconPlayerStopFilled,
  IconVolume,
} from "@tabler/icons-react"
import { useAtom } from "jotai"
import { useRef, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/base-ui/popover"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import {
  getSelectionToolbarItems,
  reorderSelectionToolbarItems,
  setSelectionToolbarItemPinned,
} from "@/utils/selection-toolbar-items"
import { cn } from "@/utils/styles/utils"
import { shadowWrapper } from ".."
import { SelectionToolbarTooltip } from "../components/selection-tooltip"
import { SELECTION_CONTENT_OVERLAY_LAYERS } from "../overlay-layers"
import { DropEvent } from "./close-button"
import { useSelectionCustomActionPopover } from "./custom-action-button/provider"
import { useSelectionSpeech } from "./speak-button"
import { useSelectionTranslationPopover } from "./translate-button/provider"

type SelectionSpeech = ReturnType<typeof useSelectionSpeech>

// The toolbar's "more" menu: every enabled item, pinned or not, in the
// toolbar's order. A row runs its item; its pin puts the item's button on the
// toolbar or takes it off; its grip drags it to a new place in the order.
export function SelectionToolbarMoreMenu() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const [open, setOpen] = useState(false)
  // Opened by hover, the menu closes when the pointer leaves it. Once the
  // user works in it, it stays (a press elsewhere, Escape or the button close
  // it): a pin resizes the toolbar and can move the menu out from under the
  // pointer, and a drag can carry the pointer out.
  const engagedRef = useRef(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { openToolbarTranslation } = useSelectionTranslationPopover()
  const { openToolbarCustomAction } = useSelectionCustomActionPopover()
  const speech = useSelectionSpeech()
  const items = getSelectionToolbarItems(selectionToolbar).filter((item) => item.enabled)
  const label = i18n.t("action.moreActions")

  const changeOpen = (nextOpen: boolean) => {
    engagedRef.current = false
    setOpen(nextOpen)
    // Keeps the toolbar up while the menu is open, like its close menu:
    // Firefox clears the page's selection when the menu takes focus.
    window.dispatchEvent(new CustomEvent(DropEvent, { detail: { open: nextOpen } }))
  }

  const runItem = (item: SelectionToolbarItem) => {
    changeOpen(false)
    // Opened where the item's own toolbar button would be.
    const anchor = triggerRef.current
    if (item.kind === "action") {
      openToolbarCustomAction(item.id, anchor)
    } else if (item.id === "translate") {
      openToolbarTranslation(anchor)
    } else {
      speech.toggle()
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen, { reason }) => {
        if (!nextOpen && reason === "trigger-hover" && engagedRef.current) return
        changeOpen(nextOpen)
      }}
    >
      <PopoverTrigger
        ref={triggerRef}
        openOnHover
        delay={100}
        closeDelay={200}
        aria-label={label}
        render={
          <button
            type="button"
            className="flex h-7 shrink-0 cursor-pointer items-center justify-center px-1 hover:bg-accent data-popup-open:bg-accent"
          />
        }
      >
        <IconDotsVertical className="size-4" strokeWidth={1.6} />
      </PopoverTrigger>
      <PopoverContent
        container={shadowWrapper ?? document.body}
        side="bottom"
        align="end"
        positionerClassName={SELECTION_CONTENT_OVERLAY_LAYERS.selectionOverlay}
        className="max-h-[min(22rem,var(--available-height))] w-56 gap-0 p-1"
        aria-label={label}
        onPointerDown={() => {
          engagedRef.current = true
        }}
        onKeyDown={() => {
          engagedRef.current = true
        }}
      >
        <MoreMenuItems
          items={items}
          speech={speech}
          onRun={runItem}
          onPinChange={(item, pinned) => {
            void setSelectionToolbar((current) =>
              setSelectionToolbarItemPinned(current, item.id, pinned),
            )
          }}
          onReorder={(orderedIds) => {
            void setSelectionToolbar((current) => reorderSelectionToolbarItems(current, orderedIds))
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function MoreMenuItems({
  items,
  speech,
  onRun,
  onPinChange,
  onReorder,
}: {
  items: SelectionToolbarItem[]
  speech: SelectionSpeech
  onRun: (item: SelectionToolbarItem) => void
  onPinChange: (item: SelectionToolbarItem, pinned: boolean) => void
  onReorder: (orderedIds: string[]) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const ids = items.map((item) => item.id)

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from === -1 || to === -1) return
    onReorder(arrayMove(ids, from, to))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
      // Its screen reader text stays in the extension's shadow root, off the page.
      accessibility={{ container: shadowWrapper ?? undefined }}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="min-h-0 overflow-y-auto select-none">
          {items.map((item) => (
            <MoreMenuRow
              key={item.id}
              item={item}
              speech={speech}
              onRun={onRun}
              onPinChange={onPinChange}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function MoreMenuRow({
  item,
  speech,
  onRun,
  onPinChange,
}: {
  item: SelectionToolbarItem
  speech: SelectionSpeech
  onRun: (item: SelectionToolbarItem) => void
  onPinChange: (item: SelectionToolbarItem, pinned: boolean) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })
  const pinLabel = i18n.t(item.pinned ? "action.unpinFromToolbar" : "action.pinToToolbar")

  return (
    <li
      ref={setNodeRef}
      data-item-id={item.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group/row relative flex h-8 items-center rounded-md hover:bg-accent",
        isDragging && "z-10 bg-accent shadow-sm",
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={i18n.t("action.dragToReorder")}
        className="flex h-full shrink-0 cursor-grab touch-none items-center px-0.5 text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <IconGripVertical className="size-3.5" />
      </button>
      <button
        type="button"
        className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 pr-1 text-left"
        onClick={() => onRun(item)}
      >
        <MoreMenuItemIcon item={item} speech={speech} />
        <span className="truncate">{getItemName(item, speech)}</span>
      </button>
      <SelectionToolbarTooltip
        content={pinLabel}
        render={
          <button
            type="button"
            aria-label={pinLabel}
            className={cn(
              "mr-0.5 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm",
              item.pinned
                ? "text-accent-blue hover:text-accent-blue-hover"
                : "text-muted-foreground opacity-0 group-hover/row:opacity-100 hover:text-foreground focus-visible:opacity-100",
            )}
            onClick={() => onPinChange(item, !item.pinned)}
          />
        }
      >
        {item.pinned ? <IconPinnedFilled className="size-4" /> : <IconPin className="size-4" />}
      </SelectionToolbarTooltip>
    </li>
  )
}

function getItemName(item: SelectionToolbarItem, speech: SelectionSpeech) {
  if (item.kind === "action") return item.action.name
  return item.id === "translate" ? i18n.t("action.translation") : speech.label
}

function MoreMenuItemIcon({
  item,
  speech,
}: {
  item: SelectionToolbarItem
  speech: SelectionSpeech
}) {
  const className = "size-4 shrink-0"
  if (item.kind === "action") {
    return <Icon icon={item.action.icon} strokeWidth={0.8} className={className} />
  }
  if (item.id === "translate") {
    return <RiTranslate className={className} />
  }
  if (speech.isFetching) {
    return <IconLoader2 className={cn(className, "animate-spin")} strokeWidth={1.6} />
  }
  if (speech.isPlaying) {
    return <IconPlayerStopFilled className={className} strokeWidth={1.6} />
  }
  return <IconVolume className={className} strokeWidth={1.6} />
}
