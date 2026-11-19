// Player controller: Rafi Sol locomotion, camera controller, vehicle enter/exit, and life cycle.
import * as THREE from 'three';
import { PLAYER_CONFIG, STEP } from './config.js';
import { updatePlayerPhysics, distSq, lerp, clamp } from './physics.js';
import { buildPedestrianMesh } from './pedestrians.js';

export function createPlayer(x = 180, z = 240) {
  const player = {
    x,
    z,
    y: 0,
    facingAngle: 0,
    walkSpeed: PLAYER_CONFIG.walkSpeed,
    sprintSpeed: PLAYER_CONFIG.sprintSpeed,
    radius: PLAYER_CONFIG.radius,
    hp: PLAYER_CONFIG.maxHealth,
    maxHp: PLAYER_CONFIG.maxHealth,
    stamina: PLAYER_CONFIG.maxStamina,
    maxStamina: PLAYER_CONFIG.maxStamina,
    staminaDrain: PLAYER_CONFIG.staminaDrain,
    staminaRegen: PLAYER_CONFIG.staminaRegen,
    isSprinting: false,
    isMoving: false,
    inVehicle: false,
    vehicle: null,
    mesh: null,
    cameraYaw: 0,
    cameraPitch: 0.28,
    cameraDist: 6.5,
    cameraOverride: null,
    screenShake: 0,
    state: 'alive', // 'alive', 'wasted', 'busted'
    respawnTimer: 0,
    cash: 500,
    score: 0,
    walkCycle: 0,
  };

  // Build Rafi Sol 3D model
  const pedData = { shirtColor: '#38bdf8' }; // Sol blue shirt
  player.mesh = buildPedestrianMesh(pedData);

  return player;
}

