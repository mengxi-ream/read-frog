import { useAtom, useAtomValue } from "jotai";
import { isSideOpenAtom } from "../../atoms";
import { MIN_SIDE_CONTENT_WIDTH } from "../../../../utils/constants/side";
import { Toaster } from "sonner";
import { TopBar } from "./top-bar";
import { Metadata } from "./metadata";
import { APP_NAME } from "@/utils/constants/app";
import { kebabCase } from "case-anything";
import { configFields } from "@/utils/atoms/config";
import Content from "./content";

export default function SideContent() {
  const isSideOpen = useAtomValue(isSideOpenAtom);
  const [sideContent, setSideContent] = useAtom(configFields.sideContent);
  const [isResizing, setIsResizing] = useState(false);

  // Setup resize handlers
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const windowWidth = window.innerWidth;
      const newWidth = windowWidth - e.clientX;
      const clampedWidth = Math.max(MIN_SIDE_CONTENT_WIDTH, newWidth);

      setSideContent({ width: clampedWidth });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  // HTML width adjustment
  useEffect(() => {
    const styleId = `shrink-origin-for-${kebabCase(APP_NAME)}-side-content`;
    let styleTag = document.getElementById(styleId);

    if (isSideOpen) {
      if (!styleTag) {
        styleTag = document.createElement("style");
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
      }
      styleTag.textContent = `
        html {
          width: calc(100% - ${sideContent.width}px) !important;
          position: relative !important;
          min-height: 100vh !important;
        }
      `;
    } else {
      if (styleTag) {
        document.head.removeChild(styleTag);
      }
    }

    return () => {
      if (styleTag && document.head.contains(styleTag)) {
        document.head.removeChild(styleTag);
      }
    };
  }, [isSideOpen, sideContent.width]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  return (
    <>
      <div
        className={cn(
          "fixed top-0 right-0 bg-background h-full z-[2147483647] pr-[var(--removed-body-scroll-bar-size,0px)]",
          isSideOpen
            ? "translate-x-0 border-l border-border"
            : "translate-x-full"
        )}
        style={{
          width: `calc(${sideContent.width}px + var(--removed-body-scroll-bar-size, 0px))`,
        }}
      >
        {/* Resize handle */}
        <div
          className="absolute left-0 top-0 w-2 h-full justify-center bg-transparent cursor-ew-resize z-10"
          onMouseDown={handleResizeStart}
        ></div>

        <div className="h-full flex flex-col gap-y-2 py-3">
          <TopBar className="mx-3" />
          <Metadata className="mx-3" />
          <Content />
        </div>
        <Toaster richColors className="z-[2147483647]" />
      </div>

      {/* Transparent overlay to prevent other events during resizing */}
      {isResizing && (
        <div className="fixed inset-0 bg-transparent z-[2147483647] cursor-ew-resize" />
      )}
    </>
  );
}
