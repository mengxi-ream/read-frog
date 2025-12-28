import type { DragEndEvent } from '@dnd-kit/core'
import type { RefObject } from 'react'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IconGripVertical } from '@tabler/icons-react'

export function SortableList<T>({
  items,
  getItemId,
  onReorder,
  renderItem,
  className,
  containerRef,
}: {
  items: T[]
  getItemId: (item: T) => string
  onReorder: (items: T[]) => void
  renderItem: (item: T) => React.ReactNode
  className?: string
  containerRef?: RefObject<HTMLDivElement | null>
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(item => getItemId(item) === active.id)
      const newIndex = items.findIndex(item => getItemId(item) === over.id)
      onReorder(arrayMove(items, oldIndex, newIndex))
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map(getItemId)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={containerRef} className={className}>
          {items.map(item => (
            <SortableItem
              key={getItemId(item)}
              id={getItemId(item)}
              item={item}
              renderItem={renderItem}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableItem<T>({
  id,
  item,
  renderItem,
}: {
  id: string
  item: T
  renderItem: (item: T) => React.ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
  } = useSortable({
    id,
    animateLayoutChanges: () => false,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition: 'none' }}
      {...attributes}
      className="group flex items-center gap-2"
    >
      <button
        type="button"
        className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
        {...listeners}
      >
        <IconGripVertical className="size-4" />
      </button>
      <div className="flex-1 min-w-0">
        {renderItem(item)}
      </div>
    </div>
  )
}
