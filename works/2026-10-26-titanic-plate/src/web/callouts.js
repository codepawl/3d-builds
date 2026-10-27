// Callout copy, anchors in the ship (x along the ship from the stern, y up, z toward the camera) and fly-to views.
import * as THREE from 'three';

export const CALLOUTS = [
  {
    id: 'bridge', title: 'Bridge and wheelhouse',
    text: 'The ship was steered from the wheelhouse at the forward end of the Boat deck, in front of the captain’s and officers’ quarters.',
    anchor: [211, 31, 0.8], focus: { target: [206, 29, 0], distance: 70, az: 0.45, el: 0.3 },
  },
  {
    id: 'marconi', title: 'Marconi wireless room',
    text: 'Two Marconi employees, Jack Phillips and Harold Bride, ran the wireless day and night and sent the distress calls.',
    anchor: [183, 31, 0.8], focus: { target: [183, 30, 0], distance: 60, az: 0.4, el: 0.3 },
  },
  {
    id: 'nest', title: 'Crow’s nest',
    text: 'Two lookouts watched the sea from a barrel on the foremast, with the watch on the bridge below.',
    anchor: [227.4, 40, 0], focus: { target: [226, 34, 0], distance: 60, az: 0.4, el: 0.2 },
  },
  {
    id: 'funnels', title: 'Four funnels',
    text: 'Four buff funnels with black tops. Only three were working; the aftmost was a dummy that also ventilated the kitchen and smoking rooms.',
    anchor: [120, 47, 0], focus: { target: [108, 38, 0], distance: 140, az: 0.35, el: 0.25 },
  },
  {
    id: 'boats', title: 'Lifeboats',
    text: 'Sixteen wooden boats and four collapsibles held 1,178 of the 2,208 aboard.',
    anchor: [104, 30.4, 0.8], focus: { target: [100, 30, 0], distance: 85, az: 0.3, el: 0.28 },
  },
  {
    id: 'stairs', title: 'Grand Staircase',
    text: 'Oak and wrought iron under a glass dome, with a carved clock panel on the uppermost landing.',
    anchor: [170, 24, 0.8], focus: { target: [170, 22, 0], distance: 62, az: 0.25, el: 0.2 },
  },
  {
    id: 'lounge', title: 'First class lounge',
    text: 'A deck held the first class lounge, reading room and smoke room.',
    anchor: [133, 27, 0.8], focus: { target: [133, 27, 0], distance: 62, az: 0.15, el: 0.3 },
  },
  {
    id: 'dining', title: 'First class dining saloon',
    text: 'D deck, beside the reception room. Second class dined aft of it.',
    anchor: [122, 18, 0.8], focus: { target: [122, 18, 0], distance: 70, az: 0.12, el: 0.3 },
  },
  {
    id: 'pool', title: 'Swimming pool and Turkish bath',
    text: 'First class had a swimming pool and a Victorian-style Turkish bath on F deck, and a squash court on G deck below.',
    anchor: [190, 12.5, 0.8], focus: { target: [196, 11, 0], distance: 55, az: 0.2, el: 0.3 },
  },
  {
    id: 'boilers', title: 'Boiler rooms',
    text: 'Twenty-nine boilers with 159 furnaces made the steam. Stokers and trimmers fed them coal day and night.',
    anchor: [141, 5.5, 1], focus: { target: [135, 7.5, 0], distance: 62, az: 0.1, el: 0.3 },
  },
  {
    id: 'engines', title: 'Engine room',
    text: 'Two four-cylinder triple-expansion engines, each 63 feet long, drove the outer propellers. A turbine drove the middle one.',
    anchor: [71, 6, 0], focus: { target: [70, 9.5, 0], distance: 62, az: 0.12, el: 0.3 },
  },
  {
    id: 'third', title: 'Third class',
    text: 'Third class lived forward and aft on the lower decks, in small cabins and shared rooms, with their own dining saloons.',
    anchor: [228, 12.5, 0.8], focus: { target: [228, 12, 0], distance: 70, az: 0.22, el: 0.3 },
  },
  {
    id: 'screws', title: 'Propellers',
    text: 'Three screws, two outer and one centre, drove the 46,329 gross ton ship to just under 21 knots on trials.',
    anchor: [7, 4.5, 8.6], focus: { target: [14, 6, 0], distance: 60, az: 0.2, el: 0.3 },
  },
];

export const PEOPLE = [
  { kind: 'captain', name: 'Captain', role: 'Commanded the ship\nand all her crew.' },
  { kind: 'officer', name: 'Officer', role: 'Kept watch on the bridge\nand ran the lifeboats.' },
  { kind: 'marconi', name: 'Marconi operator', role: 'Sent wireless messages\nand distress calls.' },
  { kind: 'first', name: 'First class passenger', role: 'Travelled in a suite\non the upper decks.' },
  { kind: 'steward', name: 'Steward', role: 'Served meals and\nlooked after the cabins.' },
  { kind: 'third', name: 'Third class passenger', role: 'Crossed to America in\na berth below deck.' },
  { kind: 'stoker', name: 'Stoker', role: 'Shovelled coal into\nthe boiler furnaces.' },
  { kind: 'sailor', name: 'Lookout', role: 'Watched the sea from\nthe crow’s nest.' },
];

