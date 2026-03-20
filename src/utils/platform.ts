export const isFirefoxAndroidBuild
  = import.meta.env.BROWSER === "firefox"
    && import.meta.env.WXT_FIREFOX_ANDROID === "true"

export const supportsContextMenu = !isFirefoxAndroidBuild
export const supportsGoogleDriveSync = !isFirefoxAndroidBuild
