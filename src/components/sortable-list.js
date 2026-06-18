import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors, } from "@dnd-kit/core";
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { cn } from "@/utils/styles/utils";
export function SortableList({ list, setList, renderItem, className, }) {
    const [activeId, setActiveId] = useState(null);
    const activeItem = activeId ? (list.find(item => item.id === activeId) ?? null) : null;
    const sensors = useSensors(useSensor(PointerSensor, {
        activationConstraint: {
            distance: 8,
        },
    }), useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
    }));
    const handleDragStart = (event) => {
        setActiveId(String(event.active.id));
    };
    const handleDragEnd = (event) => {
        setActiveId(null);
        const { active, over } = event;
        if (over && String(active.id) !== String(over.id)) {
            const activeItemId = String(active.id);
            const activeElement = document.querySelector(`[data-sortable-id="${activeItemId}"]`);
            const scrollContainer = findVerticalScrollContainer(activeElement);
            const scrollTopBeforeUpdate = scrollContainer?.scrollTop;
            const oldIndex = list.findIndex(item => item.id === activeItemId);
            const newIndex = list.findIndex(item => item.id === String(over.id));
            if (oldIndex === -1 || newIndex === -1)
                return;
            setList(arrayMove(list, oldIndex, newIndex));
            // Keep the scroll position stable after reordering.
            if (scrollContainer && scrollTopBeforeUpdate !== undefined) {
                requestAnimationFrame(() => {
                    scrollContainer.scrollTop = scrollTopBeforeUpdate;
                });
            }
        }
    };
    return (_jsxs(DndContext, { sensors: sensors, collisionDetection: closestCenter, modifiers: [restrictToVerticalAxis, restrictToFirstScrollableAncestor], onDragStart: handleDragStart, onDragEnd: handleDragEnd, onDragCancel: () => setActiveId(null), children: [_jsx(SortableContext, { items: list.map(item => item.id), strategy: verticalListSortingStrategy, children: _jsx("div", { className: className, style: { overflowAnchor: "none" }, children: list.map(item => (_jsx(SortableItemWrapper, { id: item.id, children: renderItem(item) }, item.id))) }) }), _jsx(DragOverlay, { children: _jsx("div", { className: "cursor-grabbing rounded-xl shadow-xl", children: activeItem ? renderItem(activeItem) : null }) })] }));
}
function SortableItemWrapper({ id, children }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging, } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        overflowAnchor: "none",
    };
    return (_jsx("div", { ref: setNodeRef, "data-sortable-id": id, style: style, className: cn("cursor-grab active:cursor-grabbing rounded-xl transition-all duration-200", isDragging && "opacity-50"), ...attributes, ...listeners, children: children }));
}
function findVerticalScrollContainer(element) {
    let current = element;
    while (current) {
        const style = window.getComputedStyle(current);
        const overflowY = style.overflowY;
        const isScrollable = overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
        if (isScrollable && current.scrollHeight > current.clientHeight) {
            return current;
        }
        current = current.parentElement;
    }
    return null;
}
