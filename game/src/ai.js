import { CONFIG } from './config.js';
import { districtIndexAt } from './city.js';

/**
 * Normalizes an angle into [-PI, PI].
 */
function normalizeAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Helper to emit event into world.events queue.
 */
function emitEvent(world, type, payload = {}) {
  if (!world.events) world.events = [];
  const event = {
    tick: world.tick,
    type,
    ...payload
  };
  world.events.push(event);
  return event;
}

/**
 * Checks building collision for a point (x, z).
 */
function checkBuildingCollision(city, x, z, margin = 1.2) {
  if (!city || !city.buildings) return false;
  const buildings = city.buildings;
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const hw = b.width / 2 + margin;
    const hd = b.depth / 2 + margin;
    if (Math.abs(x - b.x) < hw && Math.abs(z - b.z) < hd) {
      return true;
    }
  }
  return false;
}

/**
 * Simulates miniature arcade vehicle physics for AI cars.
 */
function moveAiVehicle(v, targetSpeed, targetHeading, dt, world) {
  const cfg = world.config || CONFIG;
  const vClass = cfg.vehicles[v.classIndex] || cfg.vehicles[0];
  const accel = vClass.acceleration;
  const topSpeed = vClass.topSpeed;

  // Acceleration / deceleration
  if (v.speed < targetSpeed) {
    v.speed = Math.min(targetSpeed, v.speed + accel * dt);
  } else if (v.speed > targetSpeed) {
    v.speed = Math.max(targetSpeed, v.speed - accel * 1.5 * dt);
  }
  v.speed = Math.max(0, Math.min(topSpeed, v.speed));

  // Steering
  const diff = normalizeAngle(targetHeading - v.heading);
  const maxTurnRate = 2.5 / (1.0 + Math.abs(v.speed) * 0.03);
  const steer = Math.max(-maxTurnRate * dt, Math.min(maxTurnRate * dt, diff));
  v.heading = normalizeAngle(v.heading + steer);

  // Integrate position
  const oldX = v.x;
  const oldZ = v.z;
  v.x += Math.cos(v.heading) * v.speed * dt;
  v.z += Math.sin(v.heading) * v.speed * dt;

  // City grid bounds
  const gridW = world.city?.gridWidth || 1142;
  const gridD = world.city?.gridDepth || 954;

  if (v.x < 10 || v.x > gridW - 10 || v.z < 10 || v.z > gridD - 10) {
    v.x = Math.max(10, Math.min(gridW - 10, v.x));
    v.z = Math.max(10, Math.min(gridD - 10, v.z));
    v.speed = 0;
    v.heading = normalizeAngle(v.heading + Math.PI);
  } else if (checkBuildingCollision(world.city, v.x, v.z)) {
    v.x = oldX;
    v.z = oldZ;
    v.speed = 0;
    v.heading = normalizeAngle(v.heading + Math.PI + (world.trafficRng ? world.trafficRng.range(-0.4, 0.4) : 0));
  }
}

/**
 * Updates ambient traffic vehicle population, lane navigation, fleeing, and despawning.
 */
