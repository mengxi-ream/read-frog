import type { Config } from '@/types/config/config'
import type { ConfigValueAndMeta } from '@/types/config/meta'
import { migrateConfig } from '../config/migration'
import { CONFIG_SCHEMA_VERSION } from '../constants/config'
import { logger } from '../logger'
import { downloadFile, findFileInAppData, uploadFile } from './api'
import { getGoogleUserInfo, getValidAccessToken } from './auth'
import { GOOGLE_DRIVE_CONFIG_FILENAME } from './constants'

export async function getRemoteConfigAndMetaWithUserEmail(): Promise<{
  configValueAndMeta: ConfigValueAndMeta | null
  email: string
}> {
  try {
    const accessToken = await getValidAccessToken()

    // Fetch user email from Google API
    const userInfo = await getGoogleUserInfo(accessToken)

    const file = await findFileInAppData(GOOGLE_DRIVE_CONFIG_FILENAME)

    if (!file) {
      return { configValueAndMeta: null, email: userInfo.email }
    }

    const content = await downloadFile(file.id)
    const remoteData = JSON.parse(content) as ConfigValueAndMeta

    let migratedConfig: Config
    try {
      migratedConfig = await migrateConfig(remoteData.value, remoteData.meta.schemaVersion)
    }
    catch (error) {
      logger.error('Failed to migrate remote config', error)
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
  }
  catch (error) {
    logger.error('Failed to get remote config', error)
    throw error
  }
}

export async function setRemoteConfigAndMeta(
  configValueAndMeta: ConfigValueAndMeta,
): Promise<void> {
  try {
    const existingFile = await findFileInAppData(GOOGLE_DRIVE_CONFIG_FILENAME)

    const content = JSON.stringify(configValueAndMeta, null, 2)
    await uploadFile(GOOGLE_DRIVE_CONFIG_FILENAME, content, existingFile?.id)
  }
  catch (error) {
    logger.error('Failed to upload local config', error)
    throw error
  }
}
