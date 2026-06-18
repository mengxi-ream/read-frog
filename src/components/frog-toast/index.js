import { jsx as _jsx } from "react/jsx-runtime";
import { kebabCase } from "case-anything";
import { Toaster } from "sonner";
import { browser } from "#imports";
import frogIcon from "@/assets/icons/read-frog.png?url&no-inline";
import { APP_NAME } from "@/utils/constants/app";
const frogIconUrl = new URL(frogIcon, browser.runtime.getURL("/")).href;
const frogIconElement = (_jsx("img", { src: frogIconUrl, alt: "\uD83D\uDC38", style: {
        maxWidth: "100%",
        height: "auto",
        minHeight: "20px",
        minWidth: "20px",
    } }));
function FrogToast({ position = "bottom-left", toastOptions, ...props }) {
    return (_jsx(Toaster, { ...props, position: position, richColors: true, icons: {
            warning: frogIconElement,
            success: frogIconElement,
            error: frogIconElement,
            info: frogIconElement,
            loading: frogIconElement,
        }, toastOptions: {
            ...toastOptions,
            className: [`${kebabCase(APP_NAME)}-toaster`, toastOptions?.className].filter(Boolean).join(" "),
        }, className: "z-[2147483647] notranslate" }));
}
export default FrogToast;