export function updateTraffic(world, dt) {
  const cfg = world.config || CONFIG;
  const player = world.player;
  const rng = world.trafficRng;

  // Determine current district density
  const playerDistIdx = districtIndexAt(world.city, player.x, player.z);
  const distConfig = cfg.districts[playerDistIdx] || cfg.districts[0];
  const density = distConfig.trafficDensity ?? 1.0;
  const maxCap = cfg.simulation?.maxTrafficCars ?? 24;
  const targetTrafficCount = Math.max(4, Math.floor(maxCap * density));

  // Count current traffic
  let currentTrafficCount = 0;
  let maxVehId = 0;
  for (let i = 0; i < world.vehicles.length; i++) {
    const v = world.vehicles[i];
    if (v.id > maxVehId) maxVehId = v.id;
    if (v.kind === 'traffic' && !v.removed && !v.isWreck) {
      currentTrafficCount++;
    }
  }

  // Spawn new ambient traffic if under target cap
  const roads = world.city?.roads || world.city?.roadSegments || [];
  if (currentTrafficCount < targetTrafficCount && roads.length > 0 && rng) {
    const road = rng.choice(roads);
    if (road) {
      const isForward = rng.chance(0.5);
      const laneInfo = isForward ? road.lanes.forward : road.lanes.reverse;
      const t = rng.range(0.1, 0.9);

      let spawnX = road.p1.x + (road.p2.x - road.p1.x) * t;
      let spawnZ = road.p1.z + (road.p2.z - road.p1.z) * t;

      if (road.direction === 'east-west') {
        spawnZ += laneInfo.offset;
      } else {
        spawnX += laneInfo.offset;
      }

      const distToPlayer = Math.hypot(spawnX - player.x, spawnZ - player.z);
      if (distToPlayer >= 70 && distToPlayer <= 280) {
        const classIndex = rng.int(0, 5);
        const vClass = cfg.vehicles[classIndex] || cfg.vehicles[0];
        let heading = 0;
        if (road.direction === 'east-west') {
          heading = isForward ? 0 : Math.PI;
        } else {
          heading = isForward ? Math.PI / 2 : -Math.PI / 2;
        }

        const newCar = {
          id: maxVehId + 1,
          classIndex,
          kind: 'traffic',
          x: spawnX,
          z: spawnZ,
          heading,
          speed: vClass.topSpeed * 0.4,
          health: vClass.health,
          bodyColour: vClass.bodyColour,
          cabinColour: vClass.cabinColour,
          driverAi: {
            roadId: road.id,
            isForward,
            state: 'cruising',
            targetSpeed: vClass.topSpeed * 0.55
          },
          isPlayerOwned: false,
          isWreck: false,
          isSmoking: false
        };

        world.vehicles.push(newCar);
      }
    }
  }

  // Check recent crashes or high wanted level
  const isHighWanted = (world.wanted?.stars ?? 0) >= 3;
  let nearbyCrash = false;
  if (world.events && world.events.length > 0) {
    for (let i = world.events.length - 1; i >= Math.max(0, world.events.length - 10); i--) {
      const ev = world.events[i];
      if (ev.tick >= world.tick - 30 && (ev.type === 'offence_hit_and_run' || ev.type === 'offence_ram_police')) {
        nearbyCrash = true;
        break;
      }
    }
  }

  // Update existing traffic cars in ascending ID order
  const trafficVehicles = world.vehicles
    .filter(v => v.kind === 'traffic')
    .sort((a, b) => a.id - b.id);

  for (let i = 0; i < trafficVehicles.length; i++) {
    const v = trafficVehicles[i];
    if (v.removed || v.isWreck) continue;

    const distToPlayer = Math.hypot(v.x - player.x, v.z - player.z);

    if (distToPlayer > 360) {
      v.removed = true;
      continue;
    }

    if (!v.driverAi) {
      v.driverAi = { state: 'cruising', targetSpeed: 15.0 };
    }

    const ai = v.driverAi;
    const vClass = cfg.vehicles[v.classIndex] || cfg.vehicles[0];

    if ((isHighWanted && distToPlayer < 100) || (nearbyCrash && distToPlayer < 80)) {
      if (rng && rng.chance(0.5)) {
        ai.state = 'fleeing';
        ai.targetSpeed = vClass.topSpeed * 0.85;
      } else {
        ai.state = 'pull_over';
        ai.targetSpeed = 0;
      }
    }

    let targetSpeed = ai.targetSpeed ?? (vClass.topSpeed * 0.5);

    for (let j = 0; j < world.vehicles.length; j++) {
      const oVeh = world.vehicles[j];
      if (oVeh.id === v.id || oVeh.removed) continue;

      const dx = oVeh.x - v.x;
      const dz = oVeh.z - v.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.5 && dist < 14.0) {
        const angleToOther = Math.atan2(dz, dx);
        const headingDiff = Math.abs(normalizeAngle(angleToOther - v.heading));
        if (headingDiff < Math.PI / 4) {
          targetSpeed = Math.min(targetSpeed, Math.max(0, oVeh.speed - 3.0));
        }
      }
    }

    let targetHeading = v.heading;
    const road = roads.find(r => r.id === ai.roadId);
    if (road) {
      const isForward = ai.isForward ?? true;
      const endPt = isForward ? road.p2 : road.p1;
      const distToEnd = Math.hypot(endPt.x - v.x, endPt.z - v.z);

      if (distToEnd < 12.0 && rng) {
        const connectedRoads = roads.filter(r => {
          if (r.id === road.id) return false;
          const d1 = Math.hypot(r.p1.x - endPt.x, r.p1.z - endPt.z);
          const d2 = Math.hypot(r.p2.x - endPt.x, r.p2.z - endPt.z);
          return d1 < 16.0 || d2 < 16.0;
        });

        if (connectedRoads.length > 0) {
          const nextRoad = rng.choice(connectedRoads);
          const d1 = Math.hypot(nextRoad.p1.x - endPt.x, nextRoad.p1.z - endPt.z);
          const nextIsForward = d1 < 16.0;

          ai.roadId = nextRoad.id;
          ai.isForward = nextIsForward;

          if (nextRoad.direction === 'east-west') {
            targetHeading = nextIsForward ? 0 : Math.PI;
          } else {
            targetHeading = nextIsForward ? Math.PI / 2 : -Math.PI / 2;
          }
        }
      } else {
        if (road.direction === 'east-west') {
          targetHeading = isForward ? 0 : Math.PI;
        } else {
          targetHeading = isForward ? Math.PI / 2 : -Math.PI / 2;
        }
      }
    }

    if (ai.state === 'pull_over') {
      targetHeading = normalizeAngle(targetHeading + 0.3);
    }

    moveAiVehicle(v, targetSpeed, targetHeading, dt, world);
  }

  world.vehicles = world.vehicles.filter(v => !v.removed);
}

