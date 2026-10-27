import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { select, world } from './store.js';
import { orgletStatus } from './simulation.js';
import { cloneAsset, useAssets } from './assets.jsx';

const CARRYING_PHASES = new Set(['pickup', 'toWork', 'toApproval', 'waiting', 'toReview', 'reporting']);
const TURN_RATE = 9;
const LIMB_EASING = 14;

function shortestAngle(from, to) {
  return ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

// The Blender-built orglet (blender/build_office.py): its shell, eyes and card stripe take the orglet's colour,
// and the named pivots Body, LegL, LegR, ArmL, ArmR and Card are posed here every frame.
function useOrgletModel(color) {
  const assets = useAssets();
  return useMemo(() => {
    const model = cloneAsset(assets.orglet, (mesh) => mesh.material.name.startsWith('Tint_'));
    model.traverse((object) => {
      if (object.isMesh && object.material.name.startsWith('Tint_')) {
        object.material.color.set(color);
        if (object.material.name === 'Tint_Glow') {
          object.material.emissive.set(color);
        }
      }
    });
    const part = (name) => model.getObjectByName(name);
    return {
      model,
      body: part('Body'),
      leftLeg: part('LegL'),
      rightLeg: part('LegR'),
      leftArm: part('ArmL'),
      rightArm: part('ArmR'),
      card: part('Card'),
    };
  }, [assets, color]);
}

export function Character({ orglet, isActive }) {
  const root = useRef();
  const { model, body, leftLeg, rightLeg, leftArm, rightArm, card } = useOrgletModel(orglet.color);
  const ring = useRef();
  const pin = useRef();
  const tag = useRef();
  const poseRef = useRef({ leftLeg: 0, rightLeg: 0, leftArm: 0, rightArm: 0, lean: 0, sway: 0 });

  useFrame((_, deltaSeconds) => {
    if (!root.current) {
      return;
    }
    const isWalking = orglet.path.length > 0;
    const isSelected = world.selection?.type === 'orglet' && world.selection.id === orglet.id;
    const status = orgletStatus(orglet);
    root.current.position.set(orglet.position.x, 0.1, orglet.position.z);

    const standingAngle = (orglet.slot?.facing ?? orglet.facing ?? 1) > 0 ? 0 : Math.PI;
    const targetAngle = isWalking ? orglet.heading : standingAngle;
    const turn = shortestAngle(root.current.rotation.y, targetAngle);
    root.current.rotation.y += turn * Math.min(1, deltaSeconds * TURN_RATE);

    orglet.walkCycle += deltaSeconds * (isWalking ? 9 : 0);
    const cycle = orglet.walkCycle;
    const swing = isWalking ? Math.sin(cycle) * 0.6 : 0;
    // Seated at a desk chair while working or reporting; standing at kiosks and while walking.
    const isSeated = !isWalking && (orglet.lead || orglet.phase === 'working' || orglet.phase === 'reporting');
    const isCarrying = CARRYING_PHASES.has(orglet.phase) && orglet.phase !== 'pickup';
    const isTyping = orglet.phase === 'working' || orglet.lead;
    const typing = isTyping ? Math.sin(world.time * 14 + cycle) * 0.15 : 0;

    // Every limb eases toward its target angle, so a change of pose (sit down, pick up the card) blends instead of snapping.
    const easing = 1 - Math.exp(-deltaSeconds * LIMB_EASING);
    const pose = poseRef.current;
    const legTarget = isSeated ? -1.45 : swing;
    const otherLegTarget = isSeated ? -1.45 : -swing;
    const leftArmTarget = isCarrying ? -1.1 : -swing * 0.8 + (isTyping ? -0.9 + typing : 0);
    const rightArmTarget = isCarrying ? -1.1 : swing * 0.8 + (isTyping ? -0.9 - typing : 0);
    // A walker leans slightly forward, a card carrier a bit more, a seated typist toward the desk.
    const leanTarget = isWalking ? (isCarrying ? 0.12 : 0.06) : isSeated ? 0.05 : 0;
    // The body rolls a little toward the planted foot while walking.
    const swayTarget = isWalking ? Math.sin(cycle) * 0.05 : 0;
    pose.leftLeg += (legTarget - pose.leftLeg) * easing;
    pose.rightLeg += (otherLegTarget - pose.rightLeg) * easing;
    pose.leftArm += (leftArmTarget - pose.leftArm) * easing;
    pose.rightArm += (rightArmTarget - pose.rightArm) * easing;
    pose.lean += (leanTarget - pose.lean) * easing;
    pose.sway += (swayTarget - pose.sway) * easing;

    leftLeg.rotation.x = pose.leftLeg;
    rightLeg.rotation.x = pose.rightLeg;
    leftArm.rotation.x = pose.leftArm;
    rightArm.rotation.x = pose.rightArm;
    body.rotation.x = pose.lean;
    body.rotation.z = pose.sway;
    // A smooth double-step bob while walking; a slow breath while standing or sitting.
    const walkBob = (1 - Math.cos(cycle * 2)) * 0.03;
    const breath = Math.sin(world.time * 2 + cycle) * 0.012;
    body.position.y += ((isWalking ? walkBob : breath) - body.position.y) * Math.min(1, easing * 2);
    card.visible = isCarrying;

    ring.current.visible = isSelected;
    if (isSelected) {
      const pulse = 1 + Math.sin(world.time * 4) * 0.06;
      ring.current.scale.set(pulse, pulse, pulse);
    }
    pin.current.visible = status === 'waiting';
    pin.current.position.y = 2.4 + Math.sin(world.time * 3) * 0.08;
    pin.current.rotation.y = -root.current.rotation.y + world.time * 1.5;
    if (tag.current) {
      tag.current.dataset.status = status;
      tag.current.classList.toggle('is-selected', isSelected);
    }
  });

  return (
    <group
      ref={root}
      onClick={(event) => {
        if (event.delta > 5 || !isActive) {
          return;
        }
        event.stopPropagation();
        select({ type: 'orglet', id: orglet.id });
      }}
      onPointerOver={() => {
        if (isActive) {
          document.body.style.cursor = 'pointer';
        }
      }}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.52, 0.66, 40]} />
        <meshStandardMaterial color="#6d4aff" emissive="#6d4aff" emissiveIntensity={1.6} toneMapped={false} transparent opacity={0.9} />
      </mesh>
      {/* Invisible, larger hit target so small figures are easy to click. */}
      <mesh position={[0, 0.7, 0]} visible={false}>
        <cylinderGeometry args={[0.55, 0.55, 1.6, 8]} />
      </mesh>
      <primitive object={model} />
      <group ref={pin} position={[0, 2.05, 0]}>
        <mesh position={[0, 0.18, 0]}>
          <sphereGeometry args={[0.2, 20, 14]} />
          <meshStandardMaterial color="#ffb020" emissive="#ffb020" emissiveIntensity={0.9} toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.06, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.13, 0.26, 16]} />
          <meshStandardMaterial color="#ffb020" emissive="#ffb020" emissiveIntensity={0.9} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.18, 0.19]}>
          <circleGeometry args={[0.08, 16]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>
      <Html position={[0, 1.85, 0]} center zIndexRange={[6, 0]} pointerEvents="none">
        <div ref={tag} className="unit-tag" hidden={!isActive}>
          {orglet.name}
        </div>
      </Html>
    </group>
  );
}
