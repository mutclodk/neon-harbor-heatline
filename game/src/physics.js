// Arcade physics engine: vehicle bicycle dynamics, on-foot locomotion, and collision resolution.
import { STEP } from './config.js';

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function distSq(x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  return dx * dx + dz * dz;
}

export function dist(x1, z1, x2, z2) {
  return Math.sqrt(distSq(x1, z1, x2, z2));
}

export function angleDiff(a, b) {
  let diff = (b - a) % (Math.PI * 2);
  if (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > Math.PI) diff -= Math.PI * 2;
  return diff;
}

// Circle vs Axis-Aligned Bounding Box (AABB) collision
export function circleAABBCollision(cx, cz, radius, minX, maxX, minZ, maxZ) {
  const closestX = clamp(cx, minX, maxX);
  const closestZ = clamp(cz, minZ, maxZ);

  const dx = cx - closestX;
  const dz = cz - closestZ;
  const distanceSq = dx * dx + dz * dz;

  if (distanceSq < radius * radius) {
    const distance = Math.sqrt(distanceSq);
    let normalX = 0;
    let normalZ = 0;
    let overlap = radius;

    if (distance > 0.0001) {
      normalX = dx / distance;
      normalZ = dz / distance;
      overlap = radius - distance;
    } else {
      // Circle center inside box: find closest edge
      const dl = cx - minX;
      const dr = maxX - cx;
      const dt = cz - minZ;
      const db = maxZ - cz;
      const minVal = Math.min(dl, dr, dt, db);
      if (minVal === dl) normalX = -1;
      else if (minVal === dr) normalX = 1;
      else if (minVal === dt) normalZ = -1;
      else normalZ = 1;
      overlap = radius;
    }

    return {
      collided: true,
      normalX,
      normalZ,
      overlap,
      contactX: closestX,
      contactZ: closestZ,
    };
  }

  return { collided: false };
}