const SIDE_SPLIT_X = 140;
const MARGIN = 20;
const COLUMN_WIDTH = 228;
const GAP = 10;
const PEOPLE_BLOCK = 266;

export class Callouts {
  constructor(container, svg, onSelect) {
    this.container = container;
    this.svg = svg;
    this.onSelect = onSelect;
    this.items = CALLOUTS.map((data, index) => {
      const element = document.createElement('div');
      element.className = 'callout';
      element.innerHTML = `<b>${data.title}</b><span>${data.text}</span>`;
      element.addEventListener('click', () => this.onSelect(data));
      container.appendChild(element);
      const pin = document.createElement('button');
      pin.className = 'pin';
      pin.textContent = String(index + 1);
      pin.addEventListener('click', () => this.onSelect(data));
      container.appendChild(pin);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('r', '2.6');
      const halo = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      halo.setAttribute('class', 'halo');
      svg.appendChild(halo);
      svg.appendChild(line);
      svg.appendChild(dot);
      return {
        data, element, pin, line, halo, dot,
        side: data.anchor[0] < SIDE_SPLIT_X ? 'left' : 'right',
        screen: new THREE.Vector3(),
        top: null,
        index,
      };
    });
    this.card = document.getElementById('card');
    this.active = this.items[0];
    this.setActive(this.items[0].data);
  }

  setActive(data) {
    this.active = this.items.find((item) => item.data === data);
    this.card.innerHTML = `<b>${this.active.index + 1}. ${data.title}</b><span>${data.text}</span>`;
    this.items.forEach((item) => item.pin.classList.toggle('active', item === this.active));
  }

  update(camera, width, height, titleBottom) {
    const phone = width < 720;
    document.body.classList.toggle('phone', phone);
    for (const item of this.items) {
      item.screen.set(item.data.anchor[0], item.data.anchor[1], item.data.anchor[2]).project(camera);
      item.x = (item.screen.x * 0.5 + 0.5) * width;
      item.y = (-item.screen.y * 0.5 + 0.5) * height;
    }
    if (phone) {
      this.layoutPins(width, height);
      return;
    }
    const peopleTop = height - PEOPLE_BLOCK;
    for (const side of ['left', 'right']) {
      const minTop = side === 'left' ? titleBottom + 14 : MARGIN;
      const maxBottom = peopleTop - 10;
      const left = side === 'left' ? MARGIN : width - MARGIN - COLUMN_WIDTH;
      const startX = side === 'left' ? left + COLUMN_WIDTH - 6 : left - 6;
      const layout = (order) => {
        const tops = order.map((item) => Math.max(minTop, item.y - 16));
        for (let i = 1; i < order.length; i++) {
          tops[i] = Math.max(tops[i], tops[i - 1] + order[i - 1].element.offsetHeight + GAP);
        }
        const last = order.length - 1;
        if (last >= 0 && tops[last] + order[last].element.offsetHeight > maxBottom) {
          tops[last] = maxBottom - order[last].element.offsetHeight;
          for (let i = last - 1; i >= 0; i--) {
            tops[i] = Math.min(tops[i], tops[i + 1] - GAP - order[i].element.offsetHeight);
          }
        }
        return tops;
      };
      // Sort by the anchor's screen y, then swap any two slots whose leaders would cross.
      const frozenSide = this.frozen && this.frozen[side];
      let order = this.items.filter((item) => item.side === side).sort((a, b) => a.y - b.y);
      let tops = layout(order);
      for (let pass = 0; pass < 40; pass++) {
        let swapped = false;
        for (let i = 0; i < order.length && !swapped; i++) {
          for (let j = i + 1; j < order.length && !swapped; j++) {
            const a = [startX, tops[i] + 11, order[i].x, order[i].y];
            const b = [startX, tops[j] + 11, order[j].x, order[j].y];
            if (segmentsCross(a, b)) {
              [order[i], order[j]] = [order[j], order[i]];
              tops = layout(order);
              swapped = true;
            }
          }
        }
        if (!swapped) break;
      }
      if (frozenSide) {
        order = frozenSide.order;
        tops = frozenSide.tops;
      } else if (this.locked) {
        if (this.orbitSamples) {
          order = this.bestOrderOverOrbit(order, layout, startX);
          tops = layout(order);
        }
        this.frozen = this.frozen || {};
        this.frozen[side] = { order: [...order], tops: [...tops] };
        this.lastLayout = this.lastLayout || {};
        this.lastLayout[side] = { startX };
      }
      order.forEach((item, i) => {
        item.top = (this.locked || item.top === null) ? tops[i] : item.top + (tops[i] - item.top) * 0.35;
        item.element.style.transform = `translate(${left}px, ${item.top}px)`;
        const startY = item.top + 11;
        const elbowX = side === 'left' ? startX + 22 : startX - 22;
        const points = `${startX},${startY} ${elbowX},${startY} ${item.x},${item.y}`;
        item.halo.setAttribute('points', points);
        item.line.setAttribute('points', points);
        item.dot.setAttribute('cx', item.x);
        item.dot.setAttribute('cy', item.y);
      });
    }
  }

