const SURFACE_FNS: Record<string, (t: number) => number> = {
  convex_squircle: (t) => {
    const s = 1 - t
    return (1 - s * s * s * s) ** 0.25
  },
}

function calculateRefractionProfile(
  thickness: number,
  bezel: number,
  heightFn: (t: number) => number,
  ior: number,
  resolution: number,
): Float64Array {
  const profile = new Float64Array(resolution)
  for (let i = 0; i < resolution; i++) {
    const t = (i + 0.5) / resolution
    const h = heightFn(t)
    const dt = 0.001
    const h2 = heightFn(Math.min(t + dt, 1))
    const dh = (h2 - h) / dt
    const slopeAngle = Math.atan(dh * (thickness / bezel))
    const sinR = Math.sin(slopeAngle) / ior
    if (sinR >= 1) {
      profile[i] = 0
      continue
    }
    const thetaR = Math.asin(sinR)
    profile[i] = h * thickness * (Math.tan(slopeAngle) - Math.tan(thetaR))
  }
  return profile
}

function generateDisplacementMap(
  w: number, h: number,
  radius: number, bezelWidth: number,
  profile: Float64Array,
  maxDisp: number,
): string {
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx)
    return ""

  const img = ctx.createImageData(w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 128
    d[i + 1] = 128
    d[i + 2] = 0
    d[i + 3] = 255
  }

  const r = radius
  const rSq = r * r
  const r1Sq = (r + 1) ** 2
  const rBSq = Math.max(r - bezelWidth, 0) ** 2
  const wB = w - r * 2
  const hB = h - r * 2
  const S = profile.length

  for (let y1 = 0; y1 < h; y1++) {
    for (let x1 = 0; x1 < w; x1++) {
      const x = x1 < r ? x1 - r : x1 >= w - r ? x1 - r - wB : 0
      const y = y1 < r ? y1 - r : y1 >= h - r ? y1 - r - hB : 0
      const dSq = x * x + y * y
      if (dSq > r1Sq || dSq < rBSq)
        continue

      const dist = Math.sqrt(dSq)
      const fromSide = r - dist
      const op = dSq < rSq ? 1 : 1 - (dist - Math.sqrt(rSq)) / (Math.sqrt(r1Sq) - Math.sqrt(rSq))
      if (op <= 0 || dist === 0)
        continue

      const cos = x / dist
      const sin = -y / dist
      const bi = Math.min(((fromSide / bezelWidth) * S) | 0, S - 1)
      const disp = profile[bi] || 0
      const dX = (-cos * disp) / maxDisp
      const dY = (-sin * disp) / maxDisp

      const idx = (y1 * w + x1) * 4
      d[idx] = (128 + dX * 127 * op + 0.5) | 0
      d[idx + 1] = (128 + dY * 127 * op + 0.5) | 0
    }
  }

  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL()
}

function generateSpecularMap(
  w: number, h: number,
  radius: number, bezelWidth: number,
  angle: number,
): string {
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx)
    return ""

  const img = ctx.createImageData(w, h)
  const d = img.data
  d.fill(0)

  const r = radius
  const rSq = r * r
  const r1Sq = (r + 1) ** 2
  const rBSq = Math.max(r - bezelWidth, 0) ** 2
  const wB = w - r * 2
  const hB = h - r * 2
  const sv: [number, number] = [Math.cos(angle), Math.sin(angle)]

  for (let y1 = 0; y1 < h; y1++) {
    for (let x1 = 0; x1 < w; x1++) {
      const x = x1 < r ? x1 - r : x1 >= w - r ? x1 - r - wB : 0
      const y = y1 < r ? y1 - r : y1 >= h - r ? y1 - r - hB : 0
      const dSq = x * x + y * y
      if (dSq > r1Sq || dSq < rBSq)
        continue

      const dist = Math.sqrt(dSq)
      const fromSide = r - dist
      const op = dSq < rSq ? 1 : 1 - (dist - Math.sqrt(rSq)) / (Math.sqrt(r1Sq) - Math.sqrt(rSq))
      if (op <= 0 || dist === 0)
        continue

      const cos = x / dist
      const sin = -y / dist
      const dot = Math.abs(cos * sv[0] + sin * sv[1])
      const edge = Math.sqrt(Math.max(0, 1 - (1 - fromSide) ** 2))
      const coeff = dot * edge
      const col = (255 * coeff) | 0
      const alpha = (col * coeff * op) | 0

      const idx = (y1 * w + x1) * 4
      d[idx] = col
      d[idx + 1] = col
      d[idx + 2] = col
      d[idx + 3] = alpha
    }
  }

  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL()
}

export interface LiquidGlassMaps {
  displacementUrl: string
  specularUrl: string
  width: number
  height: number
}

export function generateLiquidGlassMaps(
  w: number, h: number,
  radius: number = 8,
  thickness: number = 60,
  ior: number = 1.5,
): LiquidGlassMaps | null {
  if (w < 2 || h < 2)
    return null

  const bezelWidth = Math.min(radius - 1, Math.min(w, h) / 2 - 1)
  if (bezelWidth < 1)
    return null

  const heightFn = SURFACE_FNS.convex_squircle
  const profile = calculateRefractionProfile(thickness, bezelWidth, heightFn, ior, 128)
  const maxDisp = Math.max(...Array.from(profile).map(Math.abs)) || 1

  const displacementUrl = generateDisplacementMap(w, h, radius, bezelWidth, profile, maxDisp)
  const specularUrl = generateSpecularMap(w, h, radius, bezelWidth, Math.PI / 3)

  return { displacementUrl, specularUrl, width: w, height: h }
}
