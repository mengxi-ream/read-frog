import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from "@/utils/styles/utils";
export default function LoadingDots({ className }) {
    return (_jsx("div", { className: cn("flex items-center justify-center gap-[3px]", className), children: Array.from(Array.from({ length: 3 }), (_, i) => (_jsx("div", { className: "h-1.5 w-1 animate-bounce rounded-full bg-black dark:bg-white", style: {
                animationDelay: `${i * 0.2}s`,
            } }, i))) }));
}
