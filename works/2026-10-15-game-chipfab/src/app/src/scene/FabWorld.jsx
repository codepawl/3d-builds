// A fab floor with the roof cut away: raised-floor bays, walls on the far sides, the OHT rail
// loops over each bay's load-port lines, tools and stockers, and the sub-fab utility level
// open along the front edge.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RAIL_Y, SUBFAB_DEPTH, TILE } from '../sim.js'
import { selectEntity } from '../store.js'
import { cloneChild, InstancedModel, ownMaterial, useAssets } from './assets.jsx'
import { glow, PALETTE, standard, textTexture } from './materials.js'

const TOOL_MOVING = /_(status|robot|gantry|platen\d|head\d)$/
const STOCKER_MOVING = /_crane$/
const STATUS_COLORS = { running: '#25d07a', idle: '#f2f4f8', down: '#ff3b30', maintenance: '#ffae1a' }
const LANE = 2

const pickTool = (event, item) => selectEntity(event, item.id)

function groupBy(list, key) {
  const groups = new Map()
  for (const item of list) {
    const value = key(item)
    if (!groups.has(value)) groups.set(value, [])
    groups.get(value).push(item)
  }
  return groups
}

// ---------- static shell ----------

function floorItems(state) {
  const floors = { floor_a: [], floor_aisle: [], floor_litho: [], corridor: [] }
  const slabs = []
  const { layout, bays } = state
  for (const bay of bays) {
    const kind = bay.floor === 'litho' ? 'floor_litho' : 'floor_a'
    for (let x = bay.xStart + TILE / 2; x < bay.xEnd; x += TILE) {
      for (let z = layout.back + TILE / 2; z < layout.front - TILE; z += TILE) {
        const aisle = Math.abs(x - bay.xc) < 0.01
        floors[aisle ? 'floor_aisle' : kind].push({ position: [x, 0, z] })
        slabs.push({ position: [x, -0.125, z], scale: [TILE / 6.22, 1, TILE / 6.22] })
      }
      floors.corridor.push({ position: [x, 0, layout.front - TILE / 2], rotation: Math.PI / 2 })
      slabs.push({ position: [x, -0.125, layout.front - TILE / 2], scale: [TILE / 6.22, 1, TILE / 6.22] })
    }
  }
  return { floors, slabs }
}

function wallItems(state) {
  const { layout, bays } = state
  const walls = { wall_a: [], wall_litho: [], wall_door: [], column_a: [] }
  for (const bay of bays) {
    for (let x = bay.xStart + TILE / 2; x < bay.xEnd; x += TILE) {
      walls[bay.floor === 'litho' ? 'wall_litho' : 'wall_a'].push({ position: [x, 0, layout.back], rotation: 0 })
    }
    walls.column_a.push({ position: [bay.xStart, 0, layout.back] })
  }
  walls.column_a.push({ position: [layout.width, 0, layout.back] })
  for (let z = layout.back + TILE / 2; z < layout.front; z += TILE) {
    const isDoor = z > layout.front - TILE
    walls[isDoor ? 'wall_door' : 'wall_a'].push({ position: [0, 0, z], rotation: Math.PI / 2 })
  }
  return walls
}

function BayLabel({ bay, state, index }) {
  const label = `Bay ${index + 1} · ${bay.name}`
  const texture = useMemo(() => textTexture(label, { color: '#ffffff', background: '#13a594', width: 1024, height: 128, scale: 0.62 }), [label])
  const width = Math.min(bay.xEnd - bay.xStart - 3, 12)
  return (
    <group position={[bay.xc, 0, state.layout.corridorZ]}>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, width / 8]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} />
      </mesh>
    </group>
  )
}

function SignLabel({ bay, index, state }) {
  const texture = useMemo(() => textTexture(`${index + 1}`, { color: '#ffffff', width: 128, height: 128, scale: 0.6 }), [index])
  const position = [bay.xc + 1.4, 0, state.layout.zb + LANE + 1.2]
  return (
    <group position={position}>
      <mesh position={[0, 2.84, 0.21]}>
        <planeGeometry args={[0.38, 0.38]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} />
      </mesh>
    </group>
  )
}

