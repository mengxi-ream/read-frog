export function migrate(oldConfig: any): any {
  const migratedConfig = { ...oldConfig }

  // Migrate Gemini models from 1.5 to 2.5
  if (migratedConfig.providersConfig) {
    migratedConfig.providersConfig = migratedConfig.providersConfig.map((provider: any) => {
      if (provider.provider === "gemini" && provider.models) {
        const migratedModels = { ...provider.models }

        // Migrate read model
        if (migratedModels.read) {
          const readModel = migratedModels.read.model
          if (readModel === "gemini-1.5-flash") {
            migratedModels.read = {
              ...migratedModels.read,
              model: "gemini-2.5-flash",
            }
          }
          else if (readModel === "gemini-1.5-pro") {
            migratedModels.read = {
              ...migratedModels.read,
              model: "gemini-2.5-pro",
            }
          }
        }

        // Migrate translate model
        if (migratedModels.translate) {
          const translateModel = migratedModels.translate.model
          if (translateModel === "gemini-1.5-flash") {
            migratedModels.translate = {
              ...migratedModels.translate,
              model: "gemini-2.5-flash",
            }
          }
          else if (translateModel === "gemini-1.5-pro") {
            migratedModels.translate = {
              ...migratedModels.translate,
              model: "gemini-2.5-pro",
            }
          }
        }

        return {
          ...provider,
          models: migratedModels,
        }
      }
      return provider
    })
  }

  return migratedConfig
}