  // Freeze the column assignment (reel shots): text stays in its slot, only the leader ends follow the camera.
  // samples: optional anchor screen positions at several camera azimuths of the planned orbit, as
  // arrays of { x, y } indexed like this.items. The frozen order is then the one that crosses least over all of them.
  lock(on, samples = null) {
    this.locked = on;
    this.orbitSamples = on ? samples : null;
    if (!on) this.frozen = null;
  }

  // Try every slot order of one column; keep the one with the fewest leader crossings over the whole orbit,
  // and among equals the shortest leaders.
  bestOrderOverOrbit(order, layout, startX) {
    const indices = order.map((item) => item.index);
    let best = null;
    const permute = (prefix, rest) => {
      if (rest.length === 0) {
        const candidate = prefix.map((index) => this.items[index]);
        const tops = layout(candidate);
        let crossings = 0;
        let length = 0;
        for (const sample of this.orbitSamples) {
          const segments = candidate.map((item, slot) => [startX, tops[slot] + 11, sample[item.index].x, sample[item.index].y]);
          for (let i = 0; i < segments.length; i++) {
            length += Math.abs(segments[i][1] - segments[i][3]);
            for (let j = i + 1; j < segments.length; j++) {
              if (segmentsCross(segments[i], segments[j])) crossings += 1;
            }
          }
        }
        if (best === null || crossings < best.crossings || (crossings === best.crossings && length < best.length)) {
          best = { order: candidate, crossings, length };
        }
        return;
      }
      rest.forEach((index, position) => {
        permute([...prefix, index], [...rest.slice(0, position), ...rest.slice(position + 1)]);
      });
    };
    permute([], indices);
    this.bestCrossings = (this.bestCrossings || 0) + best.crossings;
    return best.order;
  }

  // Leader crossings right now, over both columns (the reel recorder checks this on every frame).
  crossings() {
    let count = 0;
    for (const side of ['left', 'right']) {
      const frozenSide = this.frozen && this.frozen[side];
      const info = this.lastLayout && this.lastLayout[side];
      if (!frozenSide || !info) continue;
      const segments = frozenSide.order.map((item, slot) => [info.startX, frozenSide.tops[slot] + 11, item.x, item.y]);
      for (let i = 0; i < segments.length; i++) {
        for (let j = i + 1; j < segments.length; j++) {
          if (segmentsCross(segments[i], segments[j])) count += 1;
        }
      }
    }
    return count;
  }

  // Phone: numbered pins pushed apart so none overlap, each tied to its anchor by a short line.
  layoutPins(width, height) {
    const minDistance = 27;
    const positions = this.items.map((item) => ({ x: item.x, y: item.y }));
    for (let round = 0; round < 80; round++) {
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          let dx = positions[j].x - positions[i].x;
          let dy = positions[j].y - positions[i].y;
          let distance = Math.hypot(dx, dy);
          if (distance >= minDistance) continue;
          if (distance < 0.01) {
            dx = (j - i) * 0.5;
            dy = 1;
            distance = Math.hypot(dx, dy);
          }
          const push = (minDistance - distance) / 2;
          positions[i].x -= (dx / distance) * push;
          positions[i].y -= (dy / distance) * push;
          positions[j].x += (dx / distance) * push;
          positions[j].y += (dy / distance) * push;
        }
      }
      for (const position of positions) {
        position.x = Math.min(width - 16, Math.max(16, position.x));
        position.y = Math.min(height - 150, Math.max(60, position.y));
      }
    }
    this.items.forEach((item, index) => {
      const position = positions[index];
      item.pin.style.transform = `translate(${position.x - 11}px, ${position.y - 11}px)`;
      const points = `${position.x},${position.y} ${item.x},${item.y}`;
      item.halo.setAttribute('points', points);
      item.line.setAttribute('points', points);
      item.dot.setAttribute('cx', item.x);
      item.dot.setAttribute('cy', item.y);
    });
  }
}

function segmentsCross(a, b) {
  const orientation = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const d1 = orientation(a[0], a[1], a[2], a[3], b[0], b[1]);
  const d2 = orientation(a[0], a[1], a[2], a[3], b[2], b[3]);
  const d3 = orientation(b[0], b[1], b[2], b[3], a[0], a[1]);
  const d4 = orientation(b[0], b[1], b[2], b[3], a[2], a[3]);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