/**
 * Updates pedestrian walking, fleeing from fast vehicles, knockdown recoveries, and despawning.
 */
export function updatePedestrians(world, dt) {
  const cfg = world.config || CONFIG;
  const player = world.player;
  const rng = world.pedestrianRng;

  const targetCount = cfg.simulation?.maxPedestrians ?? 20;
  let maxPedId = 0;
  for (let i = 0; i < world.pedestrians.length; i++) {
    if (world.pedestrians[i].id > maxPedId) {
      maxPedId = world.pedestrians[i].id;
    }
  }

  const roads = world.city?.roads || world.city?.roadSegments || [];
  if (world.pedestrians.length < targetCount && roads.length > 0 && rng) {
    const road = rng.choice(roads);
    if (road) {
      const side = rng.chance(0.5) ? 1 : -1;
      const t = rng.range(0.1, 0.9);
      const sidewalkDist = (cfg.city?.roadWidth ?? 14) / 2 + (cfg.city?.sidewalkWidth ?? 3) / 2;

      let sx = road.p1.x + (road.p2.x - road.p1.x) * t;
      let sz = road.p1.z + (road.p2.z - road.p1.z) * t;

      if (road.direction === 'east-west') {
        sz += side * sidewalkDist;
      } else {
        sx += side * sidewalkDist;
      }

      const distToPlayer = Math.hypot(sx - player.x, sz - player.z);
      if (distToPlayer >= 30 && distToPlayer <= 100) {
        let heading = road.direction === 'east-west' ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);

        world.pedestrians.push({
          id: maxPedId + 1,
          x: sx,
          z: sz,
          heading,
          speed: rng.range(1.2, 2.0),
          knocked: false,
          recoveryTick: 0,
          fleeing: false,
          fleeTimer: 0
        });
      }
    }
  }

  const highHeat = (world.wanted?.stars ?? 0) >= 3;

  world.pedestrians.sort((a, b) => a.id - b.id);

  for (let i = 0; i < world.pedestrians.length; i++) {
    const p = world.pedestrians[i];
    if (p.removed) continue;

    const distToPlayer = Math.hypot(p.x - player.x, p.z - player.z);

    if (distToPlayer > 120) {
      p.removed = true;
      continue;
    }

    if (p.knocked) {
      if (world.tick >= p.recoveryTick) {
        p.knocked = false;
        p.fleeing = true;
        p.fleeTimer = 180;
      } else {
        continue;
      }
    }

    let threatAngle = null;
    if (highHeat && distToPlayer < 60) {
      threatAngle = Math.atan2(p.z - player.z, p.x - player.x);
    } else {
      for (let j = 0; j < world.vehicles.length; j++) {
        const v = world.vehicles[j];
        if (v.removed || Math.abs(v.speed) < 5.0) continue;

        const dvx = p.x - v.x;
        const dvz = p.z - v.z;
        const dVeh = Math.hypot(dvx, dvz);

        if (dVeh < 15.0) {
          threatAngle = Math.atan2(dvz, dvx);
          break;
        }
      }
    }

    if (threatAngle !== null) {
      p.fleeing = true;
      p.fleeTimer = 180;
      p.heading = threatAngle;
    }

    let moveSpeed = p.speed;
    if (p.fleeing) {
      moveSpeed = 4.5;
      p.fleeTimer--;
      if (p.fleeTimer <= 0) {
        p.fleeing = false;
      }
    } else if (rng && rng.chance(0.005)) {
      p.heading = normalizeAngle(p.heading + (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2));
    }

    const oldX = p.x;
    const oldZ = p.z;
    p.x += Math.cos(p.heading) * moveSpeed * dt;
    p.z += Math.sin(p.heading) * moveSpeed * dt;

    if (checkBuildingCollision(world.city, p.x, p.z, 0.5)) {
      p.x = oldX;
      p.z = oldZ;
      p.heading = normalizeAngle(p.heading + Math.PI);
    }
  }

  world.pedestrians = world.pedestrians.filter(p => !p.removed);
}