// Vehicle physics simulation step
export function updateVehiclePhysics(vehicle, input, buildings, otherVehicles) {
  const spec = vehicle.spec;
  const dt = STEP;

  // Steering scales down with speed
  const speedRatio = Math.abs(vehicle.speed) / spec.topSpeed;
  const maxSteerAngle = lerp(0.55, 0.15, clamp(speedRatio, 0, 1)); // 31 deg at rest -> 8.5 deg at top speed
  const targetSteer = (input.steer || 0) * maxSteerAngle;
  vehicle.steerAngle = lerp(vehicle.steerAngle, targetSteer, 12 * dt);

  // Acceleration / Braking
  const throttle = input.throttle || 0;
  const handbrake = input.handbrake ? 1 : 0;

  if (throttle > 0) {
    if (vehicle.speed < -0.5) {
      // Braking while going in reverse
      vehicle.speed += spec.brakeDecel * dt;
    } else {
      // Accelerating forward
      const power = spec.accel * (1 - speedRatio * 0.7);
      vehicle.speed += throttle * power * dt;
      if (vehicle.speed > spec.topSpeed) vehicle.speed = spec.topSpeed;
    }
  } else if (throttle < 0) {
    if (vehicle.speed > 0.5) {
      // Braking while going forward
      vehicle.speed += throttle * spec.brakeDecel * dt;
    } else {
      // Reversing
      vehicle.speed += throttle * (spec.accel * 0.5) * dt;
      if (vehicle.speed < -spec.reverseSpeed) vehicle.speed = -spec.reverseSpeed;
    }
  } else {
    // Coasting / rolling drag
    const drag = 6.0;
    if (vehicle.speed > 0) {
      vehicle.speed = Math.max(0, vehicle.speed - drag * dt);
    } else if (vehicle.speed < 0) {
      vehicle.speed = Math.min(0, vehicle.speed + drag * dt);
    }
  }

  // Handbrake decel and drift grip
  let currentGrip = spec.grip;
  if (handbrake) {
    currentGrip = spec.driftGrip;
    if (vehicle.speed > 0) {
      vehicle.speed = Math.max(0, vehicle.speed - spec.brakeDecel * 0.6 * dt);
    } else if (vehicle.speed < 0) {
      vehicle.speed = Math.min(0, vehicle.speed + spec.brakeDecel * 0.6 * dt);
    }
    // Handbrake slide yaw boost
    vehicle.yawRate += (input.steer || 0) * 2.8 * dt;
  }

  // Yaw rotation based on bicycle model
  const yawFromSteer = (vehicle.speed / spec.wheelBase) * Math.tan(vehicle.steerAngle);
  vehicle.yawRate = lerp(vehicle.yawRate, yawFromSteer, 14 * dt);
  vehicle.angle += vehicle.yawRate * dt;

  // Lateral velocity dampening (drift mechanics)
  const forwardX = Math.sin(vehicle.angle);
  const forwardZ = Math.cos(vehicle.angle);
  const rightX = Math.cos(vehicle.angle);
  const rightZ = -Math.sin(vehicle.angle);

  // Velocity components
  const forwardSpeed = vehicle.speed;
  vehicle.lateralSpeed = lerp(vehicle.lateralSpeed, 0, currentGrip * 18 * dt);
  if (handbrake && Math.abs(forwardSpeed) > 8) {
    vehicle.lateralSpeed += (input.steer || 0) * 7.5 * dt;
    vehicle.isDrifting = true;
  } else {
    vehicle.isDrifting = Math.abs(vehicle.lateralSpeed) > 3.0;
  }

  // World displacement
  const vx = forwardX * forwardSpeed + rightX * vehicle.lateralSpeed;
  const vz = forwardZ * forwardSpeed + rightZ * vehicle.lateralSpeed;
  vehicle.x += vx * dt;
  vehicle.z += vz * dt;

  // 1. Building collision (represented as two collision circles: front and rear)
  const halfLen = spec.length * 0.32;
  const frontX = vehicle.x + forwardX * halfLen;
  const frontZ = vehicle.z + forwardZ * halfLen;
  const rearX = vehicle.x - forwardX * halfLen;
  const rearZ = vehicle.z - forwardZ * halfLen;
  const colRadius = spec.width * 0.52;

  let impactOccurred = false;
  let impactImpulse = 0;

  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    // Broadphase bounding box check
    if (
      vehicle.x < b.minX - 15 ||
      vehicle.x > b.maxX + 15 ||
      vehicle.z < b.minZ - 15 ||
      vehicle.z > b.maxZ + 15
    ) {
      continue;
    }

    // Check front circle
    const colFront = circleAABBCollision(frontX, frontZ, colRadius, b.minX, b.maxX, b.minZ, b.maxZ);
    if (colFront.collided) {
      vehicle.x += colFront.normalX * colFront.overlap;
      vehicle.z += colFront.normalZ * colFront.overlap;
      impactImpulse = Math.max(impactImpulse, Math.abs(vehicle.speed));
      vehicle.speed *= 0.35; // bounce / loss of momentum
      impactOccurred = true;
    }

    // Check rear circle
    const colRear = circleAABBCollision(rearX, rearZ, colRadius, b.minX, b.maxX, b.minZ, b.maxZ);
    if (colRear.collided) {
      vehicle.x += colRear.normalX * colRear.overlap;
      vehicle.z += colRear.normalZ * colRear.overlap;
      impactImpulse = Math.max(impactImpulse, Math.abs(vehicle.speed));
      vehicle.speed *= 0.35;
      impactOccurred = true;
    }
  }

  // 2. Vehicle-to-vehicle collision
  if (otherVehicles) {
    for (let i = 0; i < otherVehicles.length; i++) {
      const other = otherVehicles[i];
      if (other.id === vehicle.id || !other.active) continue;

      const dSq = distSq(vehicle.x, vehicle.z, other.x, other.z);
      const minDistance = (spec.length + other.spec.length) * 0.42;

      if (dSq < minDistance * minDistance && dSq > 0.0001) {
        const d = Math.sqrt(dSq);
        const nx = (vehicle.x - other.x) / d;
        const nz = (vehicle.z - other.z) / d;
        const overlap = minDistance - d;

        // Mass ratio
        const totalMass = spec.mass + other.spec.mass;
        const myRatio = other.spec.mass / totalMass;
        const otherRatio = spec.mass / totalMass;

        vehicle.x += nx * overlap * myRatio;
        vehicle.z += nz * overlap * myRatio;
        other.x -= nx * overlap * otherRatio;
        other.z -= nz * overlap * otherRatio;

        // Momentum transfer
        const relSpeed = Math.abs(vehicle.speed - other.speed);
        impactImpulse = Math.max(impactImpulse, relSpeed);
        vehicle.speed *= 0.55;
        other.speed *= 0.55;
        impactOccurred = true;

        if (relSpeed > 5 && other.onImpact) {
          other.onImpact(vehicle, relSpeed);
        }
      }
    }
  }

  // Apply damage if hard impact occurred
  if (impactOccurred && impactImpulse > 6.0) {
    const damage = Math.round((impactImpulse - 6.0) * 3.5);
    vehicle.hp = Math.max(0, vehicle.hp - damage);
    vehicle.lastImpact = { time: STEP, impulse: impactImpulse };
  }

  return { impactOccurred, impactImpulse };
}

