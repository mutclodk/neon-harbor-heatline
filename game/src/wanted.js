// Wanted star system: heat escalation, police pursuit AI, roadblocks, decay, and Busted handling.
import { WANTED_CONFIG, STEP } from './config.js';
import { createVehicle } from './vehicles.js';
import { updateVehiclePhysics, distSq, angleDiff } from './physics.js';

export function createWantedSystem(city, rng) {
  let heat = 0;
  const policeCars = [];
  let inLineOfSight = false;
  let bustedTimer = 0;
  let lastVehicleId = null;

  function getStars() {
    if (heat <= 0) return 0;
    return Math.min(5, Math.floor((heat - 1) / 100) + 1);
  }

  function addHeat(amount, reason = '') {
    heat = Math.min(WANTED_CONFIG.maxHeat, Math.max(0, heat + amount));
  }

  function clearHeat() {
    heat = 0;
    for (let i = 0; i < policeCars.length; i++) {
      policeCars[i].active = false;
    }
    policeCars.length = 0;
    bustedTimer = 0;
  }

  function spawnPoliceUnit(playerX, playerZ) {
    const edges = city.roadEdges;
    if (!edges || edges.length === 0) return null;

    // Pick edge ahead or nearby
    const candidates = edges.filter((e) => {
      const d = distSq(playerX, playerZ, e.x1, e.z1);
      return d > 70 * 70 && d < 180 * 180;
    });

    const edge = candidates.length > 0 ? rng.choice(candidates) : rng.choice(edges);
    const x = (edge.x1 + edge.x2) / 2;
    const z = (edge.z1 + edge.z2) / 2;
    const angle = Math.atan2(edge.dirX, edge.dirZ);

    const cop = createVehicle('police', x, z, angle);
    cop.isPolice = true;
    cop.speed = 15;
    return cop;
  }

  function update(player, buildings, otherVehicles, onBusted, onHeatCleared) {
    const dt = STEP;
    const stars = getStars();

    // Check vehicle change for heat drop bonus
    if (player.inVehicle && player.vehicle) {
      if (lastVehicleId !== null && lastVehicleId !== player.vehicle.id && !inLineOfSight && heat > 50) {
        // Successful heat drop!
        heat = Math.max(0, heat - WANTED_CONFIG.vehicleChangeHeatReduction);
      }
      lastVehicleId = player.vehicle.id;
    } else {
      lastVehicleId = null;
    }

    if (stars === 0) {
      // Clear out police
      for (let i = policeCars.length - 1; i >= 0; i--) {
        policeCars[i].active = false;
        policeCars.splice(i, 1);
      }
      bustedTimer = 0;
      return;
    }

    // Desired police units for current star level
    const targetUnits = WANTED_CONFIG.stars[stars - 1].policeUnits;

    // Spawn needed police units
    while (policeCars.length < targetUnits) {
      const unit = spawnPoliceUnit(player.x, player.z);
      if (unit) policeCars.push(unit);
      else break;
    }

    // Check line of sight
    inLineOfSight = false;
    let closestCopDistSq = Infinity;

    for (let i = policeCars.length - 1; i >= 0; i--) {
      const cop = policeCars[i];
      if (!cop.active) {
        policeCars.splice(i, 1);
        continue;
      }

      const dSq = distSq(cop.x, cop.z, player.x, player.z);
      if (dSq < closestCopDistSq) closestCopDistSq = dSq;

      // In sight if within 60 meters
      if (dSq < 65 * 65) {
        inLineOfSight = true;
      }

      // Police steering AI toward player
      const targetAngle = Math.atan2(player.x - cop.x, player.z - cop.z);
      const delta = angleDiff(cop.angle, targetAngle);
      const steer = Math.max(-1, Math.min(1, delta * 2.8));

      // Speed control
      let throttle = 1.0;
      const targetSpeed = cop.spec.topSpeed * (0.75 + stars * 0.05);

      if (cop.speed < targetSpeed) throttle = 1.0;
      else throttle = 0.2;

      // Aggressive ramming at 3+ stars
      const ramming = stars >= 3;
      let handbrake = false;
      if (ramming && dSq < 22 * 22 && Math.abs(delta) > 0.6) {
        handbrake = true; // drift into player vehicle
      }

      // Police vehicle physics
      const neighbors = [...policeCars, ...(player.vehicle ? [player.vehicle] : [])];
      updateVehiclePhysics(cop, { throttle, steer, handbrake }, buildings, neighbors);
    }

    // Heat decay when out of sight
    if (!inLineOfSight) {
      const decay = WANTED_CONFIG.decayRateOutOfSight * dt;
      const oldStars = getStars();
      heat = Math.max(0, heat - decay);
      if (oldStars > 0 && heat === 0 && onHeatCleared) {
        onHeatCleared();
      }
    }

    // Busted arrest check
    // If player is boxed in or stopped (< 1.5 m/s) near police (< 4.5m)
    const playerSpeed = player.inVehicle && player.vehicle ? Math.abs(player.vehicle.speed) : (player.isMoving ? 3 : 0);
    if (closestCopDistSq < WANTED_CONFIG.bustedDistance * WANTED_CONFIG.bustedDistance && playerSpeed < 2.0) {
      bustedTimer += dt;
      if (bustedTimer >= WANTED_CONFIG.bustedDuration) {
        // Trigger BUSTED!
        clearHeat();
        if (onBusted) onBusted();
      }
    } else {
      bustedTimer = Math.max(0, bustedTimer - dt * 1.5);
    }
  }

  return {
    get heat() {
      return heat;
    },
    get stars() {
      return getStars();
    },
    get inLineOfSight() {
      return inLineOfSight;
    },
    get bustedProgress() {
      return clamp(bustedTimer / WANTED_CONFIG.bustedDuration, 0, 1);
    },
    policeCars,
    addHeat,
    clearHeat,
    update,
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