/**
 * Updates police spawns, pursuit tactics (1-star, 2-star, 3+ star ramming), and busted detection.
 */
export function updatePolice(world, dt) {
  const cfg = world.config || CONFIG;
  const player = world.player;
  const rng = world.trafficRng;
  const stars = world.wanted?.stars ?? 0;

  const targetPoliceCount = stars > 0 ? Math.min(stars, cfg.simulation?.maxPoliceCars ?? 6) : 0;

  let currentPoliceCount = 0;
  let maxVehId = 0;
  for (let i = 0; i < world.vehicles.length; i++) {
    const v = world.vehicles[i];
    if (v.id > maxVehId) maxVehId = v.id;
    if (v.kind === 'police' && !v.removed && !v.isWreck) {
      currentPoliceCount++;
    }
  }

  const roads = world.city?.roads || world.city?.roadSegments || [];
  if (currentPoliceCount < targetPoliceCount && stars > 0 && roads.length > 0 && rng) {
    const road = rng.choice(roads);
    if (road) {
      const t = rng.range(0.2, 0.8);
      const spawnX = road.p1.x + (road.p2.x - road.p1.x) * t;
      const spawnZ = road.p1.z + (road.p2.z - road.p1.z) * t;

      const distToPlayer = Math.hypot(spawnX - player.x, spawnZ - player.z);
      if (distToPlayer >= 100 && distToPlayer <= 220) {
        const classIndex = 5;
        const vClass = cfg.vehicles[classIndex] || cfg.vehicles[0];
        const heading = Math.atan2(player.z - spawnZ, player.x - spawnX);

        world.vehicles.push({
          id: maxVehId + 1,
          classIndex,
          kind: 'police',
          x: spawnX,
          z: spawnZ,
          heading,
          speed: 15.0,
          health: vClass.health,
          bodyColour: vClass.bodyColour,
          cabinColour: vClass.cabinColour,
          driverAi: {
            state: 'pursuit',
            footBustedTimer: 0,
            contactTimer: 0,
            lastKnownPlayerPos: { x: player.x, z: player.z }
          },
          isPlayerOwned: false,
          isWreck: false,
          isSmoking: false
        });
      }
    }
  }

  const policeVehicles = world.vehicles
    .filter(v => v.kind === 'police')
    .sort((a, b) => a.id - b.id);

  for (let i = 0; i < policeVehicles.length; i++) {
    const v = policeVehicles[i];
    if (v.removed) continue;

    if (v.isWreck || stars === 0) {
      v.removed = true;
      continue;
    }

    const distToPlayer = Math.hypot(v.x - player.x, v.z - player.z);
    if (distToPlayer > 380) {
      v.removed = true;
      continue;
    }

    if (!v.driverAi) {
      v.driverAi = { footBustedTimer: 0, contactTimer: 0, lastKnownPlayerPos: { x: player.x, z: player.z } };
    }
    const ai = v.driverAi;

    const isVisible = distToPlayer < 140;
    if (isVisible) {
      world.wanted.lastSeenTick = world.tick;
      ai.lastKnownPlayerPos = { x: player.x, z: player.z };
    }

    let targetX = ai.lastKnownPlayerPos?.x ?? player.x;
    let targetZ = ai.lastKnownPlayerPos?.z ?? player.z;

    const pVeh = player.vehicleId !== null ? world.vehicles.find(veh => veh.id === player.vehicleId) : null;

    if (isVisible) {
      if (pVeh && Math.abs(pVeh.speed) > 1.0) {
        targetX = player.x + Math.cos(pVeh.heading) * pVeh.speed * 0.7;
        targetZ = player.z + Math.sin(pVeh.heading) * pVeh.speed * 0.7;
      } else {
        targetX = player.x;
        targetZ = player.z;
      }
    }

    const vClass = cfg.vehicles[v.classIndex] || cfg.vehicles[0];
    let targetSpeed = vClass.topSpeed;

    if (stars === 1) {
      const playerHeading = pVeh ? pVeh.heading : player.heading;
      targetX += Math.cos(playerHeading + Math.PI / 2) * 3.5;
      targetZ += Math.sin(playerHeading + Math.PI / 2) * 3.5;
      targetSpeed = Math.min(vClass.topSpeed, (pVeh ? pVeh.speed : 5.0) + 2.0);
    } else if (stars === 2) {
      const playerHeading = pVeh ? pVeh.heading : player.heading;
      targetX += Math.cos(playerHeading) * 4.0;
      targetZ += Math.sin(playerHeading) * 4.0;
      targetSpeed = vClass.topSpeed * 0.9;
    } else {
      targetSpeed = vClass.topSpeed;
    }

    const targetHeading = Math.atan2(targetZ - v.z, targetX - v.x);
    moveAiVehicle(v, targetSpeed, targetHeading, dt, world);

    if (player.mode === 'foot') {
      if (distToPlayer <= 2.2) {
        ai.footBustedTimer = (ai.footBustedTimer || 0) + dt;
        if (ai.footBustedTimer >= 2.0) {
          emitEvent(world, 'busted', { reason: 'foot_apprehended', policeId: v.id });
          world.wanted.heat = 0;
          world.wanted.stars = 0;
          ai.footBustedTimer = 0;
        }
      } else {
        ai.footBustedTimer = 0;
      }
    } else if (player.mode === 'driving' && pVeh) {
      if (Math.abs(pVeh.speed) < 2.0) {
        const pClass = cfg.vehicles[pVeh.classIndex] || cfg.vehicles[0];
        const r1 = (vClass.length + vClass.width) / 4;
        const r2 = (pClass.length + pClass.width) / 4;
        const distVeh = Math.hypot(v.x - pVeh.x, v.z - pVeh.z);

        if (distVeh <= r1 + r2 + 1.0) {
          ai.contactTimer = (ai.contactTimer || 0) + dt;
          if (ai.contactTimer >= 3.0) {
            emitEvent(world, 'busted', { reason: 'vehicle_boxed', policeId: v.id });
            world.wanted.heat = 0;
            world.wanted.stars = 0;
            ai.contactTimer = 0;
          }
        } else {
          ai.contactTimer = 0;
        }
      } else {
        ai.contactTimer = 0;
      }
    }
  }

  world.vehicles = world.vehicles.filter(v => !v.removed);
}

