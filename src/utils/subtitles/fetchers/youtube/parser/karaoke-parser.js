// YouTube uses wpWinPosId: 3 for the main kanji track in karaoke subtitles
const KANJI_TRACK_ID = 3;
const ZERO_WIDTH_SPACE_PATTERN = /\u200B/g;
const WHITESPACE_PATTERN = /\s+/g;
/**
 * Clean karaoke text: remove zero-width spaces and extra whitespace
 */
function cleanKaraokeText(text) {
    return text
        .replace(ZERO_WIDTH_SPACE_PATTERN, "")
        .replace(WHITESPACE_PATTERN, " ")
        .trim();
}
/**
 * Parse karaoke format subtitles
 * 1. Select main track (prefer kanji wpWinPosId: 3)
 * 2. Merge segs for each event
 * 3. Deduplicate adjacent identical text
 */
export function parseKaraokeSubtitles(events) {
    const posIds = new Set();
    for (const event of events) {
        if (event.wpWinPosId !== undefined) {
            posIds.add(event.wpWinPosId);
        }
    }
    const mainTrackId = posIds.has(KANJI_TRACK_ID) ? KANJI_TRACK_ID : Math.max(...posIds);
    const merged = [];
    for (const event of events) {
        if (event.wpWinPosId !== mainTrackId)
            continue;
        if (!event.segs || event.segs.length === 0)
            continue;
        const text = cleanKaraokeText(event.segs.map(seg => seg.utf8 || "").join(""));
        if (!text)
            continue;
        const last = merged.at(-1);
        if (last && last.end > event.tStartMs) {
            last.end = event.tStartMs;
        }
        merged.push({
            text,
            start: event.tStartMs,
            end: event.tStartMs + (event.dDurationMs ?? 0),
        });
    }
    const result = [];
    for (const fragment of merged) {
        const last = result.at(-1);
        if (last && last.text === fragment.text) {
            last.end = fragment.end;
        }
        else {
            result.push({ ...fragment });
        }
    }
    return result;
}
