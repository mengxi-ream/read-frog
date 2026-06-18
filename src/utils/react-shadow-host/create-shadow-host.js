import { jsx as _jsx } from "react/jsx-runtime";
import { createContext } from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/base-ui/tooltip";
import { REACT_SHADOW_HOST_CLASS } from "../constants/dom-labels";
import { ShadowHostBuilder } from "./shadow-host-builder";
export const ShadowWrapperContext = createContext(null);
export function createReactShadowHost(component, options) {
    const { className, position, inheritStyles, cssContent, style } = options;
    const shadowHost = document.createElement("div");
    if (className)
        shadowHost.className = className;
    shadowHost.classList.add(REACT_SHADOW_HOST_CLASS);
    shadowHost.style.display = position;
    const shadowRoot = shadowHost.attachShadow({ mode: "open" });
    const hostBuilder = new ShadowHostBuilder(shadowRoot, {
        position,
        cssContent,
        style,
        inheritStyles,
    });
    const innerReactContainer = hostBuilder.build();
    const root = ReactDOM.createRoot(innerReactContainer);
    const wrappedComponent = (_jsx(ShadowWrapperContext, { value: innerReactContainer, children: _jsx(ThemeProvider, { container: innerReactContainer, children: _jsx(TooltipProvider, { children: component }) }) }));
    root.render(wrappedComponent);
    shadowHost.__reactShadowContainerCleanup = () => {
        root.unmount();
        hostBuilder.cleanup();
    };
    return shadowHost;
}
export function removeReactShadowHost(shadowHost) {
    if (!shadowHost.__reactShadowContainerCleaned) {
        ;
        shadowHost.__reactShadowContainerCleanup?.();
        shadowHost.__reactShadowContainerCleaned = true;
    }
    shadowHost.remove();
}
