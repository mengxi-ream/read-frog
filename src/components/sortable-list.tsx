import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useState } from 'react'
import { cn } from '@/utils/styles/tailwind'

export function SortableList<T extends { id: string }>({
  list,
  setList,
  renderItem,
  className,
}: {
  list: T[]
  setList: (items: T[]) => void
  renderItem: (item: T) => React.ReactNode
  className?: string
}) {
  // Use local state to ensure immediate UI updates during drag operations,
  // since the external setList may be async (e.g., storage sync)
  const [localList, setLocalList] = useState(list)
  const [activeItem, setActiveItem] = useState<T | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setLocalList(list)
  }, [list])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragStart = (event: DragStartEvent) => {
    const item = localList.find(item => item.id === event.active.id)
    setActiveItem(item ?? null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null)
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = localList.findIndex(item => item.id === active.id)
      const newIndex = localList.findIndex(item => item.id === over.id)
      const newList = arrayMove(localList, oldIndex, newIndex)
      setLocalList(newList)
      setList(newList)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={localList.map(item => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className={className}>
          {localList.map(item => (
            <SortableItemWrapper key={item.id} id={item.id}>
              {renderItem(item)}
            </SortableItemWrapper>
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        <div className="cursor-grabbing rounded-xl shadow-xl">
          {activeItem ? renderItem(activeItem) : null}
        </div>
      </DragOverlay>
    </DndContext>
  )
}

function SortableItemWrapper({ id, children }: { id: string, children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'cursor-grab active:cursor-grabbing rounded-xl transition-all duration-200',
        isDragging && 'opacity-50',
      )}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  )
}