/**
 * Updates wanted level decay, star rating, unseen vehicle switch bonus, and heat clearing.
 */
export function updateWanted(world, dt) {
  const cfg = world.config || CONFIG;
  const player = world.player;
  const heatPerStar = cfg.wanted?.heatPerStar ?? 100;

  if (!world.wanted) {
    world.wanted = { heat: 0, stars: 0, lastSeenTick: -999, peakStars: 0 };
  }

  const w = world.wanted;

  let seenByPolice = false;
  for (let i = 0; i < world.vehicles.length; i++) {
    const v = world.vehicles[i];
    if (v.kind === 'police' && !v.removed && !v.isWreck) {
      const dist = Math.hypot(v.x - player.x, v.z - player.z);
      if (dist < 130) {
        seenByPolice = true;
        break;
      }
    }
  }

  if (seenByPolice) {
    w.lastSeenTick = world.tick;
  }

  const isUnseen = !seenByPolice && (world.tick - w.lastSeenTick > 60);

  const currentVehId = player.mode === 'driving' ? player.vehicleId : null;
  if (w.lastVehicleId === undefined) {
    w.lastVehicleId = currentVehId;
  }

  if (currentVehId !== null && currentVehId !== w.lastVehicleId) {
    if (isUnseen && !w.vehicleSwitchedInEpisode && w.heat > 0) {
      w.heat = Math.max(0, w.heat - heatPerStar);
      w.vehicleSwitchedInEpisode = true;
    }
  }
  w.lastVehicleId = currentVehId;

  if (isUnseen && w.heat > 0) {
    const decayRate = player.mode === 'foot' ? (cfg.wanted?.decayRates?.onFoot ?? 5) : (cfg.wanted?.decayRates?.inCar ?? 2);
    w.heat = Math.max(0, w.heat - decayRate * dt);
  }

  const oldHeat = w.prevHeat ?? w.heat;
  const stars = Math.min(5, Math.floor(w.heat / heatPerStar));
  w.stars = stars;

  if (stars > (w.peakStars || 0)) {
    w.peakStars = stars;
  }

  if (oldHeat > 0 && w.heat === 0) {
    emitEvent(world, 'heat_cleared', { peakStars: w.peakStars || 0 });
    w.peakStars = 0;
    w.vehicleSwitchedInEpisode = false;
  }

  w.prevHeat = w.heat;
}

/**
 * Registers an offence by adding heat and updating wanted state.
 */
export function addHeat(world, amount, reason) {
  if (!world.wanted) return;
  const cfg = world.config || CONFIG;
  const maxHeat = cfg.wanted?.heatMax ?? 500;
  const heatPerStar = cfg.wanted?.heatPerStar ?? 100;

  world.wanted.heat = Math.min(maxHeat, (world.wanted.heat || 0) + amount);
  world.wanted.lastSeenTick = world.tick;

  if (reason) {
    world.wanted.lastReason = reason;
  }

  const stars = Math.min(5, Math.floor(world.wanted.heat / heatPerStar));
  world.wanted.stars = stars;

  if (stars > (world.wanted.peakStars || 0)) {
    world.wanted.peakStars = stars;
  }
}