export function updatePlayer(player, input, buildings, vehicles, camera, dt = STEP) {
  if (player.state === 'wasted' || player.state === 'busted') {
    player.respawnTimer -= dt;
    return;
  }

  // Camera Orbit controls
  if (input.lookX !== undefined) {
    player.cameraYaw += (input.lookX || 0) * 0.0028;
  }
  if (input.lookY !== undefined) {
    player.cameraPitch = clamp(player.cameraPitch + (input.lookY || 0) * 0.002, 0.05, 0.85);
  }

  // Camera Shake decay
  if (player.screenShake > 0) {
    player.screenShake = Math.max(0, player.screenShake - 8.0 * dt);
  }

  if (player.inVehicle && player.vehicle) {
    // Player inside vehicle
    const v = player.vehicle;
    player.x = v.x;
    player.z = v.z;
    player.facingAngle = v.angle;

    // Hide on-foot mesh
    if (player.mesh) player.mesh.visible = false;

    // Check exit vehicle input (E key or Action)
    if (input.interactJustPressed) {
      exitVehicle(player);
    }

    // Camera smoothly trails vehicle
    const targetCamYaw = v.angle + Math.PI;
    player.cameraYaw = lerp(player.cameraYaw, targetCamYaw, 6 * dt);
    const speedZoom = clamp(Math.abs(v.speed) / v.spec.topSpeed, 0, 1) * 3.5;
    const targetCamDist = 7.5 + speedZoom;
    player.cameraDist = lerp(player.cameraDist, targetCamDist, 5 * dt);

    const camX = v.x + Math.sin(player.cameraYaw) * player.cameraDist;
    const camZ = v.z + Math.cos(player.cameraYaw) * player.cameraDist;
    const camY = 3.2 + Math.sin(player.cameraPitch) * player.cameraDist * 0.5;

    camera.position.set(
      camX + (Math.random() - 0.5) * player.screenShake,
      camY + (Math.random() - 0.5) * player.screenShake,
      camZ + (Math.random() - 0.5) * player.screenShake
    );
    camera.lookAt(v.x, v.y + 1.2, v.z);
  } else {
    // Player on foot
    if (player.mesh) player.mesh.visible = true;

    // Update on-foot physics
    updatePlayerPhysics(
      player,
      {
        moveX: input.moveX,
        moveY: input.moveY,
        sprint: input.sprint,
        cameraYaw: player.cameraYaw,
      },
      buildings,
      vehicles
    );

    // Sync 3D mesh
    if (player.mesh) {
      player.mesh.position.set(player.x, player.y, player.z);
      player.mesh.rotation.y = player.facingAngle;

      if (player.isMoving) {
        player.walkCycle += (player.isSprinting ? 12 : 7) * dt;
        const legAngle = Math.sin(player.walkCycle) * (player.isSprinting ? 0.9 : 0.55);
        if (player.mesh.children[3] && player.mesh.children[4]) {
          player.mesh.children[3].rotation.x = legAngle;
          player.mesh.children[4].rotation.x = -legAngle;
        }
      } else {
        if (player.mesh.children[3] && player.mesh.children[4]) {
          player.mesh.children[3].rotation.x = 0;
          player.mesh.children[4].rotation.x = 0;
        }
      }
    }

    // Check enter vehicle (E key near driver door)
    if (input.interactJustPressed && vehicles) {
      let nearestVehicle = null;
      let minDSq = 4.0 * 4.0;

      for (let i = 0; i < vehicles.length; i++) {
        const v = vehicles[i];
        if (!v.active) continue;
        const dSq = distSq(player.x, player.z, v.x, v.z);
        if (dSq < minDSq) {
          minDSq = dSq;
          nearestVehicle = v;
        }
      }

      if (nearestVehicle) {
        enterVehicle(player, nearestVehicle);
      }
    }

    // Camera smoothly follows player
    player.cameraDist = lerp(player.cameraDist, 5.2, 5 * dt);
    const camX = player.x + Math.sin(player.cameraYaw) * player.cameraDist;
    const camZ = player.z + Math.cos(player.cameraYaw) * player.cameraDist;
    const camY = 2.2 + Math.sin(player.cameraPitch) * player.cameraDist * 0.45;

    camera.position.set(
      camX + (Math.random() - 0.5) * player.screenShake,
      camY + (Math.random() - 0.5) * player.screenShake,
      camZ + (Math.random() - 0.5) * player.screenShake
    );
    camera.lookAt(player.x, player.y + 1.2, player.z);
  }

  // Explicit camera override support (for screenshot staging & cutscenes)
  if (player.cameraOverride) {
    camera.position.set(
      player.cameraOverride.x,
      player.cameraOverride.y,
      player.cameraOverride.z
    );
    camera.lookAt(
      player.cameraOverride.lookAtX,
      player.cameraOverride.lookAtY,
      player.cameraOverride.lookAtZ
    );
  }
}

export function enterVehicle(player, vehicle) {
  if (player.inVehicle || !vehicle || !vehicle.active) return false;
  player.inVehicle = true;
  player.vehicle = vehicle;
  vehicle.isPlayer = true;
  vehicle.isParked = false;
  player.cameraDist = 8.5;
  player.cameraPitch = 0.22;
  return true;
}

export function exitVehicle(player) {
  if (!player.inVehicle || !player.vehicle) return false;
  const v = player.vehicle;

  // Exit on driver side
  const exitOffset = v.spec.width * 0.75 + 0.8;
  player.x = v.x + Math.cos(v.angle) * exitOffset;
  player.z = v.z - Math.sin(v.angle) * exitOffset;
  player.y = 0;
  player.facingAngle = v.angle;

  v.isPlayer = false;
  player.inVehicle = false;
  player.vehicle = null;
  player.cameraDist = 5.2;
  player.cameraPitch = 0.28;
  return true;
}

export function respawnPlayer(player, pos) {
  player.x = pos.x;
  player.z = pos.z;
  player.y = 0;
  player.hp = player.maxHp;
  player.stamina = player.maxStamina;
  player.state = 'alive';
  player.inVehicle = false;
  player.vehicle = null;
  player.facingAngle = 0;
  player.cameraYaw = 0;
  player.cameraPitch = 0.28;
}
