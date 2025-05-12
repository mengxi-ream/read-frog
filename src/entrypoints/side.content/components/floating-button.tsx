import { useAtom, useAtomValue } from "jotai";
import { Bolt, X } from "lucide-react";

import readFrogLogo from "@/assets/icon/read-frog.png";
import { configFields } from "@/utils/atoms/config";
import { APP_NAME } from "@/utils/constants/app";

import { isSideOpenAtom } from "../atoms";

export default function FloatingButton() {
  const [floatingButton, setFloatingButton] = useAtom(
    configFields.floatingButton,
  );
  const sideContent = useAtomValue(configFields.sideContent);
  const [isSideOpen, setIsSideOpen] = useAtom(isSideOpenAtom);
  const [isDraggingButton, setIsDraggingButton] = useState(false);
  // clientY is the top of the icon button
  const [initialClientY, setInitialClientY] = useState<number | null>(null);

  // 按钮拖动处理
  useEffect(() => {
    if (!isDraggingButton || !initialClientY || !floatingButton) return;

    const handleMouseMove = (e: MouseEvent) => {
      const initialY = floatingButton.position * window.innerHeight;
      const newY = Math.max(
        30,
        Math.min(
          window.innerHeight - 100,
          initialY + e.clientY - initialClientY,
        ),
      );
      const newPosition = newY / window.innerHeight;
      setFloatingButton({ position: newPosition });
    };

    const handleMouseUp = () => {
      setIsDraggingButton(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
    };
  }, [isDraggingButton, initialClientY]);

  const handleButtonDragStart = (e: React.MouseEvent) => {
    // 记录初始位置，用于后续判断是点击还是拖动
    setInitialClientY(e.clientY);
    let hasMoved = false; // 标记是否发生了移动

    e.preventDefault();
    setIsDraggingButton(true);

    // 创建一个监听器检测移动
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const moveDistance = Math.abs(moveEvent.clientY - e.clientY);
      // 如果移动距离大于阈值，标记为已移动
      if (moveDistance > 5) {
        hasMoved = true;
      }
    };

    document.addEventListener("mousemove", handleMouseMove);

    // 在鼠标释放时，只有未移动才触发点击事件
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      // 只有未移动过才触发点击
      if (!hasMoved) {
        setIsSideOpen((o) => !o);
      }
    };

    document.addEventListener("mouseup", handleMouseUp, { once: true });

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  };

  return (
    floatingButton.enabled && (
      <div
        className="group fixed z-[2147483647] flex flex-col items-end gap-2"
        style={{
          right: isSideOpen
            ? `calc(${sideContent.width}px + var(--removed-body-scroll-bar-size, 0px))`
            : "var(--removed-body-scroll-bar-size, 0px)",
          top: `${floatingButton.position * 100}vh`,
        }}
      >
        <div
          title="Close floating button"
          className="mr-1 translate-x-6 cursor-pointer rounded-full bg-neutral-100 p-0.5 transition-transform duration-300 group-hover:translate-x-0 dark:bg-neutral-900"
          onClick={() => setFloatingButton({ enabled: false })}
        >
          <X className="h-3 w-3 text-neutral-400 dark:text-neutral-600" />
        </div>
        <div
          className={cn(
            "border-border flex h-10 w-15 items-center rounded-l-full border border-r-0 bg-white opacity-60 shadow-lg group-hover:opacity-100 dark:bg-neutral-900",
            "translate-x-5 transition-transform duration-300 group-hover:translate-x-0",
            isSideOpen && "opacity-100",
            isDraggingButton ? "cursor-move" : "cursor-pointer",
          )}
          onMouseDown={handleButtonDragStart}
        >
          <img
            src={readFrogLogo}
            alt={APP_NAME}
            className="ml-[5px] h-8 w-8 rounded-full"
          />
          <div className="absolute inset-0 opacity-0"></div>
        </div>
        <div
          className="border-border mr-2 translate-x-12 cursor-pointer rounded-full border bg-white p-1.5 text-neutral-600 transition-transform duration-300 group-hover:translate-x-0 hover:bg-neutral-100 dark:bg-neutral-900 dark:hover:bg-neutral-800"
          onClick={() => {
            browser.runtime.sendMessage({ action: "openOptionsPage" });
          }}
        >
          <Bolt className="h-5 w-5" strokeWidth={1.8} />
        </div>
      </div>
    )
  );
}