function Shell({ state, nodes }) {
  const { floors, slabs } = useMemo(() => floorItems(state), [state])
  const walls = useMemo(() => wallItems(state), [state])
  const { layout, bays } = state
  const signs = useMemo(() => bays.map((bay) => ({ position: [bay.xc + 1.4, 0, layout.zb + LANE + 1.2] })), [bays, layout])
  const carts = useMemo(
    () =>
      state.tools
        .filter((tool, index) => index % 3 === 0)
        .map((tool) => {
          const bay = bays[tool.bay]
          const side = tool.origin.x < bay.xc ? -1 : 1
          return { position: [bay.xc + side * 0.75, 0, tool.center.z + 1.6], rotation: side > 0 ? -Math.PI / 2 : Math.PI / 2 }
        }),
    [state, bays],
  )
  const plinthMaterial = standard('#c9d0da', { roughness: 0.9 })
  const width = layout.width
  const depth = layout.front - layout.back
  return (
    <group>
      <InstancedModel node={nodes.floor_a} items={floors.floor_a} shadows={false} />
      <InstancedModel node={nodes.floor_litho} items={floors.floor_litho} shadows={false} />
      <InstancedModel node={nodes.floor_aisle} items={floors.floor_aisle} shadows={false} />
      <InstancedModel node={nodes.floor_aisle} items={floors.corridor} shadows={false} />
      <InstancedModel node={nodes.slab_waffle} items={slabs} shadows={false} />
      <InstancedModel node={nodes.wall_a} items={walls.wall_a} />
      <InstancedModel node={nodes.wall_litho} items={walls.wall_litho} />
      <InstancedModel node={nodes.wall_door} items={walls.wall_door} />
      <InstancedModel node={nodes.column_a} items={walls.column_a} />
      <InstancedModel node={nodes.sign_bay} items={signs} />
      <InstancedModel node={nodes.cart_terminal} items={carts} />
      <InstancedModel node={nodes.airshower_a} items={[{ position: [2.2, 0, layout.front - TILE / 2 - 1.5], rotation: Math.PI / 2 }]} />
      {bays.map((bay, index) => (
        <BayLabel key={bay.index} bay={bay} state={state} index={index} />
      ))}
      {bays.map((bay, index) => (
        <SignLabel key={bay.index} bay={bay} state={state} index={index} />
      ))}
      {/* Plinth: the building's sub-fab walls on the back and sides, open at the front. */}
      <mesh position={[width / 2, -SUBFAB_DEPTH / 2 - 0.4, layout.back - 0.3]} material={plinthMaterial} receiveShadow castShadow>
        <boxGeometry args={[width + 1.2, SUBFAB_DEPTH - 0.8, 0.6]} />
      </mesh>
      <mesh position={[-0.3, -SUBFAB_DEPTH / 2 - 0.4, (layout.back + layout.front) / 2]} material={plinthMaterial} receiveShadow castShadow>
        <boxGeometry args={[0.6, SUBFAB_DEPTH - 0.8, depth]} />
      </mesh>
      <mesh position={[width + 0.3, -SUBFAB_DEPTH / 2 - 0.4, (layout.back + layout.front) / 2]} material={plinthMaterial} receiveShadow castShadow>
        <boxGeometry args={[0.6, SUBFAB_DEPTH - 0.8, depth]} />
      </mesh>
      {/* Sub-fab floor slab and its edge strip along the cut. */}
      <mesh position={[width / 2, -SUBFAB_DEPTH - 0.05, (layout.back + layout.front) / 2]} receiveShadow material={standard('#b9c2cf', { roughness: 0.95 })}>
        <boxGeometry args={[width, 0.1, depth]} />
      </mesh>
      <mesh position={[width / 2, -0.37, layout.front + 0.06]} material={standard(PALETTE.trim)}>
        <boxGeometry args={[width, 0.5, 0.12]} />
      </mesh>
      <mesh position={[width / 2, -0.15, layout.front + 0.13]} material={glow('#9feee6', 1.6)}>
        <boxGeometry args={[width, 0.05, 0.02]} />
      </mesh>
    </group>
  )
}

// ---------- OHT rails ----------

// rail_curve runs a quarter circle of radius 2 around its local point (2, -2), from the -x
// direction to the +z direction. `angle` turns that quadrant to the one needed.
function curveItem(centerX, centerZ, angle) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const offsetX = 2 * cos + -2 * sin
  const offsetZ = -2 * sin + -2 * cos
  return { position: [centerX - offsetX, RAIL_Y, centerZ - offsetZ], rotation: angle }
}

