import ReactDOM from "react-dom/client";
import App from "./app";
import "@/assets/tailwind/theme.css";
import "@/assets/tailwind/text-small.css";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { Provider as JotaiProvider } from "jotai/react";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { store } from "./atoms";
import { mirrorDynamicStyles, addStyleToShadow } from "./utils/styles";
import { toast } from "sonner";
import { APP_NAME } from "@/utils/constants/app";
import { kebabCase } from "case-anything";
import { TooltipProvider } from "@/components/ui/Tooltip";
export let shadowWrapper: HTMLElement | null = null;

export default defineContentScript({
  matches: ["*://*/*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: kebabCase(APP_NAME),
      position: "overlay",
      anchor: "body",
      append: "last",
      onMount: (container, shadow) => {
        // Store shadow root reference
        const wrapper = document.createElement("div");
        wrapper.className = cn(
          "text-base antialiased font-sans z-[2147483647]",
          isDarkMode() && "dark"
        );
        shadowWrapper = wrapper;
        container.appendChild(wrapper);

        const root = ReactDOM.createRoot(wrapper);

        addStyleToShadow(shadow);
        mirrorDynamicStyles("#_goober", shadow);
        // mirrorDynamicStyles(
        //   "style[type='text/css']",
        //   shadow,
        //   ".with-scroll-bars-hidden22"
        // );

        const queryClient = new QueryClient({
          queryCache: new QueryCache({
            onError: (error, query) => {
              const errorDescription =
                query.meta?.errorDescription || "Something went wrong";
              toast.error(`${errorDescription}: ${error.message}`);
            },
          }),
          mutationCache: new MutationCache({
            onError: (error, _variables, _context, mutation) => {
              const errorDescription =
                mutation.meta?.errorDescription || "Something went wrong";
              toast.error(`${errorDescription}: ${error.message}`);
            },
          }),
        });

        root.render(
          <QueryClientProvider client={queryClient}>
            <JotaiProvider store={store}>
                <TooltipProvider>
                  <App />
                </TooltipProvider>
            </JotaiProvider>
            <ReactQueryDevtools
              initialIsOpen={false}
              buttonPosition="bottom-left"
            />
          </QueryClientProvider>
        );
        return { root, wrapper };
      },
      onRemove: (elements) => {
        elements?.root.unmount();
        elements?.wrapper.remove();
        shadowWrapper = null;
      },
    });

    ui.mount();
  },
});
