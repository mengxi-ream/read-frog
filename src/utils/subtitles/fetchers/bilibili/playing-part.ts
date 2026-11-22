import { z } from "zod"
import {
  BILIBILI_PLAYING_PART_REQUEST_TYPE,
  BILIBILI_PLAYING_PART_RESPONSE_TYPE,
  BILIBILI_POST_MESSAGE_TIMEOUT_MS,
} from "@/utils/constants/subtitles"
import { postMessageRequest } from "../post-message-request"

const playingPartSchema = z.object({ bvid: z.string(), cid: z.number() })
export type BilibiliPlayingPart = z.infer<typeof playingPartSchema>

const playingPartResponseSchema = z.object({
  type: z.string(),
  requestId: z.string(),
  part: playingPartSchema.nullable(),
})
export type BilibiliPlayingPartResponse = z.infer<typeof playingPartResponseSchema>

// A part's cid never changes, so a part the player once confirmed is not asked about again.
let confirmed: { partId: string; part: BilibiliPlayingPart } | null = null

/** The BV id and cid of the part `partId` names, once the player plays it; null if it never does. */
export async function requestBilibiliPlayingPart(
  partId: string,
): Promise<BilibiliPlayingPart | null> {
  if (confirmed?.partId === partId) return confirmed.part
  const response = await postMessageRequest(
    BILIBILI_PLAYING_PART_RESPONSE_TYPE,
    { type: BILIBILI_PLAYING_PART_REQUEST_TYPE, partId },
    BILIBILI_POST_MESSAGE_TIMEOUT_MS,
  )
  const part = playingPartResponseSchema.safeParse(response).data?.part ?? null
  if (part) confirmed = { partId, part }
  return part
}
