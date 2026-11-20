import { CONFIG } from './config.js';
import { makeRng, deriveSeed } from './random.js';
import { updateTraffic, updatePedestrians, updatePolice, updateWanted, addHeat } from './ai.js';

/**
 * Helper to clamp a numeric value within [min, max].
 */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Helper to normalize an angle into [-PI, PI].
 */
function normalizeAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Appends an event to the world's event queue.
 */
export function addEvent(world, type, payload = {}) {
  const event = {
    tick: world.tick,
    type,
    ...payload
  };
  world.events.push(event);
  return event;
}

/**
 * Creates and initializes the simulation world state object.
 */
export function createWorld(city, config = CONFIG, seed = (config?.citySeed ?? 20261124)) {
  const cfg = config || CONFIG;

  const trafficSeed = deriveSeed(seed, 1001);
  const pedestrianSeed = deriveSeed(seed, 1002);
  const eventSeed = deriveSeed(seed, 1003);

  const harbourLandmark = city?.landmarks?.harbourCraneYard || city?.landmarks?.harbour || { x: 200, z: 100 };
  const harbourX = harbourLandmark.x ?? 200;
  const harbourZ = harbourLandmark.z ?? 100;

  const player = {
    x: harbourX,
    z: harbourZ + 4,
    heading: 0,
    health: 100,
    stamina: cfg.playerOnFoot?.stamina ?? 100,
    mode: 'foot',
    vehicleId: null
  };

  const vehicles = [];
  let nextVehicleId = 1;

  // Starter car (Dockmaster truck, index 4) parked by Old Harbor
  const starterClassIndex = 4;
  const starterClass = cfg.vehicles[starterClassIndex] || cfg.vehicles[0];
  const starterCar = {
    id: nextVehicleId++,
    classIndex: starterClassIndex,
    kind: 'parked',
    x: harbourX + 6,
    z: harbourZ,
    heading: 0,
    speed: 0,
    health: starterClass.health,
    bodyColour: starterClass.bodyColour,
    driverAi: null,
    isPlayerOwned: true,
    isWreck: false,
    isSmoking: false
  };
  vehicles.push(starterCar);

  // Parked vehicles from city data
  if (city.parkedCars && Array.isArray(city.parkedCars)) {
    for (let i = 0; i < city.parkedCars.length; i++) {
      const pCar = city.parkedCars[i];
      const classIdx = pCar.vehicleClassIndex ?? 0;
      const vClass = cfg.vehicles[classIdx] || cfg.vehicles[0];
      const px = pCar.x ?? pCar.position?.x ?? 0;
      const pz = pCar.z ?? pCar.position?.z ?? 0;

      vehicles.push({
        id: nextVehicleId++,
        classIndex: classIdx,
        kind: 'parked',
        x: px,
        z: pz,
        heading: pCar.heading ?? 0,
        speed: 0,
        health: vClass.health,
        bodyColour: vClass.bodyColour,
        driverAi: null,
        isPlayerOwned: false,
        isWreck: false,
        isSmoking: false
      });
    }
  }

  return {
    tick: 0,
    city,
    config: cfg,
    seed,
    trafficSeed,
    pedestrianSeed,
    eventSeed,
    trafficRng: makeRng(trafficSeed),
    pedestrianRng: makeRng(pedestrianSeed),
    eventRng: makeRng(eventSeed),
    player,
    vehicles,
    pedestrians: [],
    wanted: {
      heat: 0,
      stars: 0,
      lastSeenTick: -999,
      peakStars: 0
    },
    events: []
  };
}

/**
 * Advances the simulation world by one fixed time step.
 */
