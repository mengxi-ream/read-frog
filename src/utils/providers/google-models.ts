import { z } from "zod"
import { extractErrorMessage } from "@/utils/error/extract-message"

const googleModelSchema = z.object({
  name: z.string(),
  supportedGenerationMethods: z.array(z.string()).default([]),
})

const googleModelsResponseSchema = z.object({
  models: z.array(googleModelSchema).default([]),
  nextPageToken: z.string().optional(),
})

const modelIdCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "variant",
})

interface FetchGoogleTextModelsOptions {
  baseURL: string
  apiKey: string
  signal?: AbortSignal
}

function toModelId(name: string): string {
  return name.replace(/^models\//, "")
}

function supportsGenerateContent(
  name: string,
  supportedGenerationMethods: readonly string[],
): boolean {
  const modelId = toModelId(name)

  return modelId.startsWith("gemini-") && supportedGenerationMethods.includes("generateContent")
}

export async function fetchGoogleModels({
  baseURL,
  apiKey,
  signal,
}: FetchGoogleTextModelsOptions): Promise<string[]> {
  const modelIds = new Set<string>()
  let pageToken: string | undefined

  do {
    const url = new URL(`${baseURL.replace(/\/+$/, "")}/models`)
    url.searchParams.set("pageSize", "1000")

    if (pageToken) {
      url.searchParams.set("pageToken", pageToken)
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-goog-api-key": apiKey,
      },
      signal,
    })

    if (!response.ok) {
      const message = await extractErrorMessage(response)
      throw new Error(`Failed to fetch Google models: ${message}`)
    }

    const page = googleModelsResponseSchema.parse(await response.json())

    for (const model of page.models) {
      if (supportsGenerateContent(model.name, model.supportedGenerationMethods)) {
        modelIds.add(toModelId(model.name))
      }
    }

    pageToken = page.nextPageToken
  } while (pageToken)

  return [...modelIds].sort((left, right) => modelIdCollator.compare(right, left))
}
