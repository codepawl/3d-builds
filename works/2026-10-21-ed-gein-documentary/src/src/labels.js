// Screen-space label layout. Every 3D label (boxed tags with leader lines, and plain map names) registers here;
// each frame the projector places them by priority so that no label covers another label, a panel of the
// interface (any element with the class `reserve`) or a registered obstacle such as the store's outline.
// A label that finds no free spot is hidden. Positions are written straight to the DOM, not through React.
import * as THREE from 'three'

const entries = new Map()
const obstacles = new Map()
const SVG_NS = 'http://www.w3.org/2000/svg'
const GAP = 10
const MARGIN = 14

let layer = null
let leaderLayer = null
let reservedRects = []
let reservedAge = Infinity

function ensureLayer() {
  if (layer && document.body.contains(layer)) return true
  layer = document.getElementById('label-layer')
  leaderLayer = document.getElementById('label-leaders')
  return Boolean(layer && leaderLayer)
}

function createElements(entry) {
  const box = document.createElement('div')
  box.className = entry.kind === 'tag' ? `label-box${entry.red ? ' red' : ''}` : `map-name ${entry.kind}`
  const title = document.createElement('span')
  title.textContent = entry.text
  box.appendChild(title)
  if (entry.sub) {
    const sub = document.createElement('small')
    sub.textContent = entry.sub
    box.appendChild(sub)
  }
  box.style.opacity = '0'
  layer.appendChild(box)
  entry.box = box
  entry.width = box.offsetWidth
  entry.height = box.offsetHeight
  if (entry.kind === 'tag') {
    entry.line = document.createElementNS(SVG_NS, 'line')
    entry.line.setAttribute('class', `leader${entry.red ? ' red' : ''}`)
    entry.dot = document.createElementNS(SVG_NS, 'circle')
    entry.dot.setAttribute('r', '4')
    entry.dot.setAttribute('class', `anchor${entry.red ? ' red' : ''}`)
    leaderLayer.appendChild(entry.line)
    leaderLayer.appendChild(entry.dot)
  }
}

function removeElements(entry) {
  entry.box?.remove()
  entry.line?.remove()
  entry.dot?.remove()
}

// entry: { object (THREE.Object3D anchor), text, sub, red, kind: 'tag' | 'large' | 'normal' | 'county' | 'street', priority }
export function registerLabel(id, entry) {
  const full = { ...entry, id, alpha: 0, placement: null, created: false }
  entries.set(id, full)
  return () => {
    removeElements(full)
    if (entries.get(id) === full) entries.delete(id)
  }
}

// An obstacle is a world-space box whose screen rectangle labels must not cover (the store outline).
export function registerObstacle(id, getBox) {
  obstacles.set(id, getBox)
  return () => obstacles.delete(id)
}

