import { jsx as _jsx } from "react/jsx-runtime";
import { Icon } from "@iconify/react";
import { useCallback, useRef, useState } from "react";
import { cn } from "@/utils/styles/utils";
const STORAGE_KEY = "help-button-corner";
const OFFSET = 16;
const DRAG_THRESHOLD = 5;
const cornerStyles = {
    "bottom-right": { bottom: OFFSET, right: OFFSET, top: "auto", left: "auto" },
    "top-right": { top: OFFSET, right: OFFSET, bottom: "auto", left: "auto" },
};
function getStoredCorner() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && stored in cornerStyles)
            return stored;
    }
    catch { }
    return "bottom-right";
}
function getNearestCorner(_x, y) {
    const cy = window.innerHeight / 2;
    return y >= cy ? "bottom-right" : "top-right";
}
export function HelpButton() {
    const [corner, setCorner] = useState(getStoredCorner);
    const [dragging, setDragging] = useState(false);
    const [dragPos, setDragPos] = useState(null);
    const hasDraggedRef = useRef(false);
    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startY = e.clientY;
        hasDraggedRef.current = false;
        function onMouseMove(ev) {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            if (!hasDraggedRef.current && Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD)
                return;
            hasDraggedRef.current = true;
            setDragging(true);
            setDragPos({ x: ev.clientX - 20, y: ev.clientY - 20 });
        }
        function onMouseUp(ev) {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            if (hasDraggedRef.current) {
                const newCorner = getNearestCorner(ev.clientX, ev.clientY);
                setCorner(newCorner);
                localStorage.setItem(STORAGE_KEY, newCorner);
            }
            else {
                window.open("https://github.com/mengxi-ream/read-frog/issues?q=sort%3Aupdated-desc+is%3Aissue+is%3Aopen", "_blank");
            }
            hasDraggedRef.current = false;
            setDragging(false);
            setDragPos(null);
        }
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    }, []);
    const style = dragging && dragPos
        ? { position: "fixed", left: dragPos.x, top: dragPos.y, right: "auto", bottom: "auto", transition: "none" }
        : { position: "fixed", ...cornerStyles[corner], transition: "all 300ms ease" };
    return (_jsx("button", { type: "button", onMouseDown: handleMouseDown, className: cn("z-50 flex size-10 cursor-grab items-center justify-center rounded-full", "bg-muted-foreground/20 text-muted-foreground shadow-md", "opacity-60 hover:opacity-100", dragging && "cursor-grabbing opacity-100"), style: style, children: _jsx(Icon, { icon: "tabler:message-2", className: "size-5" }) }));
}
