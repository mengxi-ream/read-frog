import { logger } from '../logger'
import { clearAccessToken, getValidAccessToken } from './auth'

const GOOGLE_DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'
const GOOGLE_DRIVE_UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3'

export interface GoogleDriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  size?: string
}

export interface GoogleDriveFileListResponse {
  files: GoogleDriveFile[]
  nextPageToken?: string
}

/**
 * Search for file in Google Drive appDataFolder
 */
export async function findFileInAppData(fileName: string): Promise<GoogleDriveFile | null> {
  try {
    const accessToken = await getValidAccessToken()

    const url = new URL(`${GOOGLE_DRIVE_API_BASE}/files`)
    url.searchParams.set('spaces', 'appDataFolder')
    url.searchParams.set('q', `name='${fileName}'`)
    url.searchParams.set('fields', 'files(id, name, mimeType, modifiedTime, size)')

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        await clearAccessToken()
      }
      throw new Error(`Failed to search file: ${response.statusText}`)
    }

    const data = await response.json() as GoogleDriveFileListResponse

    return data.files.length > 0 ? data.files[0] : null
  }
  catch (error) {
    logger.error('Failed to find file in appData', error)
    throw error
  }
}

export async function downloadFile(fileId: string): Promise<string> {
  try {
    const accessToken = await getValidAccessToken()

    const url = `${GOOGLE_DRIVE_API_BASE}/files/${fileId}?alt=media`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        await clearAccessToken()
      }
      throw new Error(`Failed to download file: ${response.statusText}`)
    }

    return await response.text()
  }
  catch (error) {
    logger.error('Failed to download file', error)
    throw error
  }
}

/**
 * Upload or update file in Google Drive appDataFolder
 */
export async function uploadFile(
  fileName: string,
  content: string,
  fileId?: string,
): Promise<GoogleDriveFile> {
  try {
    const accessToken = await getValidAccessToken()

    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      ...(!fileId && { parents: ['appDataFolder'] }),
    }

    const boundary = '-------314159265358979323846'
    const delimiter = `\r\n--${boundary}\r\n`
    const closeDelimiter = `\r\n--${boundary}--`

    const multipartRequestBody
      = `${delimiter}Content-Type: application/json\r\n\r\n${
        JSON.stringify(metadata)
      }${delimiter}Content-Type: application/json\r\n\r\n${
        content
      }${closeDelimiter}`

    const method = fileId ? 'PATCH' : 'POST'
    const url = fileId
      ? `${GOOGLE_DRIVE_UPLOAD_API_BASE}/files/${fileId}?uploadType=multipart&fields=id,name,mimeType,modifiedTime,size`
      : `${GOOGLE_DRIVE_UPLOAD_API_BASE}/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,size`

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    })

    if (!response.ok) {
      if (response.status === 401) {
        await clearAccessToken()
      }
      const errorText = await response.text()
      throw new Error(`Failed to upload file: ${response.statusText}, ${errorText}`)
    }

    return await response.json() as GoogleDriveFile
  }
  catch (error) {
    logger.error('Failed to upload file', error)
    throw error
  }
}

export async function deleteFile(fileId: string): Promise<void> {
  try {
    const accessToken = await getValidAccessToken()

    const url = `${GOOGLE_DRIVE_API_BASE}/files/${fileId}`

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        await clearAccessToken()
      }
      throw new Error(`Failed to delete file: ${response.statusText}`)
    }
  }
  catch (error) {
    logger.error('Failed to delete file', error)
    throw error
  }
}
