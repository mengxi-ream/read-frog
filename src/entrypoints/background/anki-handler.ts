// Background script handler for Anki requests to bypass CORS
import { onMessage } from '@/utils/message'

export function setupAnkiHandler() {
  // 使用 WXT 的 onMessage 系统
  onMessage('ANKI_REQUEST', async (message) => {
    try {
      const { url, request } = message.data
      const result = await handleAnkiRequest(url, request)
      return { success: true, result }
    }
    catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })
}

async function handleAnkiRequest(url: string, request: any): Promise<any> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()

    if (result.error) {
      throw new Error(`AnkiConnect error: ${result.error}`)
    }

    return result
  }
  catch (error) {
    throw new Error(`Failed to connect to AnkiConnect: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
