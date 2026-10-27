// Shared materials and small canvas textures so no surface is bare: lawn, paving, water, asphalt.
import * as THREE from 'three'

export const BRAND = '#e0464f'
export const SKY = '#cfe3ee'

const cache = new Map()

function cached(key, create) {
  if (!cache.has(key)) cache.set(key, create())
  return cache.get(key)
}

export function standard(color, options = {}) {
  return cached(`standard:${color}:${JSON.stringify(options)}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.02, ...options }))
}

function seededNoise(seed) {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return state / 2147483647
  }
}

function canvasTexture(size, draw, repeat) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  draw(canvas.getContext('2d'), size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeat, repeat)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

// Mown lawn: soft mottling and faint mowing stripes around a base colour.
function lawnTexture(color) {
  return canvasTexture(
    256,
    (context, size) => {
      const random = seededNoise(11)
      context.fillStyle = color
      context.fillRect(0, 0, size, size)
      for (let stripe = 0; stripe < 8; stripe++) {
        context.fillStyle = stripe % 2 ? 'rgba(255,255,255,0.045)' : 'rgba(0,40,0,0.03)'
        context.fillRect(0, (stripe * size) / 8, size, size / 8)
      }
      for (let index = 0; index < 2600; index++) {
        const light = random() < 0.5
        context.fillStyle = light ? `rgba(255,255,220,${0.05 + random() * 0.07})` : `rgba(20,60,20,${0.05 + random() * 0.08})`
        context.fillRect(random() * size, random() * size, 1 + random() * 2.5, 1 + random() * 2.5)
      }
    },
    1,
  )
}

// Paving: running-bond pavers with soft joints.
function pavingTexture(color) {
  return canvasTexture(
    256,
    (context, size) => {
      const random = seededNoise(29)
      context.fillStyle = color
      context.fillRect(0, 0, size, size)
      const rows = 8
      const height = size / rows
      for (let row = 0; row < rows; row++) {
        const shift = row % 2 ? height : 0
        for (let x = -height * 2; x < size; x += height * 2) {
          const shade = (random() - 0.5) * 0.08
          context.fillStyle = shade > 0 ? `rgba(255,255,255,${shade})` : `rgba(80,60,40,${-shade})`
          context.fillRect(x + shift + 1, row * height + 1, height * 2 - 2, height - 2)
        }
        context.fillStyle = 'rgba(90,70,50,0.16)'
        context.fillRect(0, row * height, size, 1.2)
        for (let x = -height * 2; x < size; x += height * 2) context.fillRect(x + shift, row * height, 1.2, height)
      }
    },
    1,
  )
}

function asphaltTexture() {
  return canvasTexture(
    256,
    (context, size) => {
      const random = seededNoise(5)
      context.fillStyle = '#5f6672'
      context.fillRect(0, 0, size, size)
      for (let index = 0; index < 5000; index++) {
        context.fillStyle = random() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
        context.fillRect(random() * size, random() * size, 1.5, 1.5)
      }
    },
    1,
  )
}

export function lawnMaterial(color) {
  return cached(`lawn:${color}`, () => new THREE.MeshStandardMaterial({ map: lawnTexture(color), roughness: 0.95 }))
}

// World-space UVs are set on the ground meshes, so one texture tile covers `tile` metres.
export function pavingMaterial(color) {
  return cached(`paving:${color}`, () => new THREE.MeshStandardMaterial({ map: pavingTexture(color), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }))
}

export function asphaltMaterial() {
  return cached('asphalt', () => new THREE.MeshStandardMaterial({ map: asphaltTexture(), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }))
}

export function waterMaterial() {
  return cached('water', () => new THREE.MeshStandardMaterial({ color: '#4fb7cf', roughness: 0.12, metalness: 0.1, envMapIntensity: 1.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }))
}

export function edgeMaterial() {
  return cached('edge', () => new THREE.MeshStandardMaterial({ color: '#d9cbb0', roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -3 }))
}

export function paintMaterial() {
  return cached('paint', () => new THREE.MeshBasicMaterial({ color: '#f3f1ea', polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }))
}
