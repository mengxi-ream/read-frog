import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app.tsx";
import "@/assets/tailwind/theme.css";
import "@/assets/tailwind/text-small.css";
import { Provider as JotaiProvider } from "jotai";
import { configAtom } from "@/utils/atoms/config";
import { useHydrateAtoms } from "jotai/utils";
import { Config } from "@/types/config/config";
import { DEFAULT_CONFIG } from "@/utils/constants/config.ts";

document.documentElement.classList.toggle(
  "dark",
  localStorage.theme === "dark" ||
    (!("theme" in localStorage) &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
);

const root = document.getElementById("root")!;
root.className = "text-base antialiased w-[320px] bg-background";
const config = await storage.getItem<Config>("local:config");

const HydrateAtoms = ({
  initialValues,
  children,
}: {
  initialValues: [[typeof configAtom, Config]];
  children: React.ReactNode;
}) => {
  useHydrateAtoms(initialValues);
  return children;
};

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <JotaiProvider>
      <HydrateAtoms initialValues={[[configAtom, config ?? DEFAULT_CONFIG]]}>
        <App />
      </HydrateAtoms>
    </JotaiProvider>
  </React.StrictMode>
);
