import * as THREE from 'three'

function canvasTexture(width, height, draw, repeat = true) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  draw(context, width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
  }
  texture.anisotropy = 8
  return texture
}

function seededNoise(seed) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

export function makeAsphaltTexture() {
  return canvasTexture(256, 256, (context, width, height) => {
    context.fillStyle = '#3b3f46'
    context.fillRect(0, 0, width, height)
    const random = seededNoise(7)
    for (let index = 0; index < 5200; index += 1) {
      const shade = 50 + Math.floor(random() * 40)
      context.fillStyle = `rgba(${shade},${shade + 2},${shade + 6},0.55)`
      context.fillRect(random() * width, random() * height, 1 + random() * 1.6, 1 + random() * 1.6)
    }
    context.strokeStyle = 'rgba(230,230,210,0.5)'
    context.lineWidth = 3
    context.setLineDash([22, 18])
    context.beginPath()
    context.moveTo(0, height / 2)
    context.lineTo(width, height / 2)
    context.stroke()
  })
}

export function makeConcreteTexture() {
  return canvasTexture(256, 256, (context, width, height) => {
    context.fillStyle = '#9aa0a6'
    context.fillRect(0, 0, width, height)
    const random = seededNoise(21)
    for (let index = 0; index < 3600; index += 1) {
      const shade = 140 + Math.floor(random() * 40)
      context.fillStyle = `rgba(${shade},${shade + 2},${shade + 4},0.35)`
      context.fillRect(random() * width, random() * height, 1 + random() * 2, 1 + random() * 2)
    }
    context.strokeStyle = 'rgba(70,76,84,0.6)'
    context.lineWidth = 2
    context.strokeRect(1, 1, width - 2, height - 2)
    context.strokeStyle = 'rgba(245,200,70,0.55)'
    context.lineWidth = 4
    context.beginPath()
    context.moveTo(0, height - 6)
    context.lineTo(width, height - 6)
    context.stroke()
  })
}

// Soft bar that fades along its length: the safe braking envelope ahead of a train.
export function makeMovementAuthorityTexture() {
  return canvasTexture(256, 32, (context, width, height) => {
    const gradient = context.createLinearGradient(0, 0, width, 0)
    gradient.addColorStop(0, 'rgba(255,255,255,0.85)')
    gradient.addColorStop(0.7, 'rgba(255,255,255,0.35)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 4, width, height - 8)
  }, false)
}

// Excavated soil: brown clay with darker pockets and pale stones, used to fill every open cut so no pit floor reads as empty.
export function makeSoilTexture() {
  return canvasTexture(256, 256, (context, width, height) => {
    context.fillStyle = '#7b5a3c'
    context.fillRect(0, 0, width, height)
    const random = seededNoise(33)
    for (let index = 0; index < 2400; index += 1) {
      const shade = 70 + Math.floor(random() * 70)
      context.fillStyle = `rgba(${shade + 30},${shade},${shade - 25},0.4)`
      context.fillRect(random() * width, random() * height, 2 + random() * 5, 1 + random() * 3)
    }
    for (let index = 0; index < 260; index += 1) {
      const shade = 150 + Math.floor(random() * 60)
      context.fillStyle = `rgba(${shade},${shade - 8},${shade - 20},0.75)`
      context.beginPath()
      context.arc(random() * width, random() * height, 1 + random() * 2.2, 0, Math.PI * 2)
      context.fill()
    }
  })
}

// Pale street paving: slab joints on a light grey base, one tile per cell.
export function makePavingTexture() {
  return canvasTexture(256, 256, (context, width, height) => {
    context.fillStyle = '#bdbfbb'
    context.fillRect(0, 0, width, height)
    const random = seededNoise(57)
    for (let index = 0; index < 1800; index += 1) {
      const shade = 165 + Math.floor(random() * 35)
      context.fillStyle = `rgba(${shade},${shade},${shade - 2},0.3)`
      context.fillRect(random() * width, random() * height, 1 + random() * 3, 1 + random() * 2)
    }
    context.strokeStyle = 'rgba(95,98,100,0.55)'
    context.lineWidth = 2
    for (let line = 0; line <= 4; line += 1) {
      const position = (line * width) / 4
      context.beginPath()
      context.moveTo(position, 0)
      context.lineTo(position, height)
      context.moveTo(0, position)
      context.lineTo(width, position)
      context.stroke()
    }
  })
}

// Soil cut face: horizontal strata from topsoil down to rock, drawn top (street) to bottom (cut floor).
export function makeStrataTexture() {
  return canvasTexture(256, 256, (context, width, height) => {
    const layers = [
      { to: 0.1, color: '#4a3524' },
      { to: 0.3, color: '#8a6a43' },
      { to: 0.5, color: '#b99468' },
      { to: 0.68, color: '#8f8f86' },
      { to: 0.85, color: '#a77d52' },
      { to: 1, color: '#6c6a66' },
    ]
    const random = seededNoise(91)
    let from = 0
    layers.forEach((layer) => {
      context.fillStyle = layer.color
      context.fillRect(0, from * height, width, (layer.to - from) * height + 1)
      from = layer.to
    })
    for (let index = 0; index < 3200; index += 1) {
      const shade = 60 + Math.floor(random() * 120)
      context.fillStyle = `rgba(${shade},${shade - 6},${shade - 18},0.28)`
      context.fillRect(random() * width, random() * height, 1 + random() * 4, 1 + random() * 2)
    }
    context.strokeStyle = 'rgba(40,30,22,0.5)'
    context.lineWidth = 1.5
    layers.slice(0, -1).forEach((layer) => {
      context.beginPath()
      for (let x = 0; x <= width; x += 8) {
        const y = layer.to * height + Math.sin(x * 0.05 + layer.to * 9) * 2
        if (x === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
      }
      context.stroke()
    })
  })
}
