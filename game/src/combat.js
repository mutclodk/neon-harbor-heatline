// Weapon combat system: firing mechanics, bullet tracers, hit detection, and damage.
import * as THREE from 'three';
import { WEAPON_CONFIG, STEP } from './config.js';
import { distSq } from './physics.js';

export function createCombatSystem() {
  let fireCooldown = 0;
  const tracers = [];

  function canFire() {
    return fireCooldown <= 0;
  }

  function fireWeapon(player, scene, onHitEntity, onWeaponFired) {
    if (fireCooldown > 0) return false;
    fireCooldown = WEAPON_CONFIG.fireRate;

    // Origin and direction
    let originX = player.x;
    let originZ = player.z;
    let originY = 1.3;
    let aimAngle = player.facingAngle;

    if (player.inVehicle && player.vehicle) {
      originX = player.vehicle.x;
      originZ = player.vehicle.z;
      originY = 1.2;
      aimAngle = player.vehicle.angle;
    }

    const dirX = Math.sin(aimAngle);
    const dirZ = Math.cos(aimAngle);

    // Apply camera recoil shake
    player.screenShake = Math.max(player.screenShake, 0.45);

    // Bullet Raycast
    const range = WEAPON_CONFIG.range;
    let hitX = originX + dirX * range;
    let hitZ = originZ + dirZ * range;
    let hitEntity = null;

    if (onHitEntity) {
      hitEntity = onHitEntity(originX, originZ, dirX, dirZ, range);
      if (hitEntity) {
        hitX = hitEntity.x;
        hitZ = hitEntity.z;
      }
    }

    // Create 3D bullet tracer line
    if (scene) {
      const geom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(originX, originY, originZ),
        new THREE.Vector3(hitX, 1.2, hitZ),
      ]);
      const mat = new THREE.LineBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.9,
      });
      const line = new THREE.Line(geom, mat);
      scene.add(line);
      tracers.push({ line, life: 0.08 });
    }

    if (onWeaponFired) {
      onWeaponFired({ originX, originZ, hitX, hitZ, hitEntity });
    }

    return true;
  }

  function update(scene, dt = STEP) {
    if (fireCooldown > 0) fireCooldown -= dt;

    for (let i = tracers.length - 1; i >= 0; i--) {
      const t = tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        if (scene) scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        tracers.splice(i, 1);
      } else {
        t.line.material.opacity = t.life / 0.08;
      }
    }
  }

  return {
    canFire,
    fireWeapon,
    update,
  };
}
