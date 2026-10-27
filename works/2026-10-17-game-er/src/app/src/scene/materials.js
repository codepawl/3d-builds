// Shared materials, palette and canvas-drawn textures for every model in the scene.
import * as THREE from 'three'

export const BRAND = '#2f6fe4'

export const PALETTE = {
  grass: '#cddfc6',
  outside: '#dde5ee',
  asphalt: '#9ea7b5',
  paving: '#e2e6ec',
  pavingLine: '#d0d6de',
  kerb: '#f3f5f8',
  marking: '#ffffff',
  hatch: '#f2c94c',
  cladding: '#eef1f5',
  roof: '#c5ccd7',
  trim: '#3a4250',
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

// A repeating paving or floor pattern: a fill with thin joint lines, `cells` per texture tile.
export function jointTexture(fill, line, cells = 4, repeatX = 1, repeatY = 1) {
  return cached(`joint:${fill}:${line}:${cells}:${repeatX}:${repeatY}`, () => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const context = canvas.getContext('2d')
    context.fillStyle = fill
    context.fillRect(0, 0, 256, 256)
    context.strokeStyle = line
    context.lineWidth = 3
    for (let index = 0; index <= cells; index++) {
      const offset = (index * 256) / cells
      context.beginPath()
      context.moveTo(offset, 0)
      context.lineTo(offset, 256)
      context.moveTo(0, offset)
      context.lineTo(256, offset)
      context.stroke()
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(repeatX, repeatY)
    texture.anisotropy = 8
    return texture
  })
}

// Diagonal hatching for the ambulance-only box.
export function hatchTexture(color) {
  return cached(`hatch:${color}`, () => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const context = canvas.getContext('2d')
    context.strokeStyle = color
    context.lineWidth = 14
    context.strokeRect(7, 7, 242, 242)
    context.lineWidth = 12
    for (let offset = -256; offset < 512; offset += 48) {
      context.beginPath()
      context.moveTo(offset, 256)
      context.lineTo(offset + 256, 0)
      context.stroke()
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    return texture
  })
}