function Rails({ state, nodes }) {
  const { straights, curves } = useMemo(() => {
    const straightList = []
    const curveList = []
    for (const bay of state.bays) {
      for (let z = bay.za + 2; z < bay.zb; z += 4) {
        straightList.push({ position: [bay.xc - LANE, RAIL_Y, z] }, { position: [bay.xc + LANE, RAIL_Y, z] })
      }
      curveList.push(
        curveItem(bay.xc, bay.zb, 0),
        curveItem(bay.xc, bay.zb, Math.PI / 2),
        curveItem(bay.xc, bay.za, Math.PI),
        curveItem(bay.xc, bay.za, -Math.PI / 2),
      )
    }
    return { straights: straightList, curves: curveList }
  }, [state])
  return (
    <group>
      <InstancedModel node={nodes.rail_straight} items={straights} />
      <InstancedModel node={nodes.rail_curve} items={curves} />
    </group>
  )
}

// ---------- tools ----------

function Tools({ state, nodes }) {
  const byVariant = useMemo(() => groupBy(state.tools, (tool) => tool.variant), [state])
  return (
    <group>
      {[...byVariant].map(([variant, tools]) => (
        <InstancedModel
          key={variant}
          node={nodes[`tool_${variant}`]}
          exclude={TOOL_MOVING}
          onPick={pickTool}
          items={tools.map((tool) => ({ id: tool.id, position: [tool.origin.x, 0, tool.origin.z], rotation: tool.angle }))}
        />
      ))}
      {state.tools.map((tool) => (
        <ToolParts key={tool.id} tool={tool} nodes={nodes} />
      ))}
    </group>
  )
}

// Status lamp, wafer robot, CMP platens and heads, wet-bench gantry: driven by the tool state.
function ToolParts({ tool, nodes }) {
  const root = `tool_${tool.variant}`
  const parts = useMemo(() => {
    const status = cloneChild(nodes, root, 'status')
    const lampMaterial = status && ownMaterial(status, 'status')
    if (lampMaterial) {
      lampMaterial.toneMapped = false
      lampMaterial.emissiveIntensity = 2.4
    }
    return {
      status,
      lampMaterial,
      robot: cloneChild(nodes, root, 'robot'),
      gantry: cloneChild(nodes, root, 'gantry'),
      platens: [0, 1, 2].map((index) => cloneChild(nodes, root, `platen${index}`)).filter(Boolean),
      heads: [0, 1, 2].map((index) => cloneChild(nodes, root, `head${index}`)).filter(Boolean),
    }
  }, [nodes, root])
  const gantryHome = parts.gantry?.position.x ?? 0
  const lastState = useRef(null)
  useFrame((_, dt) => {
    const running = tool.state === 'running'
    if (parts.lampMaterial && lastState.current !== tool.state) {
      lastState.current = tool.state
      const color = new THREE.Color(STATUS_COLORS[tool.state])
      parts.lampMaterial.color.copy(color)
      parts.lampMaterial.emissive.copy(color)
      parts.lampMaterial.emissiveIntensity = tool.state === 'idle' ? 0.6 : 2.6
    }
    if (tool.state === 'down' && parts.lampMaterial) parts.lampMaterial.emissiveIntensity = 1.2 + Math.abs(Math.sin(tool.mover * 5)) * 2.6
    if (!running) return
    if (parts.robot) parts.robot.rotation.y = Math.sin(tool.mover * 0.9) * 1.6
    parts.platens.forEach((platen) => {
      platen.rotation.y += dt * 4
    })
    parts.heads.forEach((head, index) => {
      head.rotation.y -= dt * 6
      head.position.x = parts.platens[index].position.x + Math.sin(tool.mover * 1.3 + index) * 0.18
    })
    if (parts.gantry) parts.gantry.position.x = gantryHome + 1.4 + Math.sin(tool.mover * 0.5) * 1.4
  })
  const pick = (event) => selectEntity(event, tool.id)
  return (
    <group position={[tool.origin.x, 0, tool.origin.z]} rotation={[0, tool.angle, 0]} onClick={pick}>
      {parts.status && <primitive object={parts.status} />}
      {parts.robot && <primitive object={parts.robot} />}
      {parts.gantry && <primitive object={parts.gantry} />}
      {parts.platens.map((platen) => (
        <primitive key={platen.uuid} object={platen} />
      ))}
      {parts.heads.map((head) => (
        <primitive key={head.uuid} object={head} />
      ))}
    </group>
  )
}

// ---------- stockers ----------

function Stockers({ state, nodes }) {
  const byNode = useMemo(() => groupBy(state.stockers, (stocker) => stocker.node), [state])
  return (
    <group>
      {[...byNode].map(([node, stockers]) => (
        <InstancedModel
          key={node}
          node={nodes[node]}
          exclude={STOCKER_MOVING}
          onPick={pickTool}
          items={stockers.map((stocker) => ({ id: stocker.id, position: [stocker.origin.x, 0, stocker.origin.z], rotation: stocker.angle }))}
        />
      ))}
      {state.stockers.map((stocker) => (
        <StockerCrane key={stocker.id} stocker={stocker} nodes={nodes} />
      ))}
    </group>
  )
}

