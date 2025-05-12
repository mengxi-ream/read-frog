import { useAtom } from "jotai";

import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Select } from "@/components/ui/select";
import { configFields } from "@/utils/atoms/config";
import { PROVIDER_ITEMS } from "@/utils/constants/config";

export default function ProviderSelector() {
  const [provider, setProvider] = useAtom(configFields.provider);

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] font-medium">
        {i18n.t("translateService")}
      </span>
      <Select value={provider} onValueChange={setProvider}>
        <SelectTrigger className="bg-input/50 hover:bg-input !h-7 w-31 cursor-pointer pr-1.5 pl-2.5 outline-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(PROVIDER_ITEMS).map(([value, { logo, name }]) => (
            <SelectItem key={value} value={value}>
              <TranslateItem logo={logo} name={name} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const TranslateItem = ({ logo, name }: { logo: string; name: string }) => {
  return (
    <div className="flex items-center gap-1.5">
      <img
        src={logo}
        alt={name}
        className="border-border h-4 w-4 rounded-full border bg-white"
      />
      {name}
    </div>
  );
};