function intersects(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

function grow(rect, amount) {
  return { left: rect.left - amount, top: rect.top - amount, right: rect.right + amount, bottom: rect.bottom + amount }
}

function readReservedRects() {
  reservedRects = []
  for (const element of document.querySelectorAll('.reserve')) {
    const rect = element.getBoundingClientRect()
    if (rect.width < 2 || rect.height < 2) continue
    if (Number(getComputedStyle(element).opacity) < 0.05) continue
    reservedRects.push(grow(rect, MARGIN))
  }
}

const corner = new THREE.Vector3()
function projectedRect(box, camera, width, height) {
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (let index = 0; index < 8; index++) {
    corner.set(index & 1 ? box.max.x : box.min.x, index & 2 ? box.max.y : box.min.y, index & 4 ? box.max.z : box.min.z)
    corner.project(camera)
    if (corner.z > 1) return null
    const x = (corner.x * 0.5 + 0.5) * width
    const y = (-corner.y * 0.5 + 0.5) * height
    left = Math.min(left, x)
    right = Math.max(right, x)
    top = Math.min(top, y)
    bottom = Math.max(bottom, y)
  }
  return grow({ left, top, right, bottom }, 8)
}

// Candidate boxes for a tag, as offsets of the box's top-left corner from the anchor point.
function tagCandidates(width, height) {
  return [
    [26, -height - 46],
    [-width - 26, -height - 46],
    [26, -height - 110],
    [-width - 26, -height - 110],
    [34, -height / 2],
    [-width - 34, -height / 2],
    [26, 46],
    [-width - 26, 46],
    [-width / 2, -height - 170],
    [-width / 2, 90],
  ]
}

const anchor = new THREE.Vector3()

// Called once per rendered frame from inside the canvas.
export function layoutLabels(camera, width, height, delta) {
  if (!ensureLayer()) return
  reservedAge += 1
  if (reservedAge > 6) {
    readReservedRects()
    reservedAge = 0
  }
  const blocked = [...reservedRects]
  for (const getBox of obstacles.values()) {
    const box = getBox()
    if (!box) continue
    const rect = projectedRect(box, camera, width, height)
    if (rect) blocked.push(rect)
  }
  const placed = []
  const ordered = [...entries.values()].sort((a, b) => b.priority - a.priority)
  for (const entry of ordered) {
    if (!entry.created) {
      createElements(entry)
      entry.created = true
    }
    let target = null
    entry.object.getWorldPosition(anchor)
    anchor.project(camera)
    const onScreen = anchor.z < 1 && Math.abs(anchor.x) < 1.02 && Math.abs(anchor.y) < 1.02
    if (onScreen) {
      const x = (anchor.x * 0.5 + 0.5) * width
      const y = (-anchor.y * 0.5 + 0.5) * height
      const point = { left: x - 6, top: y - 6, right: x + 6, bottom: y + 6 }
      const anchorFree = !reservedRects.some((rect) => intersects(rect, point))
      // First try to keep clear of obstacles too; in a close-up the store fills the view, so then only
      // panels and other labels count.
      for (const avoidObstacles of [true, false]) {
        if (target || !anchorFree) break
        const blockers = avoidObstacles ? blocked : reservedRects
        const candidates = entry.kind === 'tag' ? tagCandidates(entry.width, entry.height) : [[-entry.width / 2, -entry.height / 2]]
        // Keep last frame's spot first so labels do not jump between equal choices.
        const order = candidates.map((_, index) => index)
        if (entry.placement !== null && entry.placement < candidates.length) {
          order.splice(entry.placement, 1)
          order.unshift(entry.placement)
        }
        for (const index of order) {
          const [dx, dy] = candidates[index]
          const rect = { left: x + dx, top: y + dy, right: x + dx + entry.width, bottom: y + dy + entry.height }
          if (rect.left < 8 || rect.top < 8 || rect.right > width - 8 || rect.bottom > height - 8) continue
          const padded = grow(rect, GAP)
          if (blockers.some((other) => intersects(other, padded))) continue
          if (placed.some((other) => intersects(other, padded))) continue
          target = { rect, x, y, choice: index }
          break
        }
      }
    }
    const goal = target ? 1 : 0
    entry.alpha += (goal - entry.alpha) * Math.min(1, delta * 5)
    if (!target && entry.alpha < 0.02) entry.alpha = 0
    if (target) {
      entry.placement = target.choice
      entry.last = target
      placed.push(target.rect)
      if (entry.kind === 'tag') placed.push({ left: target.x - 8, top: target.y - 8, right: target.x + 8, bottom: target.y + 8 })
    }
    const shown = entry.last && entry.alpha > 0
    entry.box.style.opacity = shown ? entry.alpha.toFixed(3) : '0'
    entry.box.style.visibility = shown ? 'visible' : 'hidden'
    entry.box.dataset.visible = target ? '1' : '0'
    if (shown) entry.box.style.transform = `translate(${Math.round(entry.last.rect.left)}px, ${Math.round(entry.last.rect.top)}px)`
    if (entry.line) {
      if (shown) {
        const { rect, x, y } = entry.last
        const endX = Math.min(rect.right, Math.max(rect.left, x))
        const endY = Math.min(rect.bottom, Math.max(rect.top, y))
        entry.line.setAttribute('x1', x.toFixed(1))
        entry.line.setAttribute('y1', y.toFixed(1))
        entry.line.setAttribute('x2', endX.toFixed(1))
        entry.line.setAttribute('y2', endY.toFixed(1))
        entry.dot.setAttribute('cx', x.toFixed(1))
        entry.dot.setAttribute('cy', y.toFixed(1))
      }
      entry.line.style.opacity = shown ? entry.alpha.toFixed(3) : '0'
      entry.dot.style.opacity = shown ? entry.alpha.toFixed(3) : '0'
    }
  }
}

// Ask for a fresh read of the panels after the interface changes (tab, card, timeline row).
export function invalidateReserved() {
  reservedAge = Infinity
}
