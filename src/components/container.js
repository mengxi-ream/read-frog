import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from "@/utils/styles/utils";
function Container({ ref, className, children, ...props }) {
    return (_jsx("div", { ref: ref, className: cn("max-w-7xl mx-auto w-full px-6 md:px-8 lg:px-14", className), ...props, children: children }));
}
export default Container;
