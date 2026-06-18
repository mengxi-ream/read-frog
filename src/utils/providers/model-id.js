export function resolveModelId(providerModel) {
    return providerModel.isCustomModel
        ? providerModel.customModel?.trim()
        : providerModel.model?.trim();
}
