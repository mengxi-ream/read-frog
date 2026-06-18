export function extractPotToken(selectedTrack, playerData) {
    const { audioCaptionTracks, cachedTimedtextUrl } = playerData;
    if (audioCaptionTracks.length > 0) {
        let matchedTrack = audioCaptionTracks.find(t => t.vssId === selectedTrack.vssId);
        if (!matchedTrack) {
            matchedTrack = audioCaptionTracks.find(t => t.languageCode === selectedTrack.languageCode
                && t.kind === selectedTrack.kind);
        }
        if (!matchedTrack) {
            matchedTrack = audioCaptionTracks.find(t => t.languageCode === selectedTrack.languageCode);
        }
        if (!matchedTrack) {
            matchedTrack = audioCaptionTracks[0];
        }
        if (matchedTrack?.url) {
            const url = new URL(matchedTrack.url);
            const pot = url.searchParams.get("pot");
            const potc = url.searchParams.get("potc");
            if (pot) {
                return { pot, potc };
            }
        }
    }
    if (cachedTimedtextUrl) {
        const url = new URL(cachedTimedtextUrl);
        const pot = url.searchParams.get("pot");
        const potc = url.searchParams.get("potc");
        if (pot) {
            return { pot, potc };
        }
    }
    return { pot: null, potc: null };
}
