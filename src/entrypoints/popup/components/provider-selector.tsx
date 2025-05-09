import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Select } from "@/components/ui/select";
import { configFields } from "@/utils/atoms/config";
import { PROVIDER_ITEMS } from "@/utils/constants/config";
import { useAtom } from "jotai";

export default function ProviderSelector() {
  const [provider, setProvider] = useAtom(configFields.provider);

  return (
    <div className="flex items-center gap-2 justify-between">
      <span className="font-medium text-[13px]">
        {i18n.t("translateService")}
      </span>
      <Select value={provider} onValueChange={setProvider}>
        <SelectTrigger className="outline-none cursor-pointer bg-input/50 hover:bg-input w-31 !h-7 pl-2.5 pr-1.5">
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
        className="w-4 h-4 rounded-full border border-border bg-white"
      />
      {name}
    </div>
  );
};
