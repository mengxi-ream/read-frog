import type { DragEndEvent } from '@dnd-kit/core'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useState } from 'react'

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

  const handleDragEnd = (event: DragEndEvent) => {
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
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
      autoScroll={false}
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
    </DndContext>
  )
}

function SortableItemWrapper({ id, children }: { id: string, children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
  } = useSortable({
    id,
    animateLayoutChanges: () => false,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="cursor-grab active:cursor-grabbing rounded-xl"
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  )
}
