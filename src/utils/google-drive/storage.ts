import type { Config } from "@/types/config/config"
import type { ConfigValueAndMeta } from "@/types/config/meta"
import { ConfigVersionTooNewError } from "../config/errors"
import { migrateConfig } from "../config/migration"
import { CONFIG_SCHEMA_VERSION } from "../constants/config"
import { logger } from "../logger"
import { downloadFile, findFileInAppData, uploadFile } from "./api"
import { getGoogleUserInfo, getValidAccessToken } from "./auth"
import { GOOGLE_DRIVE_CONFIG_FILENAME } from "./constants"

/**
 * `token` binds every request here to one account. Resolving it per helper
 * instead lets another tab switch accounts mid-sync, which can put the config
 * in one Drive and the glossary in another under a single click.
 */
export async function getRemoteConfigAndMetaWithUserEmail(token?: string): Promise<{
  configValueAndMeta: ConfigValueAndMeta | null
  email: string
}> {
  try {
    const accessToken = token ?? (await getValidAccessToken())

    // Fetch user email from Google API
    const userInfo = await getGoogleUserInfo(accessToken)

    const file = await findFileInAppData(GOOGLE_DRIVE_CONFIG_FILENAME, accessToken)

    if (!file) {
      return { configValueAndMeta: null, email: userInfo.email }
    }

    const content = await downloadFile(file.id, accessToken)
    const remoteData = JSON.parse(content) as ConfigValueAndMeta

    let migratedConfig: Config
    try {
      migratedConfig = await migrateConfig(remoteData.value, remoteData.meta.schemaVersion)
    } catch (error) {
      if (error instanceof ConfigVersionTooNewError) {
        throw error
      }
      logger.error("Failed to migrate remote config", error)
      return { configValueAndMeta: null, email: userInfo.email }
    }

    return {
      configValueAndMeta: {
        value: migratedConfig,
        meta: {
          schemaVersion: CONFIG_SCHEMA_VERSION,
          lastModifiedAt: remoteData.meta.lastModifiedAt,
        },
      },
      email: userInfo.email,
    }
  } catch (error) {
    logger.error("Failed to get remote config", error)
    throw error
  }
}

export async function setRemoteConfigAndMeta(
  configValueAndMeta: ConfigValueAndMeta,
  token?: string,
): Promise<void> {
  try {
    const existingFile = await findFileInAppData(GOOGLE_DRIVE_CONFIG_FILENAME, token)

    const content = JSON.stringify(configValueAndMeta, null, 2)
    await uploadFile(GOOGLE_DRIVE_CONFIG_FILENAME, content, existingFile?.id, token)
  } catch (error) {
    logger.error("Failed to upload local config", error)
    throw error
  }
}
