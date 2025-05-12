import { Bolt, Star } from "lucide-react";

import { version } from "../../../package.json";
import FloatingButton from "./components/floating-button";
import Hotkey from "./components/hotkey-selector";
import LanguageLevelSelector from "./components/language-level-selector";
import LanguageOptionsSelector from "./components/language-options-selector";
import ProviderSelector from "./components/provider-selector";
import QuickLinks from "./components/quick-links";

function App() {
  return (
    <>
      <div className="bg-background flex flex-col gap-4 px-6 pt-5 pb-4">
        <LanguageOptionsSelector />
        <ProviderSelector />
        <LanguageLevelSelector />
        {/* <Button>{i18n.t("popup.readForMe")}</Button> */}
        <Hotkey />
        <FloatingButton />
        <QuickLinks />
      </div>
      <div className="flex items-center justify-between bg-neutral-200 px-2 py-1 dark:bg-neutral-800">
        <button
          className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 hover:bg-neutral-300 dark:hover:bg-neutral-700"
          onClick={() => browser.runtime.openOptionsPage()}
        >
          <Bolt className="size-4" strokeWidth={1.6} />
          <span className="text-[13px] font-medium">
            {i18n.t("popup.setting")}
          </span>
        </button>
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          {version}
        </span>
        <button
          className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 hover:bg-neutral-300 dark:hover:bg-neutral-700"
          onClick={() =>
            window.open("https://github.com/mengxi-ream/read-frog", "_blank")
          }
        >
          <Star className="size-4" strokeWidth={1.6} />
          <span className="text-[13px] font-medium">Github</span>
        </button>
      </div>
    </>
  );
}

export default App;
