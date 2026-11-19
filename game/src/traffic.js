// Ambient traffic AI: vehicles following road graph, yielding, and fleeing from chases.
import { createVehicle } from './vehicles.js';
import { updateVehiclePhysics, distSq, angleDiff } from './physics.js';
import { STEP } from './config.js';

export function createTrafficSystem(city, rng) {
  const activeCars = [];
  const MAX_TRAFFIC = 24;

  function spawnTrafficCar(nearX, nearZ, excludeRadius = 45, maxRadius = 180) {
    const edges = city.roadEdges;
    if (!edges || edges.length === 0) return null;

    // Find edges within spawn radius
    const candidates = [];
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const dSq = distSq(nearX, nearZ, e.x1, e.z1);
      if (dSq > excludeRadius * excludeRadius && dSq < maxRadius * maxRadius) {
        candidates.push(e);
      }
    }

    const edge = candidates.length > 0 ? rng.choice(candidates) : rng.choice(edges);
    const progress = rng.float(0.1, 0.9);

    // Right-lane offset
    const laneOffset = 3.2;
    const perpX = -edge.dirZ * laneOffset;
    const perpZ = edge.dirX * laneOffset;

    const x = edge.x1 + (edge.x2 - edge.x1) * progress + perpX;
    const z = edge.z1 + (edge.z2 - edge.z1) * progress + perpZ;
    const angle = Math.atan2(edge.dirX, edge.dirZ);

    const classes = ['hatch', 'sedan', 'sedan', 'sports', 'muscle', 'truck'];
    const classId = rng.choice(classes);
    const car = createVehicle(classId, x, z, angle);
    car.isTraffic = true;
    car.currentEdge = edge;
    car.speed = rng.float(12, 20);

    return car;
  }

  function init(playerX, playerZ) {
    activeCars.length = 0;
    for (let i = 0; i < MAX_TRAFFIC; i++) {
      const car = spawnTrafficCar(playerX, playerZ, 25, 220);
      if (car) activeCars.push(car);
    }
  }

  function update(player, buildings, policeCars, wantedStars) {
    const dt = STEP;

    for (let i = activeCars.length - 1; i >= 0; i--) {
      const car = activeCars[i];
      if (!car.active) {
        activeCars.splice(i, 1);
        continue;
      }

      // Check distance to player for despawn/recycle
      const playerDistSq = distSq(car.x, car.z, player.x, player.z);
      if (playerDistSq > 280 * 280) {
        // Despawn and respawn closer ahead of player
        activeCars.splice(i, 1);
        const newCar = spawnTrafficCar(player.x, player.z, 60, 200);
        if (newCar) activeCars.push(newCar);
        continue;
      }

      // Simple road graph navigation
      const edge = car.currentEdge;
      let targetX = car.x + Math.sin(car.angle) * 10;
      let targetZ = car.z + Math.cos(car.angle) * 10;

      if (edge) {
        const laneOffset = 3.2;
        const perpX = -edge.dirZ * laneOffset;
        const perpZ = edge.dirX * laneOffset;
        targetX = edge.x2 + perpX;
        targetZ = edge.z2 + perpZ;

        // Check if reached end of current edge
        if (distSq(car.x, car.z, targetX, targetZ) < 8 * 8) {
          // Pick next connected edge from target node
          const nextEdges = city.roadEdges.filter((e) => e.from === edge.to && e.to !== edge.from);
          if (nextEdges.length > 0) {
            car.currentEdge = rng.choice(nextEdges);
          } else {
            // Dead end or turnaround
            car.currentEdge = city.roadEdges.find((e) => e.from === edge.to) || edge;
          }
        }
      }

      // Steering towards target
      const wantedAngle = Math.atan2(targetX - car.x, targetZ - car.z);
      const angleDelta = angleDiff(car.angle, wantedAngle);
      const steer = Math.max(-1, Math.min(1, angleDelta * 2.5));

      // Obstacle detection ahead (vehicles, player)
      let obstacleAhead = false;
      let targetSpeed = 16.0;

      if (wantedStars >= 3) {
        // Panic flee mode
        targetSpeed = 26.0;
      }

      // Check player vehicle
      if (player.vehicle) {
        const dPlayer = distSq(car.x, car.z, player.vehicle.x, player.vehicle.z);
        if (dPlayer < 18 * 18) {
          const toPlayerAngle = Math.atan2(player.vehicle.x - car.x, player.vehicle.z - car.z);
          if (Math.abs(angleDiff(car.angle, toPlayerAngle)) < 0.8) {
            obstacleAhead = true;
          }
        }
      }

      // Check other traffic cars ahead
      for (let j = 0; j < activeCars.length; j++) {
        if (i === j) continue;
        const other = activeCars[j];
        const dOther = distSq(car.x, car.z, other.x, other.z);
        if (dOther < 14 * 14) {
          const toOtherAngle = Math.atan2(other.x - car.x, other.z - car.z);
          if (Math.abs(angleDiff(car.angle, toOtherAngle)) < 0.7) {
            obstacleAhead = true;
            break;
          }
        }
      }

      let throttle = 0.7;
      let handbrake = false;

      if (obstacleAhead) {
        throttle = -0.6; // brake
      } else if (car.speed < targetSpeed) {
        throttle = 0.8;
      } else if (car.speed > targetSpeed + 2) {
        throttle = 0;
      }

      // Physics update
      updateVehiclePhysics(
        car,
        { throttle, steer, handbrake },
        buildings,
        player.vehicle ? [...activeCars, player.vehicle] : activeCars
      );
    }

    // Maintain pool size
    while (activeCars.length < MAX_TRAFFIC) {
      const newCar = spawnTrafficCar(player.x, player.z, 50, 200);
      if (newCar) activeCars.push(newCar);
      else break;
    }
  }

  return {
    activeCars,
    init,
    update,
  };
}
