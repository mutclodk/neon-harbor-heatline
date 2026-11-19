// Pedestrian crowd system: procedural 3D humanoids, sidewalk pathing, and reaction AI.
import * as THREE from 'three';
import { STEP } from './config.js';
import { distSq, lerp } from './physics.js';

let nextPedId = 1;

export function createPedestrian(x, z, angle = 0, shirtColor = null) {
  const id = nextPedId++;
  const colors = ['#f43f5e', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#f8fafc', '#d97706'];
  const shirt = shirtColor || colors[Math.floor(Math.random() * colors.length)];

  return {
    id,
    x,
    z,
    y: 0,
    angle,
    speed: 1.4, // m/s walking
    state: 'wander', // 'wander', 'flee', 'down'
    panicTimer: 0,
    targetX: x,
    targetZ: z,
    hp: 40,
    active: true,
    shirtColor: shirt,
    walkCycle: Math.random() * Math.PI * 2,
    mesh: null,
    leftLeg: null,
    rightLeg: null,
    leftArm: null,
    rightArm: null,
  };
}

// Procedural 3D humanoid mesh
export function buildPedestrianMesh(ped) {
  const group = new THREE.Group();

  const skinMat = new THREE.MeshLambertMaterial({ color: 0xfbcfe8 });
  const shirtMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(ped.shirtColor) });
  const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
  const hairMat = new THREE.MeshLambertMaterial({ color: 0x18181b });

  // Torso
  const torsoGeom = new THREE.BoxGeometry(0.42, 0.55, 0.22);
  const torso = new THREE.Mesh(torsoGeom, shirtMat);
  torso.position.y = 0.98;
  torso.castShadow = true;
  group.add(torso);

  // Head
  const headGeom = new THREE.BoxGeometry(0.24, 0.26, 0.24);
  const head = new THREE.Mesh(headGeom, skinMat);
  head.position.y = 1.42;
  head.castShadow = true;
  group.add(head);

  // Hair / Cap
  const hairGeom = new THREE.BoxGeometry(0.26, 0.1, 0.26);
  const hair = new THREE.Mesh(hairGeom, hairMat);
  hair.position.y = 1.54;
  group.add(hair);

  // Legs
  const legGeom = new THREE.BoxGeometry(0.16, 0.65, 0.16);
  legGeom.translate(0, -0.32, 0); // pivot at hip

  const leftLeg = new THREE.Mesh(legGeom, pantsMat);
  leftLeg.position.set(-0.11, 0.7, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeom, pantsMat);
  rightLeg.position.set(0.11, 0.7, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  // Arms
  const armGeom = new THREE.BoxGeometry(0.12, 0.5, 0.12);
  armGeom.translate(0, -0.25, 0); // pivot at shoulder

  const leftArm = new THREE.Mesh(armGeom, shirtMat);
  leftArm.position.set(-0.28, 1.2, 0);
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeom, shirtMat);
  rightArm.position.set(0.28, 1.2, 0);
  group.add(rightArm);

  ped.mesh = group;
  ped.leftLeg = leftLeg;
  ped.rightLeg = rightLeg;
  ped.leftArm = leftArm;
  ped.rightArm = rightArm;

  return group;
}

// Update pedestrian simulation
export function updatePedestrians(pedestrians, player, vehicles, rng) {
  const dt = STEP;

  for (let i = 0; i < pedestrians.length; i++) {
    const ped = pedestrians[i];
    if (!ped.active) continue;

    if (ped.state === 'down') {
      // Fallen down
      if (ped.mesh) {
        ped.mesh.rotation.x = lerp(ped.mesh.rotation.x, -Math.PI / 2, 8 * dt);
        ped.mesh.position.y = lerp(ped.mesh.position.y, 0.1, 8 * dt);
      }
      continue;
    }

    // Reaction check against player and moving vehicles
    let shouldPanic = false;
    let threatX = 0;
    let threatZ = 0;

    for (let vIdx = 0; vIdx < vehicles.length; vIdx++) {
      const v = vehicles[vIdx];
      if (!v.active) continue;

      const dSq = distSq(ped.x, ped.z, v.x, v.z);
      if (dSq < 18 * 18 && Math.abs(v.speed) > 5.0) {
        shouldPanic = true;
        threatX = v.x;
        threatZ = v.z;
        break;
      }
    }

    if (shouldPanic) {
      ped.state = 'flee';
      ped.panicTimer = 4.0;
      // Flee away from threat
      ped.angle = Math.atan2(ped.x - threatX, ped.z - threatZ);
      ped.speed = 4.5; // sprinting in fear
    } else if (ped.panicTimer > 0) {
      ped.panicTimer -= dt;
      if (ped.panicTimer <= 0) {
        ped.state = 'wander';
        ped.speed = 1.4;
      }
    }

    // Movement step
    ped.x += Math.sin(ped.angle) * ped.speed * dt;
    ped.z += Math.cos(ped.angle) * ped.speed * dt;

    // Boundary wrap or wander turnaround
    if (rng.next() > 0.985 && ped.state === 'wander') {
      ped.angle += (rng.next() - 0.5) * 1.5;
    }

    // Walking animation
    ped.walkCycle += ped.speed * 4.5 * dt;
    if (ped.leftLeg && ped.rightLeg) {
      const legAngle = Math.sin(ped.walkCycle) * 0.6;
      ped.leftLeg.rotation.x = legAngle;
      ped.rightLeg.rotation.x = -legAngle;
      ped.leftArm.rotation.x = -legAngle * 0.7;
      ped.rightArm.rotation.x = legAngle * 0.7;
    }

    if (ped.mesh) {
      ped.mesh.position.set(ped.x, ped.y, ped.z);
      ped.mesh.rotation.y = ped.angle;
    }
  }
}