// Player on-foot movement and collision
export function updatePlayerPhysics(player, input, buildings, vehicles) {
  const dt = STEP;

  // Determine movement direction relative to camera
  const moveX = input.moveX || 0;
  const moveY = input.moveY || 0; // forward/backward
  const isMoving = Math.abs(moveX) > 0.05 || Math.abs(moveY) > 0.05;

  let speed = player.walkSpeed;
  if (input.sprint && isMoving && player.stamina > 5) {
    speed = player.sprintSpeed;
    player.stamina = Math.max(0, player.stamina - player.staminaDrain * dt);
    player.isSprinting = true;
  } else {
    player.stamina = Math.min(player.maxStamina, player.stamina + player.staminaRegen * dt);
    player.isSprinting = false;
  }

  if (isMoving) {
    // Camera-relative angle
    const inputAngle = Math.atan2(moveX, moveY);
    player.facingAngle = input.cameraYaw + inputAngle;

    const vx = Math.sin(player.facingAngle) * speed;
    const vz = Math.cos(player.facingAngle) * speed;

    player.x += vx * dt;
    player.z += vz * dt;
    player.isMoving = true;
  } else {
    player.isMoving = false;
  }

  // Collision with buildings
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (
      player.x < b.minX - 5 ||
      player.x > b.maxX + 5 ||
      player.z < b.minZ - 5 ||
      player.z > b.maxZ + 5
    ) {
      continue;
    }

    const col = circleAABBCollision(
      player.x,
      player.z,
      player.radius,
      b.minX,
      b.maxX,
      b.minZ,
      b.maxZ
    );
    if (col.collided) {
      player.x += col.normalX * col.overlap;
      player.z += col.normalZ * col.overlap;
    }
  }

  // Collision with vehicles
  if (vehicles) {
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      if (!v.active) continue;

      const dSq = distSq(player.x, player.z, v.x, v.z);
      const minDistance = player.radius + v.spec.width * 0.55;

      if (dSq < minDistance * minDistance && dSq > 0.0001) {
        const d = Math.sqrt(dSq);
        const nx = (player.x - v.x) / d;
        const nz = (player.z - v.z) / d;
        const overlap = minDistance - d;

        player.x += nx * overlap;
        player.z += nz * overlap;

        // If vehicle is moving fast, take impact damage
        if (Math.abs(v.speed) > 7.0) {
          const damage = Math.round(Math.abs(v.speed) * 2.5);
          player.hp = Math.max(0, player.hp - damage);
        }
      }
    }
  }
}
