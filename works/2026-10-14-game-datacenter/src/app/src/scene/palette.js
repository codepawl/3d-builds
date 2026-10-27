import { Color } from 'three'

export const COLORS = {
  brand: '#5b4bff',
  brandDeep: '#3a2fc4',
  ground: '#dce3f0',
  pad: '#eef1f8',
  rackTop: '#363b4d',
  dark: '#3b4152',
  treeDark: '#6cc293',
  coldAisle: '#d5e3ff',
  hotAisle: '#ffe2d4',
  ok: '#22c55e',
  warn: '#f59e0b',
  critical: '#ef4444',
}

const COOL = new Color('#3cc8f0')
const WARM = new Color('#ffb02e')
const HOT = new Color('#ff3b4f')

// GPU tray glow follows temperature: cool cyan, warm amber, hot red. Values above 1 feed the bloom pass.
export function temperatureColor(celsius, target, intensity = 1.7) {
  if (celsius <= 70) {
    const mix = Math.min(1, Math.max(0, (celsius - 56) / 14))
    target.copy(COOL).lerp(WARM, mix)
  } else {
    const mix = Math.min(1, (celsius - 70) / 14)
    target.copy(WARM).lerp(HOT, mix)
  }
  return target.multiplyScalar(intensity)
}
