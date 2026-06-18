/**
 * Edge TTS 类型定义
 */
import { z } from "zod";
export const edgeTTSConfigSchema = z.object({
    voice: z.string(),
    rate: z.string().optional().default("+0%"),
    pitch: z.string().optional().default("+0Hz"),
    volume: z.string().optional().default("+0%"),
});
