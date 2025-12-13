/**
 * Extract error message from API response
 * Handles various error formats: JSON string, { error: { message } }, { message }, plain text
 */
export async function extractErrorMessage(response: Response): Promise<string> {
  const fallback = `${response.status} ${response.statusText}`
  const text = await response.text()

  if (!text)
    return fallback

  try {
    const json = JSON.parse(text)
    if (typeof json === 'string')
      return json
    if (json.error?.message)
      return json.error.message
    if (json.message)
      return json.message
    return fallback
  }
  catch {
    return text.slice(0, 100)
  }
}
