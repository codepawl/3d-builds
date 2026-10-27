// Shared materials, palette and canvas-drawn textures for every model in the scene.
import * as THREE from 'three'

export const BRAND = '#2a4fd8'

export const PALETTE = {
  ground: '#e6edf4',
  apron: '#dfe5ee',
  grass: '#dbe8d4',
  runway: '#7f899c',
  taxiway: '#c2cad7',
  road: '#d3d9e3',
  marking: '#ffffff',
  taxiLine: '#f2c230',
  white: '#f6f8fb',
  body: '#fbfcfe',
  glass: '#9fd8dc',
  dark: '#3a4252',
  metal: '#c9d0db',
  tree: '#8ccf9c',
  treeDark: '#6fbd84',
  trunk: '#b9a48d',
}

const cache = new Map()

function cached(key, create) {
  if (!cache.has(key)) cache.set(key, create())
  return cache.get(key)
}

export function standard(color, options = {}) {
  const key = `standard:${color}:${JSON.stringify(options)}`
  return cached(key, () => new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.02, ...options }))
}

// Lights that should bloom: emissive above 1 with tone mapping off.
export function glow(color, strength = 3) {
  return cached(`glow:${color}:${strength}`, () => {
    const material = new THREE.MeshBasicMaterial({ color })
    material.color.multiplyScalar(strength)
    material.toneMapped = false
    return material
  })
}

// Text drawn onto a canvas, used for gate signs, runway numbers and fuselage titles.
export function textTexture(text, { color = '#ffffff', background = null, width = 256, height = 64, weight = 700, scale = 0.62, align = 'center' } = {}) {
  return cached(`text:${text}:${color}:${background}:${width}:${height}:${weight}:${scale}:${align}`, () => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (background) {
      context.fillStyle = background
      context.beginPath()
      context.roundRect(0, 0, width, height, height * 0.22)
      context.fill()
    }
    context.fillStyle = color
    context.font = `${weight} ${Math.round(height * scale)}px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif`
    context.textAlign = align
    context.textBaseline = 'middle'
    context.fillText(text, align === 'center' ? width / 2 : height * 0.2, height / 2 + height * 0.04)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    return texture
  })
}
