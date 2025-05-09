import React from "react";
import ReactDOM from "react-dom/client";
import "@/assets/tailwind/theme.css";
import "./style.css";
import App from "./App";
import { Provider as JotaiProvider } from "jotai";
import { configAtom } from "@/utils/atoms/config";
import { DEFAULT_CONFIG } from "@/utils/constants/config";
import { useHydrateAtoms } from "jotai/utils";
import { Config } from "@/types/config/config";

document.documentElement.classList.toggle(
  "dark",
  localStorage.theme === "dark" ||
    (!("theme" in localStorage) &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
);

const root = document.getElementById("root")!;
root.className = "antialiased bg-background";

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