function StockerCrane({ stocker, nodes }) {
  const crane = useMemo(() => cloneChild(nodes, stocker.node, 'crane'), [nodes, stocker.node])
  const home = crane.position.x
  const travel = stocker.node === 'stocker_b' ? 6 : 3
  useFrame(() => {
    crane.position.x = home - 0.9 + stocker.crane * travel
  })
  return (
    <group position={[stocker.origin.x, 0, stocker.origin.z]} rotation={[0, stocker.angle, 0]}>
      <primitive object={crane} />
    </group>
  )
}

// ---------- sub-fab ----------

function subfabItems(state) {
  const { layout, bays } = state
  const floorY = -SUBFAB_DEPTH
  const groups = { pump_a: [], pump_b: [], chiller_a: [], gascab_a: [], scrubber_a: [], piperack_a: [] }
  const frontZ = layout.front - 3.2
  for (const bay of bays) {
    let x = bay.xStart + 1.6
    const pattern = ['pump_a', 'pump_b', 'pump_a', 'gascab_a', 'gascab_a', 'chiller_a', 'scrubber_a', 'pump_b', 'pump_a']
    let index = bay.index
    while (x < bay.xEnd - 1.6) {
      const kind = pattern[index % pattern.length]
      const width = { pump_a: 1.1, pump_b: 1.1, gascab_a: 1.3, chiller_a: 2.8, scrubber_a: 1.9 }[kind]
      groups[kind].push({ position: [x + width / 2, floorY, frontZ - (kind === 'chiller_a' ? 0.5 : 0)], rotation: kind === 'gascab_a' ? 0 : Math.PI / 2 })
      x += width + 0.6
      index++
    }
  }
  for (let x = 3; x < layout.width - 3; x += 6) {
    groups.piperack_a.push({ position: [x, floorY, layout.front - 9.5], rotation: Math.PI / 2 })
    groups.piperack_a.push({ position: [x, floorY, layout.front - 18], rotation: Math.PI / 2 })
  }
  return groups
}

function Subfab({ state, nodes }) {
  const groups = useMemo(() => subfabItems(state), [state])
  const lampItems = useMemo(() => {
    const list = []
    for (let x = 4; x < state.layout.width; x += 8) list.push(x)
    return list
  }, [state])
  return (
    <group>
      {Object.entries(groups).map(([name, items]) => (
        <InstancedModel key={name} node={nodes[name]} items={items} />
      ))}
      {lampItems.map((x) => (
        <mesh key={x} position={[x, -0.78, state.layout.front - 4]} material={glow('#fff6e0', 2.2)}>
          <boxGeometry args={[2.4, 0.06, 0.18]} />
        </mesh>
      ))}
    </group>
  )
}

// Ramp-up fab: taped install zones where tools are still to arrive.
function InstallZones({ state }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const context = canvas.getContext('2d')
    context.fillStyle = 'rgba(255, 190, 40, 0.12)'
    context.fillRect(0, 0, 256, 256)
    context.strokeStyle = '#f2b51c'
    context.lineWidth = 10
    context.setLineDash([26, 16])
    context.strokeRect(8, 8, 240, 240)
    context.fillStyle = '#b77d00'
    context.font = '600 30px "Segoe UI", system-ui, sans-serif'
    context.textAlign = 'center'
    context.fillText('Tool install', 128, 136)
    const result = new THREE.CanvasTexture(canvas)
    result.colorSpace = THREE.SRGBColorSpace
    result.anisotropy = 8
    return result
  }, [])
  return state.installs.map((zone) => (
    <mesh key={zone.id} position={[zone.x, 0.03, zone.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[zone.width, zone.depth]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  ))
}

export function FabWorld({ state }) {
  const { nodes } = useAssets()
  const { layout } = state
  return (
    <group>
      <mesh position={[layout.width / 2, -SUBFAB_DEPTH - 0.12, (layout.back + layout.front) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1400, 1400]} />
        <meshStandardMaterial color={PALETTE.outside} roughness={1} />
      </mesh>
      <Shell state={state} nodes={nodes} />
      <Rails state={state} nodes={nodes} />
      <Tools state={state} nodes={nodes} />
      <Stockers state={state} nodes={nodes} />
      <Subfab state={state} nodes={nodes} />
      <InstallZones state={state} />
    </group>
  )
}
