import { useAtom } from "jotai";
import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Provider,
  providerModels,
  providerSchema,
} from "@/types/config/provider";
import { configFields } from "@/utils/atoms/config";
import { PROVIDER_ITEMS } from "@/utils/constants/config";

function App() {
  return (
    <div className="mx-auto my-10 flex min-h-[100vh] max-w-[320px] flex-col gap-12">
      {providerSchema.options.map((provider) => (
        <ProviderConfigSection key={provider} provider={provider} />
      ))}
    </div>
  );
}

const ProviderConfigSection = ({ provider }: { provider: Provider }) => {
  const [showAPIKey, setShowAPIKey] = useState(false);
  const [providersConfig, setProvidersConfig] = useAtom(
    configFields.providersConfig,
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-center gap-2">
        <img
          src={PROVIDER_ITEMS[provider].logo}
          alt={PROVIDER_ITEMS[provider].name}
          className="border-border h-6 w-6 rounded-full border bg-white"
        />
        <span className="font-medium">
          {PROVIDER_ITEMS[provider].name} Config
        </span>
      </div>
      <div className="text-sm font-medium">API Key</div>
      <Input
        className="mt-1 mb-2"
        value={providersConfig[provider].apiKey}
        type={showAPIKey ? "text" : "password"}
        onChange={(e) =>
          setProvidersConfig({
            ...providersConfig,
            [provider]: {
              ...providersConfig[provider],
              apiKey: e.target.value,
            },
          })
        }
      />
      <div className="flex items-center space-x-2">
        <Checkbox
          id={`apiKey-${provider}`}
          checked={showAPIKey}
          onCheckedChange={(checked) => setShowAPIKey(checked === true)}
        />
        <label
          htmlFor={`apiKey-${provider}`}
          className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Show API Key
        </label>
      </div>
      <div className="mt-4 text-sm font-medium">Model</div>
      {providersConfig[provider].isCustomModel ? (
        <Input
          className="mt-1 mb-2"
          value={providersConfig[provider].customModel}
          onChange={(e) =>
            setProvidersConfig({
              ...providersConfig,
              [provider]: {
                ...providersConfig[provider],
                customModel: e.target.value,
              },
            })
          }
        />
      ) : (
        <Select
          value={providersConfig[provider].model}
          onValueChange={(value) =>
            setProvidersConfig({
              ...providersConfig,
              [provider]: { ...providersConfig[provider], model: value },
            })
          }
        >
          <SelectTrigger className="mt-1 w-full">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {providerModels[provider].map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      )}
      <div className="mt-2 flex items-center space-x-2">
        <Checkbox
          id={`isCustomModel-${provider}`}
          checked={providersConfig[provider].isCustomModel}
          onCheckedChange={(checked) => {
            if (checked === false) {
              setProvidersConfig({
                ...providersConfig,
                [provider]: {
                  ...providersConfig[provider],
                  isCustomModel: false,
                },
              });
            } else {
              setProvidersConfig({
                ...providersConfig,
                [provider]: {
                  ...providersConfig[provider],
                  customModel: providersConfig[provider].model,
                  isCustomModel: true,
                },
              });
            }
          }}
        />
        <label
          htmlFor={`isCustomModel-${provider}`}
          className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Enter the name of the custom model
        </label>
      </div>
    </div>
  );
};

export default App;