export function stepWorld(world, input = {}) {
  world.tick++;
  const cfg = world.config || CONFIG;
  const dt = cfg.simulation?.fixedStep ?? (1 / 60);

  const throttle = clamp(input.throttle ?? 0, -1, 1);
  const steer = clamp(input.steer ?? 0, -1, 1);
  const handbrake = !!input.handbrake;
  const sprint = !!input.sprint;
  const interact = !!input.interact;

  let moveX = 0;
  let moveZ = 0;
  if (Array.isArray(input.move)) {
    moveX = input.move[0] ?? 0;
    moveZ = input.move[1] ?? 0;
  } else if (input.move && typeof input.move === 'object') {
    moveX = input.move.x ?? 0;
    moveZ = input.move.z ?? 0;
  } else {
    moveX = input.moveX ?? 0;
    moveZ = input.moveZ ?? 0;
  }

  const gridW = world.city?.gridWidth ?? 1142;
  const gridD = world.city?.gridDepth ?? 954;
  const minCityX = 2;
  const maxCityX = gridW - 2;
  const minCityZ = 2;
  const maxCityZ = gridD - 2;

  const player = world.player;

  // 1. Player Physics & Input Handling
  if (player.mode === 'driving' && player.vehicleId !== null) {
    const pVeh = world.vehicles.find(v => v.id === player.vehicleId);
    if (pVeh) {
      if (interact && Math.abs(pVeh.speed) < 3.0) {
        // Exit vehicle
        player.mode = 'foot';
        player.vehicleId = null;
        pVeh.kind = 'parked';

        const exitAngle = pVeh.heading + Math.PI / 2;
        player.x = clamp(pVeh.x + Math.cos(exitAngle) * 2.2, minCityX, maxCityX);
        player.z = clamp(pVeh.z + Math.sin(exitAngle) * 2.2, minCityZ, maxCityZ);
      } else {
        // Arcade driving physics
        const vClass = cfg.vehicles[pVeh.classIndex] || cfg.vehicles[0];
        const accel = vClass.acceleration;
        const topSpd = vClass.topSpeed;
        const baseGrip = vClass.grip;
        const wheelbase = vClass.length * 0.65;

        // Throttle & Braking / Reverse
        if (throttle > 0) {
          pVeh.speed += throttle * accel * dt;
        } else if (throttle < 0) {
          if (pVeh.speed > 0.5) {
            pVeh.speed -= 24.0 * dt;
            if (pVeh.speed < 0) pVeh.speed = 0;
          } else {
            pVeh.speed += throttle * (accel * 0.5) * dt;
            pVeh.speed = Math.max(-10.0, pVeh.speed);
          }
        }

        // Drag & Resistance
        const drag = 0.008 * pVeh.speed * Math.abs(pVeh.speed);
        const rolling = 0.4 * Math.sign(pVeh.speed);
        pVeh.speed -= (drag + rolling) * dt;
        if (Math.abs(pVeh.speed) < 0.05 && throttle === 0) {
          pVeh.speed = 0;
        }
        if (pVeh.speed > topSpd) {
          pVeh.speed = topSpd;
        }

        // Steering & Heading Integration
        const maxSteerAngle = (Math.PI / 5.5) / (1 + Math.abs(pVeh.speed) * 0.025);
        const steerAngle = steer * maxSteerAngle;
        let yawRate = (pVeh.speed / wheelbase) * Math.tan(steerAngle);

        if (handbrake && Math.abs(pVeh.speed) > 3.0) {
          yawRate += Math.sign(steer || 1.0) * 1.6 * (1.0 - baseGrip);
        }
        pVeh.heading = normalizeAngle(pVeh.heading + yawRate * dt);

        // Position Integration
        const fwdX = Math.cos(pVeh.heading);
        const fwdZ = Math.sin(pVeh.heading);
        pVeh.x += fwdX * pVeh.speed * dt;
        pVeh.z += fwdZ * pVeh.speed * dt;

        pVeh.x = clamp(pVeh.x, minCityX, maxCityX);
        pVeh.z = clamp(pVeh.z, minCityZ, maxCityZ);

        player.x = pVeh.x;
        player.z = pVeh.z;

        // Player driven vehicle vs Building footprints
        const vehRadius = Math.max(vClass.length, vClass.width) / 2;
        const buildings = world.city?.buildings || [];
        for (let bIdx = 0; bIdx < buildings.length; bIdx++) {
          const b = buildings[bIdx];
          const bMinX = b.x - b.width / 2;
          const bMaxX = b.x + b.width / 2;
          const bMinZ = b.z - (b.depth || b.d || 10) / 2;
          const bMaxZ = b.z + (b.depth || b.d || 10) / 2;

          const cx = clamp(pVeh.x, bMinX, bMaxX);
          const cz = clamp(pVeh.z, bMinZ, bMaxZ);
          const dx = pVeh.x - cx;
          const dz = pVeh.z - cz;
          const distSq = dx * dx + dz * dz;

          if (distSq < vehRadius * vehRadius) {
            let nx = 0;
            let nz = 0;
            let overlap = 0;
            const dist = Math.sqrt(distSq);

            if (dist > 1e-6) {
              nx = dx / dist;
              nz = dz / dist;
              overlap = vehRadius - dist;
            } else {
              // Internal penetration push out along nearest edge
              const dLeft = Math.abs(pVeh.x - bMinX);
              const dRight = Math.abs(bMaxX - pVeh.x);
              const dTop = Math.abs(pVeh.z - bMinZ);
              const dBottom = Math.abs(bMaxZ - pVeh.z);
              const minD = Math.min(dLeft, dRight, dTop, dBottom);
              if (minD === dLeft) { nx = -1; nz = 0; }
              else if (minD === dRight) { nx = 1; nz = 0; }
              else if (minD === dTop) { nx = 0; nz = -1; }
              else { nx = 0; nz = 1; }
              overlap = vehRadius;
            }

            pVeh.x += nx * overlap;
            pVeh.z += nz * overlap;
            player.x = pVeh.x;
            player.z = pVeh.z;

            const vDotN = (fwdX * pVeh.speed) * nx + (fwdZ * pVeh.speed) * nz;
            if (vDotN < 0) {
              const speedLost = Math.abs(vDotN);
              pVeh.speed -= speedLost * 0.85;
              if (pVeh.speed < 0) pVeh.speed = 0;

              const impactDamage = speedLost * 1.5;
              pVeh.health = Math.max(0, pVeh.health - impactDamage);

              addEvent(world, 'impact', { vehicleId: pVeh.id, speedLost, damage: impactDamage });

              if (speedLost > 5.0) {
                addEvent(world, 'offence_property_damage', { speedLost });
                addHeat(world, cfg.wanted?.offences?.propertyDamage ?? 8);
              }
            }
          }
        }
      }
    } else {
      player.mode = 'foot';
      player.vehicleId = null;
    }
  } else {
    // Player On Foot
    const moveLen = Math.hypot(moveX, moveZ);
    const isSprinting = sprint && player.stamina > 0;
    const maxStamina = cfg.playerOnFoot?.stamina ?? 100;
    const walkSpd = cfg.playerOnFoot?.walkSpeed ?? 3.2;
    const sprintSpd = cfg.playerOnFoot?.sprintSpeed ?? 6.0;

    if (isSprinting) {
      player.stamina = Math.max(0, player.stamina - 28.0 * dt);
    } else {
      player.stamina = Math.min(maxStamina, player.stamina + 18.0 * dt);
    }

    if (moveLen > 0.01) {
      const dirX = moveX / moveLen;
      const dirZ = moveZ / moveLen;
      const targetHeading = Math.atan2(dirZ, dirX);
      const spd = isSprinting ? sprintSpd : walkSpd;
      const stepDist = spd * clamp(moveLen, 0, 1.0) * dt;

      player.heading = targetHeading;
      player.x += dirX * stepDist;
      player.z += dirZ * stepDist;
    }

    // Foot Collision with Building Footprints
    const playerRadius = 0.45;
    const buildings = world.city?.buildings || [];
    for (let bIdx = 0; bIdx < buildings.length; bIdx++) {
      const b = buildings[bIdx];
      const bMinX = b.x - b.width / 2;
      const bMaxX = b.x + b.width / 2;
      const bMinZ = b.z - (b.depth || b.d || 10) / 2;
      const bMaxZ = b.z + (b.depth || b.d || 10) / 2;

      const cx = clamp(player.x, bMinX, bMaxX);
      const cz = clamp(player.z, bMinZ, bMaxZ);
      const dx = player.x - cx;
      const dz = player.z - cz;
      const distSq = dx * dx + dz * dz;

      if (distSq < playerRadius * playerRadius) {
        const dist = Math.sqrt(distSq);
        if (dist > 1e-6) {
          const overlap = playerRadius - dist;
          player.x += (dx / dist) * overlap;
          player.z += (dz / dist) * overlap;
        } else {
          player.x += playerRadius;
        }
      }
    }

    // Foot Collision with Vehicles
    const sortedVehicles = [...world.vehicles].sort((a, b) => a.id - b.id);
    for (let vIdx = 0; vIdx < sortedVehicles.length; vIdx++) {
      const v = sortedVehicles[vIdx];
      const vClass = cfg.vehicles[v.classIndex] || cfg.vehicles[0];
      const vRadius = (vClass.length + vClass.width) / 4;
      const dx = player.x - v.x;
      const dz = player.z - v.z;
      const distSq = dx * dx + dz * dz;
      const minDist = playerRadius + vRadius;

      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq);
        if (dist > 1e-6) {
          const overlap = minDist - dist;
          player.x += (dx / dist) * overlap;
          player.z += (dz / dist) * overlap;
        } else {
          player.x += minDist;
        }
      }
    }

    player.x = clamp(player.x, minCityX, maxCityX);
    player.z = clamp(player.z, minCityZ, maxCityZ);

    // Foot Interact to enter nearest vehicle
    if (interact) {
      let nearestVeh = null;
      let minVehDist = 3.0; // 3 metres threshold

      for (let vIdx = 0; vIdx < sortedVehicles.length; vIdx++) {
        const v = sortedVehicles[vIdx];
        const dist = Math.hypot(v.x - player.x, v.z - player.z);
        if (dist <= minVehDist) {
          minVehDist = dist;
          nearestVeh = v;
        }
      }

      if (nearestVeh) {
        player.mode = 'driving';
        player.vehicleId = nearestVeh.id;

        if (!nearestVeh.isPlayerOwned) {
          addEvent(world, 'steal_car', { vehicleId: nearestVeh.id, classIndex: nearestVeh.classIndex });
          addHeat(world, cfg.wanted?.offences?.stealCar ?? 40);
        }
        nearestVeh.kind = 'player';
      }
    }
  }

  // 2. Vehicle-against-Vehicle Collisions (ascending ID order)
  const vList = [...world.vehicles].sort((a, b) => a.id - b.id);
  for (let i = 0; i < vList.length; i++) {
    for (let j = i + 1; j < vList.length; j++) {
      const v1 = vList[i];
      const v2 = vList[j];

      const c1 = cfg.vehicles[v1.classIndex] || cfg.vehicles[0];
      const c2 = cfg.vehicles[v2.classIndex] || cfg.vehicles[0];
      const r1 = (c1.length + c1.width) / 4;
      const r2 = (c2.length + c2.width) / 4;

      const dx = v2.x - v1.x;
      const dz = v2.z - v1.z;
      const distSq = dx * dx + dz * dz;
      const minDist = r1 + r2;

      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq) || 0.001;
        const overlap = minDist - dist;
        const nx = dx / dist;
        const nz = dz / dist;

        const m1 = c1.length * c1.width;
        const m2 = c2.length * c2.width;
        const mTotal = m1 + m2;

        v1.x -= nx * overlap * (m2 / mTotal);
        v1.z -= nz * overlap * (m2 / mTotal);
        v2.x += nx * overlap * (m1 / mTotal);
        v2.z += nz * overlap * (m1 / mTotal);

        v1.x = clamp(v1.x, minCityX, maxCityX);
        v1.z = clamp(v1.z, minCityZ, maxCityZ);
        v2.x = clamp(v2.x, minCityX, maxCityX);
        v2.z = clamp(v2.z, minCityZ, maxCityZ);

        const closingSpeed = Math.abs(v1.speed - v2.speed);
        v1.speed *= 0.82;
        v2.speed *= 0.82;

        const crashDamage = closingSpeed * 1.2;
        v1.health = Math.max(0, v1.health - crashDamage);
        v2.health = Math.max(0, v2.health - crashDamage);

        // Check offences if player is driving one of the colliding vehicles
        if (closingSpeed > 5.0) {
          const isPlayerV1 = (v1.kind === 'player' || player.vehicleId === v1.id);
          const isPlayerV2 = (v2.kind === 'player' || player.vehicleId === v2.id);

          if (isPlayerV1 && !isPlayerV2) {
            if (v2.kind === 'traffic') {
              addEvent(world, 'offence_hit_and_run', { targetId: v2.id, closingSpeed });
              addHeat(world, cfg.wanted?.offences?.hitAndRun ?? 35);
            } else if (v2.kind === 'police') {
              addEvent(world, 'offence_ram_police', { targetId: v2.id, closingSpeed });
              addHeat(world, cfg.wanted?.offences?.ramPolice ?? 80);
            }
          } else if (isPlayerV2 && !isPlayerV1) {
            if (v1.kind === 'traffic') {
              addEvent(world, 'offence_hit_and_run', { targetId: v1.id, closingSpeed });
              addHeat(world, cfg.wanted?.offences?.hitAndRun ?? 35);
            } else if (v1.kind === 'police') {
              addEvent(world, 'offence_ram_police', { targetId: v1.id, closingSpeed });
              addHeat(world, cfg.wanted?.offences?.ramPolice ?? 80);
            }
          }
        }
      }
    }
  }

  // 3. Wreck check & player ejection
  for (let vIdx = 0; vIdx < vList.length; vIdx++) {
    const v = vList[vIdx];
    if (v.health <= 0) {
      v.isWreck = true;
      v.isSmoking = true;
      v.speed = 0;

      if (player.mode === 'driving' && player.vehicleId === v.id) {
        player.mode = 'foot';
        player.vehicleId = null;
        player.x = clamp(v.x + 2.0, minCityX, maxCityX);
        player.z = clamp(v.z + 2.0, minCityZ, maxCityZ);
        player.health = Math.max(0, player.health - 30);
        addEvent(world, 'player_ejected', { vehicleId: v.id });
      }
    }
  }

  // 4. Vehicle vs Pedestrian Collisions
  const pedestrians = [...(world.pedestrians || [])].sort((a, b) => a.id - b.id);
  for (let vIdx = 0; vIdx < vList.length; vIdx++) {
    const v = vList[vIdx];
    if (Math.abs(v.speed) < 2.0) continue;

    const vClass = cfg.vehicles[v.classIndex] || cfg.vehicles[0];
    const vRadius = (vClass.length + vClass.width) / 4;

    for (let pIdx = 0; pIdx < pedestrians.length; pIdx++) {
      const p = pedestrians[pIdx];
      if (p.knocked) continue;

      const pRadius = 0.5;
      const dist = Math.hypot(p.x - v.x, p.z - v.z);

      if (dist < vRadius + pRadius) {
        p.knocked = true;
        p.recoveryTick = world.tick + 180;

        const isPlayerVeh = (v.kind === 'player' || (player.mode === 'driving' && player.vehicleId === v.id));
        if (isPlayerVeh) {
          addEvent(world, 'offence_knock_pedestrian', { pedestrianId: p.id });
          addHeat(world, cfg.wanted?.offences?.knockPedestrian ?? 60);
        }
      }
    }
  }

  // 5. Fixed-order AI Module Updates
  updateTraffic(world, dt);
  updatePedestrians(world, dt);
  updatePolice(world, dt);
  updateWanted(world, dt);
}
