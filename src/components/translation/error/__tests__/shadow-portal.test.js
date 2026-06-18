import { jsx as _jsx } from "react/jsx-runtime";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/base-ui/tooltip";
import { configAtom } from "@/utils/atoms/config";
import { DEFAULT_CONFIG } from "@/utils/constants/config";
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host";
import { ErrorButton } from "../error-button";
import { RetryButton } from "../retry-button";
describe("translation error shadow portals", () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
        document.body.innerHTML = "";
    });
    function renderInShadow(ui) {
        const store = createStore();
        store.set(configAtom, DEFAULT_CONFIG);
        const shadowWrapper = document.createElement("div");
        shadowWrapper.id = "shadow-wrapper";
        document.body.appendChild(shadowWrapper);
        const result = render(_jsx(Provider, { store: store, children: _jsx(ShadowWrapperContext, { value: shadowWrapper, children: _jsx(TooltipProvider, { children: ui }) }) }));
        return { shadowWrapper, ...result };
    }
    it("mounts retry tooltip content inside the shadow wrapper", async () => {
        const { container, shadowWrapper } = renderInShadow(_jsx(RetryButton, { nodes: [] }));
        const trigger = container.querySelector("[data-slot='tooltip-trigger']");
        expect(trigger).toBeTruthy();
        fireEvent.mouseEnter(trigger);
        fireEvent.focus(trigger);
        await waitFor(() => {
            expect(shadowWrapper.querySelector("[data-slot='tooltip-content']")).toBeTruthy();
        });
        const tooltip = shadowWrapper.querySelector("[data-slot='tooltip-content']");
        expect(tooltip).toHaveTextContent("Retry translation");
        expect(shadowWrapper.contains(tooltip)).toBe(true);
    });
    it("mounts error hover card content inside the shadow wrapper", async () => {
        const error = {
            message: "Request failed",
            statusCode: 500,
        };
        const { container, shadowWrapper } = renderInShadow(_jsx(ErrorButton, { error: error }));
        const trigger = container.querySelector("[data-slot='hover-card-trigger']");
        expect(trigger).toBeTruthy();
        fireEvent.mouseEnter(trigger);
        await waitFor(() => {
            expect(shadowWrapper.querySelector("[data-slot='hover-card-content']")).toBeTruthy();
        });
        const hoverCard = shadowWrapper.querySelector("[data-slot='hover-card-content']");
        expect(hoverCard).toHaveTextContent("Translation Error");
        expect(hoverCard).toHaveTextContent("Request failed");
        expect(shadowWrapper.contains(hoverCard)).toBe(true);
    });
});
