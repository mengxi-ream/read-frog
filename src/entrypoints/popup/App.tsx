import { Bolt, Star } from "lucide-react";
import LanguageOptionsSelector from "./components/language-options-selector";
import LanguageLevelSelector from "./components/language-level-selector";
import FloatingButton from "./components/floating-button";
import ProviderSelector from "./components/provider-selector";
import { version } from "../../../package.json";
import Hotkey from "./components/hotkey-selector";

function App() {
  return (
    <>
      <div className="pt-5 px-6 pb-4 flex flex-col gap-4 bg-background">
        <LanguageOptionsSelector />
        <ProviderSelector />
        <LanguageLevelSelector />
        {/* <Button>{i18n.t("popup.readForMe")}</Button> */}
        <Hotkey />
        <FloatingButton />
      </div>
      <div className="py-1 flex items-center justify-between px-2 bg-neutral-200 dark:bg-neutral-800">
        <button
          className="flex items-center gap-1 cursor-pointer rounded-md px-2 py-1 hover:bg-neutral-300 dark:hover:bg-neutral-700"
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
          className="flex items-center gap-1 cursor-pointer rounded-md px-2 py-1 hover:bg-neutral-300 dark:hover:bg-neutral-700"
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
