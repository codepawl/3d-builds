import * as THREE from 'three';
import { BAG_VARIANTS } from '../sim/simulation.js';

const HERO_COLOR = new THREE.Color('#ff2b8a');
const BELT_SPEED_BY_NODE = {
  checkin_desk_belt: 1.0,
  ct_scanner_belt: 2.4,
  carousel_makeup_belt: 0.8,
  belt_loader_belt: 0.6,
};
const BOOM_ANGLE = 0.435;
const HOLD_DOOR_ANGLE = -1.22;
const CONTAINER_DOOR_ANGLE = -1.74;

const lerp = (from, to, fraction) => from + (to - from) * fraction;

function lerpAngle(from, to, fraction) {
  let difference = to - from;
  while (difference > Math.PI) difference -= 2 * Math.PI;
  while (difference < -Math.PI) difference += 2 * Math.PI;
  return from + difference * fraction;
}

function smoothstep(value) {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}

// Builds every Blender model into one scene graph and returns an update function the render loop calls.
export function createPlant(scenes, sim) {
  const world = sim.world;
  const root = new THREE.Group();
  root.name = 'plant';
  const beltMaterials = new Map();
  const beltTextures = [];
  const pickableUnits = new Map();

  function nodeTemplate(assetKey, nodeName) {
    const node = scenes[assetKey].getObjectByName(nodeName);
    if (!node) throw new Error(`Missing node ${nodeName} in ${assetKey}`);
    return node;
  }

  function beltMaterialFor(baseMaterial, speed, reversed) {
    const key = `${speed}|${reversed}`;
    if (!beltMaterials.has(key)) {
      const material = baseMaterial.clone();
      if (baseMaterial.map) {
        material.map = baseMaterial.map.clone();
        material.map.wrapS = THREE.RepeatWrapping;
        material.map.wrapT = THREE.RepeatWrapping;
        material.map.needsUpdate = true;
        beltTextures.push({ texture: material.map, speed, reversed });
      }
      beltMaterials.set(key, material);
    }
    return beltMaterials.get(key);
  }

  function prepare(object, beltSpeed, reversed) {
    object.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material && child.material.name === 'belt_rubber') {
        const speed = BELT_SPEED_BY_NODE[child.name] ?? beltSpeed ?? 1;
        child.material = beltMaterialFor(child.material, speed, reversed);
      }
      if (child.name.startsWith('chute_lamp') || child.name.startsWith('ct_lamp') || child.name.startsWith('read_arch_lamp')) {
        child.material = child.material.clone();
      }
    });
    return object;
  }

  function place(module) {
    const group = nodeTemplate(module.asset, module.node).clone(true);
    prepare(group, module.belt?.speed, module.belt?.reversed ?? false);
    group.position.set(module.position[0], module.position[1], module.position[2]);
    group.rotation.y = module.yaw;
    group.userData.unitId = module.unit;
    root.add(group);
    if (module.unit) pickableUnits.set(module.unit, group);
    return group;
  }

  // ---- Static modules ---------------------------------------------------------------------
  const placed = new Map();
  const allModules = [...world.modules, ...world.ramp.modules];
  allModules.forEach((module) => {
    const group = place(module);
    placed.set(module, group);
  });
  const supportMaterial = new THREE.MeshStandardMaterial({ color: '#39424d', roughness: 0.7 });
  world.supports.forEach((support) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, support.height, 0.1), supportMaterial);
    leg.position.set(support.x, support.height / 2, support.z);
    leg.castShadow = true;
    root.add(leg);
  });

  const find = (unitId) => pickableUnits.get(unitId);
  // Lower the search room walls so the table inside reads from the camera.
  find('search-room').scale.y = 0.55;
  const scanner = find('ct-1');
  const gantry = scanner.getObjectByName('ct_gantry');
  const arch = find('arch-1');
  const paddle = find('diverter-1').getObjectByName('diverter_paddle_arm');
  const loaderGroup = find('loader-1');
  const boom = loaderGroup.getObjectByName('belt_loader_boom');
  boom.rotation.x = -BOOM_ANGLE;
  const aircraft = find('aircraft-1');
  aircraft.getObjectByName('aircraft_hold_door').rotation.z = HOLD_DOOR_ANGLE;
  // The wings hide the hold door from the camera, so they go about 30 percent opaque.
  aircraft.traverse((child) => {
    const fadedMaterials = ['aircraft_wing', 'engine_grey', 'engine_inlet'];
    if (child.isMesh && fadedMaterials.includes(child.material.name)) {
      child.material = child.material.clone();
      child.material.transparent = true;
      child.material.opacity = child.material.name === 'aircraft_wing' ? 0.32 : 0.25;
      child.material.depthWrite = false;
      child.castShadow = false;
    }
  });
  const crane = allModules
    .filter((module) => module.node === 'ebs_crane')
    .map((module) => placed.get(module));
  const craneGroup = nodeTemplate('logistics', 'ebs_crane').clone(true);
  prepare(craneGroup);
  craneGroup.position.set(-8, 0, 7.9);
  craneGroup.userData.unitId = 'store-crane';
  root.add(craneGroup);
  pickableUnits.set('store-crane', craneGroup);
  void crane;
  const craneCarriage = craneGroup.getObjectByName('ebs_crane_carriage');

  // Containers: some with the curtain raised.
  world.ramp.uldSpots.forEach((_, index) => {
    const group = find(`uld-${index + 1}`);
    const door = group.children.find((child) => child.name.endsWith('_door'));
    if (door) door.rotation.x = index % 2 === 0 ? CONTAINER_DOOR_ANGLE * 0.8 : 0;
  });

  // Handlers
  const handlers = world.ramp.handlers.map((handler, index) => {
    const group = nodeTemplate('ramp', handler.node).clone(true);
    prepare(group);
    group.position.set(handler.position[0], handler.position[1], handler.position[2]);
    group.rotation.y = handler.yaw;
    root.add(group);
    return { group, base: handler.yaw, index };
  });

  // ---- Trays ------------------------------------------------------------------------------
  const trayObjects = [];
  for (let index = 0; index < sim.trayCount; index += 1) {
    const colour = index % 2 === 0 ? 'tilt_blue' : 'tilt_grey';
    const group = nodeTemplate('sorter', colour).clone(true);
    prepare(group);
    group.userData.unitId = `tray-${index}`;
    root.add(group);
    trayObjects.push({ group, deck: group.getObjectByName(`${colour}_deck`) });
    pickableUnits.set(`tray-${index}`, group);
  }

  // ---- Tug trains -------------------------------------------------------------------------
  const trainObjects = sim.trainParts.map((part) => {
    let nodeName;
    if (part.part === 0) nodeName = part.train % 2 === 0 ? 'baggage_tug_blue' : 'baggage_tug_teal';
    else nodeName = part.part === 1 ? 'dolly_uld' : 'dolly_bag';
    const group = nodeTemplate('ramp', nodeName).clone(true);
    prepare(group);
    group.userData.unitId = part.part === 0 ? `tug-${part.train + 1}` : undefined;
    const wheels = [];
    group.traverse((child) => {
      if (child.name.includes('_wheel_')) wheels.push(child);
    });
    root.add(group);
    if (part.part === 0) pickableUnits.set(`tug-${part.train + 1}`, group);
    // A container rides on the first dolly.
    if (part.part === 1) {
      const container = nodeTemplate('logistics', part.train % 2 === 0 ? 'uld_ld3_grey' : 'uld_ld3_blue').clone(true);
      prepare(container);
      container.position.set(0, 0.47, 0.1);
      container.rotation.y = Math.PI / 2;
      group.add(container);
      const door = container.children.find((child) => child.name.endsWith('_door'));
      if (door) door.rotation.x = CONTAINER_DOOR_ANGLE * 0.6;
    }
    // Loose bags ride on the bag dolly.
    if (part.part === 2) {
      for (let index = 0; index < 6; index += 1) {
        const bag = nodeTemplate('bags', BAG_VARIANTS[(index + part.train * 3) % BAG_VARIANTS.length].node).clone(true);
        bag.traverse((child) => {
          if (child.isMesh) child.castShadow = true;
        });
        bag.position.set(index % 2 ? 0.45 : -0.45, 0.5, 0.2 + Math.floor(index / 2) * 0.9);
        bag.rotation.y = Math.PI / 2 + index * 0.4;
        group.add(bag);
      }
    }
    return { group, wheels, part };
  });

  // ---- Bags -------------------------------------------------------------------------------
  const bagGroup = new THREE.Group();
  bagGroup.name = 'bags';
  root.add(bagGroup);
  const bagPool = BAG_VARIANTS.map(() => []);
  const heroMaterials = new Map();

  function heroVariant(variantIndex) {
    const template = nodeTemplate('bags', BAG_VARIANTS[variantIndex].node).clone(true);
    template.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      if (child.material.name.endsWith('_shell') || child.material.name.endsWith('_cloth')) {
        if (!heroMaterials.has(child.material)) {
          const material = child.material.clone();
          material.color.copy(HERO_COLOR);
          material.emissive.copy(HERO_COLOR);
          material.emissiveIntensity = 0.35;
          heroMaterials.set(child.material, material);
        }
        child.material = heroMaterials.get(child.material);
      }
    });
    return template;
  }

  function acquireBag(variantIndex, hero) {
    const pool = bagPool[variantIndex];
    let object = hero ? null : pool.pop();
    if (!object) {
      object = hero ? heroVariant(variantIndex) : nodeTemplate('bags', BAG_VARIANTS[variantIndex].node).clone(true);
      object.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      object.rotation.order = 'YXZ';
    }
    object.userData.hero = hero;
    bagGroup.add(object);
    return object;
  }

  function releaseBag(object, variantIndex) {
    bagGroup.remove(object);
    if (!object.userData.hero) bagPool[variantIndex].push(object);
  }

  const bagObjects = new Map();
  const flagMarkers = [];
  const flagTemplate = nodeTemplate('screening', 'bag_flag_marker');
  for (let index = 0; index < 4; index += 1) {
    const marker = flagTemplate.clone(true);
    marker.visible = false;
    root.add(marker);
    flagMarkers.push(marker);
  }

  function applyBagPose(object, previous, current, alpha) {
    object.position.set(lerp(previous[0], current[0], alpha), lerp(previous[1], current[1], alpha), lerp(previous[2], current[2], alpha));
    const yaw = lerpAngle(previous[3], current[3], alpha);
    object.rotation.set(lerp(previous[4], current[4], alpha), yaw, lerp(previous[6], current[6], alpha));
    const scale = lerp(previous[5], current[5], alpha);
    object.scale.setScalar(scale);
  }

  // ---- Per-frame update -------------------------------------------------------------------
  const scratchPosition = new THREE.Vector3();
  const interpolatedPositions = new Map();

  function setEmissive(parent, name, intensity) {
    const node = parent.getObjectByName(name);
    if (node && node.material) node.material.emissiveIntensity = intensity;
  }

  function update(alpha) {
    const signals = sim.signals;
    const time = sim.time + alpha * (1 / 60);

    // Belts
    for (const entry of beltTextures) {
      const offset = -time * entry.speed * (entry.reversed ? -1 : 1);
      entry.texture.offset.x = offset % 1;
    }

    // Trays
    sim.trays.forEach((pose, index) => {
      const object = trayObjects[index];
      object.group.position.set(lerp(pose.previous[0], pose.current[0], alpha), 0, lerp(pose.previous[2], pose.current[2], alpha));
      object.group.rotation.y = lerpAngle(pose.previous[3], pose.current[3], alpha);
      object.deck.rotation.x = lerp(pose.previous[4], pose.current[4], alpha);
    });

    // Bags: sync pooled objects with the active entries.
    const live = new Set();
    interpolatedPositions.clear();
    const handleEntry = (entry, key, hero) => {
      live.add(key);
      let object = bagObjects.get(key);
      if (!object) {
        object = acquireBag(entry.variant, hero);
        object.userData.bagKey = key;
        object.userData.planId = entry.plan ? entry.plan.id : undefined;
        bagObjects.set(key, object);
      }
      applyBagPose(object, entry.previous, entry.current, alpha);
      if (entry.plan) {
        interpolatedPositions.set(entry.plan.id, object.position);
      }
    };
    for (const entry of sim.activeEntries) handleEntry(entry, `p${entry.id}`, entry.plan.hero);
    for (const entry of sim.ambientBags) handleEntry(entry, entry.id, false);
    for (const [key, object] of bagObjects) {
      if (!live.has(key)) {
        const variantIndex = BAG_VARIANTS.findIndex((variant) => object.name === variant.node);
        releaseBag(object, variantIndex < 0 ? 0 : variantIndex);
        bagObjects.delete(key);
      }
    }

    // Flag markers float over bags the scanner rejected.
    let markerIndex = 0;
    for (const entry of sim.activeEntries) {
      const plan = entry.plan;
      if (plan.flagged && time >= plan.ctExitTime && time < plan.clearedTime && markerIndex < flagMarkers.length) {
        const marker = flagMarkers[markerIndex];
        marker.visible = true;
        const object = bagObjects.get(`p${entry.id}`);
        if (object) marker.position.set(object.position.x, object.position.y + 0.75 + Math.sin(time * 4) * 0.05, object.position.z);
        markerIndex += 1;
      }
    }
    for (; markerIndex < flagMarkers.length; markerIndex += 1) flagMarkers[markerIndex].visible = false;

    // Machines
    gantry.rotation.x = signals.scanning ? signals.gantryPhase * Math.PI * 2 : gantry.rotation.x;
    setEmissive(scanner, 'ct_lamp_idle', signals.scanning || signals.scanResultAge < 1.2 ? 0.2 : 3);
    setEmissive(scanner, 'ct_lamp_scanning', signals.scanning ? 3.5 : 0.2);
    setEmissive(scanner, 'ct_lamp_clear', !signals.scanning && signals.scanResultAge < 1.2 && signals.scanResult === 'clear' ? 3.5 : 0.2);
    setEmissive(scanner, 'ct_lamp_alarm', !signals.scanning && signals.scanResultAge < 1.2 && signals.scanResult === 'alarm' ? 3.5 : 0.2);
    const archFlash = signals.archPhase < 0.6;
    setEmissive(arch, 'read_arch_lamp_idle', archFlash ? 0.2 : 2.5);
    setEmissive(arch, 'read_arch_lamp_ok', archFlash && !signals.archNoRead ? 3.5 : 0.2);
    setEmissive(arch, 'read_arch_lamp_noread', archFlash && signals.archNoRead ? 3.5 : 0.2);
    const swing = signals.paddleAge / 1.33;
    paddle.rotation.y = swing >= 0 && swing < 1 ? -0.95 * (swing < 0.2 ? smoothstep(swing / 0.2) : swing < 0.7 ? 1 : 1 - smoothstep((swing - 0.7) / 0.3)) : 0;
    craneGroup.position.x = signals.craneX;
    craneCarriage.position.y = 0.4 + 3.0 * signals.craneLift;

    world.chutes.forEach((chute, index) => {
      const group = pickableUnits.get(`chute-${chute.id}`);
      const count = signals.chuteCounts[index];
      const full = count % 24 > 20;
      const closed = index === 6;
      setEmissive(group, 'chute_lamp_open', closed || full ? 0.2 : 3);
      setEmissive(group, 'chute_lamp_full', full && !closed ? 3.5 : 0.2);
      setEmissive(group, 'chute_lamp_closed', closed ? 3.5 : 0.2);
    });

    // Tug trains
    trainObjects.forEach((item) => {
      const pose = item.part;
      const x = lerp(pose.previous[0], pose.current[0], alpha);
      const z = lerp(pose.previous[2], pose.current[2], alpha);
      item.group.position.set(x, 0, z);
      item.group.rotation.y = lerpAngle(pose.previous[3], pose.current[3], alpha) + Math.PI / 2;
      const roll = lerp(pose.previous[4], pose.current[4], alpha);
      for (const wheel of item.wheels) wheel.rotation.x = roll;
    });

    handlers.forEach((handler) => {
      handler.group.rotation.y = handler.base + Math.sin(time * 1.2 + handler.index) * 0.18;
      handler.group.position.y = 0.25 + Math.max(0, Math.sin(time * 2.4 + handler.index * 2)) * 0.03;
    });
  }

  // World position of something, for the camera and the cards. Prefers the drawn (interpolated) position.
  function positionOfBag(planId) {
    return interpolatedPositions.get(planId);
  }

  function boundsOfUnit(unitId) {
    const object = pickableUnits.get(unitId);
    if (!object) return null;
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    return { size, centre, object };
  }

  function pick(raycaster) {
    const hits = raycaster.intersectObject(root, true);
    for (const hit of hits) {
      let object = hit.object;
      while (object) {
        if (object.userData.planId !== undefined) return { kind: 'bag', planId: object.userData.planId };
        if (object.userData.unitId) return { kind: 'unit', unitId: object.userData.unitId };
        object = object.parent;
      }
    }
    return null;
  }

  void scratchPosition;
  return { root, update, positionOfBag, boundsOfUnit, pick, pickableUnits };
}
