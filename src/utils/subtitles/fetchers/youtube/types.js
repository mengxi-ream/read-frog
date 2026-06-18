import { z } from "zod";
export const youtubeTimedTextSegSchema = z.object({
    utf8: z.string(),
    tOffsetMs: z.number().optional(),
});
export const youtubeTimedTextSchema = z.object({
    tStartMs: z.number(),
    dDurationMs: z.number().optional(),
    aAppend: z.number().optional(),
    segs: z.array(youtubeTimedTextSegSchema).optional(),
    wpWinPosId: z.number().optional(),
    wWinId: z.number().optional(),
});
export const youtubeSubtitlesResponseSchema = z.object({
    events: z.array(youtubeTimedTextSchema),
});
export const knownHttpErrorStatusSchema = z.union([
    z.literal(429),
    z.literal(404),
    z.literal(403),
    z.literal(500),
]);
