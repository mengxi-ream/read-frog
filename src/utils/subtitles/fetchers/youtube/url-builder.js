const DEVICE_PARAM_KEYS = [
    "cbrand",
    "cbr",
    "cbrver",
    "cos",
    "cosver",
    "cplatform",
];
const FIXED_PARAMS = {
    fmt: "json3",
    xorb: "2",
    xobt: "3",
    xovt: "3",
    c: "WEB",
    cplayer: "UNIPLAYER",
};
export function buildSubtitleUrl(track, playerData, potToken) {
    const url = new URL(track.baseUrl);
    Object.entries(FIXED_PARAMS).forEach(([key, value]) => {
        url.searchParams.set(key, value);
    });
    if (playerData.device) {
        const deviceParams = new URLSearchParams(playerData.device);
        DEVICE_PARAM_KEYS.forEach((key) => {
            const value = deviceParams.get(key);
            if (value) {
                url.searchParams.set(key, value);
            }
        });
    }
    if (playerData.cver) {
        url.searchParams.set("cver", playerData.cver);
    }
    if (potToken.pot) {
        url.searchParams.set("pot", potToken.pot);
    }
    if (potToken.potc) {
        url.searchParams.set("potc", potToken.potc);
    }
    return url.toString();
}
