import { saveAs } from "file-saver";
const INVALID_FILENAME_CHARS_PATTERN = /[<>:"/\\|?*]/g;
const TRAILING_FILENAME_CHARS_PATTERN = /[. ]+$/g;
const LINE_BREAK_PATTERN = /\r?\n/;
const WHITESPACE_PATTERN = /\s+/g;
const MAX_FILENAME_LENGTH = 80;
function pad(value, size) {
    return String(value).padStart(size, "0");
}
function sanitizeFilenamePart(value) {
    return value
        .split("")
        .filter(char => char >= " ")
        .join("")
        .replace(INVALID_FILENAME_CHARS_PATTERN, " ")
        .replace(WHITESPACE_PATTERN, " ")
        .trim()
        .replace(TRAILING_FILENAME_CHARS_PATTERN, "")
        .slice(0, MAX_FILENAME_LENGTH);
}
export function formatSrtTimestamp(timeMs) {
    const safeTimeMs = Math.max(0, Math.floor(timeMs));
    const hours = Math.floor(safeTimeMs / 3_600_000);
    const minutes = Math.floor((safeTimeMs % 3_600_000) / 60_000);
    const seconds = Math.floor((safeTimeMs % 60_000) / 1000);
    const milliseconds = safeTimeMs % 1000;
    return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(milliseconds, 3)}`;
}
function normalizeSubtitleText(text) {
    return text
        .split(LINE_BREAK_PATTERN)
        .map(line => line.trim())
        .filter(Boolean)
        .join("\n");
}
function normalizeSubtitleFragment(fragment) {
    const text = normalizeSubtitleText(fragment.text);
    if (!text) {
        return null;
    }
    const start = Math.max(0, Math.floor(fragment.start));
    const end = Math.max(start + 1, Math.floor(fragment.end));
    return {
        ...fragment,
        text,
        start,
        end,
    };
}
export function buildSubtitlesSrtContent(subtitles) {
    return subtitles
        .map(normalizeSubtitleFragment)
        .filter((fragment) => fragment !== null)
        .map((fragment, index) => {
        return [
            String(index + 1),
            `${formatSrtTimestamp(fragment.start)} --> ${formatSrtTimestamp(fragment.end)}`,
            fragment.text,
        ].join("\n");
    })
        .join("\n\n");
}
export function buildSubtitlesSrtFilename({ pageTitle, videoId, suffix, }) {
    const safeTitle = sanitizeFilenamePart(pageTitle);
    const safeVideoId = sanitizeFilenamePart(videoId ?? "");
    const safeSuffix = sanitizeFilenamePart(suffix ?? "");
    const baseName = [safeTitle || "video-subtitles", safeVideoId, safeSuffix].filter(Boolean).join("-");
    return `${baseName}.srt`;
}
export async function downloadSubtitlesAsSrt({ subtitles, pageTitle, videoId, suffix, }) {
    const srt = buildSubtitlesSrtContent(subtitles);
    const blob = new Blob([srt], { type: "application/x-subrip;charset=utf-8" });
    const filename = buildSubtitlesSrtFilename({ pageTitle, videoId, suffix });
    saveAs(blob, filename);
}
