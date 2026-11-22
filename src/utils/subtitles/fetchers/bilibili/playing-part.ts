import { z } from "zod"
import {
  BILIBILI_PLAYING_PART_REQUEST_TYPE,
  BILIBILI_PLAYING_PART_RESPONSE_TYPE,
  BILIBILI_PLAYING_PART_TIMEOUT_MS,
} from "@/utils/constants/subtitles"
import { postMessageRequest } from "../post-message-request"

const playingPartSchema = z.object({ bvid: z.string(), cid: z.number(), p: z.number() })
export type BilibiliPlayingPart = z.infer<typeof playingPartSchema>

const playingPartResponseSchema = z.object({
  type: z.string(),
  requestId: z.string(),
  part: playingPartSchema.nullable(),
})
export type BilibiliPlayingPartResponse = z.infer<typeof playingPartResponseSchema>

/** The part `partId` names, once the player plays it; null if it never does. */
export async function requestBilibiliPlayingPart(
  partId: string,
): Promise<BilibiliPlayingPart | null> {
  const response = await postMessageRequest(
    BILIBILI_PLAYING_PART_RESPONSE_TYPE,
    { type: BILIBILI_PLAYING_PART_REQUEST_TYPE, partId },
    BILIBILI_PLAYING_PART_TIMEOUT_MS,
  )
  return playingPartResponseSchema.safeParse(response).data?.part ?? null
}
