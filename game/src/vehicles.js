// Vehicle management and procedural 3D vehicle generation for all 6 vehicle classes.
import * as THREE from 'three';
import { VEHICLE_CLASSES } from './config.js';
import { getGlowTexture, getHeadlightBeamTexture } from './render3d.js';

let nextVehicleId = 1;

export function createVehicle(classId, x = 0, z = 0, angle = 0, color = null) {
  const spec = VEHICLE_CLASSES[classId] || VEHICLE_CLASSES.sedan;
  const id = nextVehicleId++;

  const vehicleColor = color || (spec.colorPalette ? spec.colorPalette[0] : '#38bdf8');

  return {
    id,
    classId,
    spec,
    x,
    z,
    y: 0,
    angle,
    speed: 0,
    lateralSpeed: 0,
    steerAngle: 0,
    yawRate: 0,
    hp: spec.maxHp,
    maxHp: spec.maxHp,
    active: true,
    isPlayer: false,
    isPolice: classId === 'police',
    isTraffic: false,
    isParked: false,
    isDrifting: false,
    color: vehicleColor,
    mesh: null,
    frontWheels: [],
    rearWheels: [],
    headlights: null,
    taillights: null,
    sirenLights: null,
    sirenSprites: null,
    sirenTimer: 0,
  };
}

// Procedural 3D mesh builder for Three.js
export function buildVehicleMesh(vehicle) {
  const spec = vehicle.spec;
  const group = new THREE.Group();
  const glowTex = getGlowTexture();
  const beamTex = getHeadlightBeamTexture();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(vehicle.color),
    metalness: 0.7,
    roughness: 0.3,
  });

  const blackMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.85,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.95,
    roughness: 0.1,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.1,
    metalness: 0.9,
    transparent: true,
    opacity: 0.88,
  });

  // Emissive Headlight and Taillight Materials
  const headLightMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb });
  const tailLightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

  // Dimensions
  const len = spec.length;
  const wid = spec.width;
  const hgt = spec.height;
  const wheelR = hgt * 0.28;
  const wheelW = wid * 0.16;

  if (vehicle.classId === 'truck') {
    // Dockmaster heavy truck: cab + cargo box
    const cabLen = len * 0.38;
    const cabGeom = new THREE.BoxGeometry(wid, hgt, cabLen);
    const cabMesh = new THREE.Mesh(cabGeom, bodyMat);
    cabMesh.position.set(0, hgt / 2 + wheelR * 0.7, len * 0.28);
    cabMesh.castShadow = true;
    group.add(cabMesh);

    // Windshield
    const winGeom = new THREE.BoxGeometry(wid * 0.92, hgt * 0.45, cabLen * 0.4);
    const winMesh = new THREE.Mesh(winGeom, glassMat);
    winMesh.position.set(0, hgt * 0.8 + wheelR * 0.7, len * 0.35);
    group.add(winMesh);

    // Cargo Container behind cab
    const cargoLen = len * 0.6;
    const cargoHgt = hgt * 1.25;
    const cargoGeom = new THREE.BoxGeometry(wid * 1.05, cargoHgt, cargoLen);
    const cargoMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // vibrant container teal
      roughness: 0.55,
      metalness: 0.25,
    });
    const cargoMesh = new THREE.Mesh(cargoGeom, cargoMat);
    cargoMesh.position.set(0, cargoHgt / 2 + wheelR * 0.7, -len * 0.18);
    cargoMesh.castShadow = true;
    group.add(cargoMesh);

    // Vertical chrome smokestacks
    const pipeGeom = new THREE.CylinderGeometry(0.09, 0.09, hgt * 1.15, 8);
    const pipeL = new THREE.Mesh(pipeGeom, chromeMat);
    pipeL.position.set(-wid * 0.45, hgt + wheelR, len * 0.09);
    const pipeR = new THREE.Mesh(pipeGeom, chromeMat);
    pipeR.position.set(wid * 0.45, hgt + wheelR, len * 0.09);
    group.add(pipeL, pipeR);
  } else {
    // Standard cars: Lower Chassis
    const chassisHgt = hgt * 0.45;
    const chassisGeom = new THREE.BoxGeometry(wid, chassisHgt, len);
    const chassisMesh = new THREE.Mesh(chassisGeom, bodyMat);
    chassisMesh.position.set(0, chassisHgt / 2 + wheelR * 0.7, 0);
    chassisMesh.castShadow = true;
    group.add(chassisMesh);

    // Cabin / Roof
    let cabinLen = len * 0.52;
    let cabinWid = wid * 0.85;
    let cabinHgt = hgt * 0.5;
    let cabinZ = -len * 0.05;

    if (vehicle.classId === 'sports') {
      cabinLen = len * 0.42;
      cabinHgt = hgt * 0.42;
      cabinZ = -len * 0.1;
    } else if (vehicle.classId === 'hatch') {
      cabinLen = len * 0.62;
      cabinZ = -len * 0.12;
    }

    const cabinGeom = new THREE.BoxGeometry(cabinWid, cabinHgt, cabinLen);
    const cabinMesh = new THREE.Mesh(cabinGeom, bodyMat);
    cabinMesh.position.set(0, chassisHgt + cabinHgt / 2 + wheelR * 0.7, cabinZ);
    cabinMesh.castShadow = true;
    group.add(cabinMesh);

    // Windshield & Windows
    const winGeom = new THREE.BoxGeometry(cabinWid * 1.02, cabinHgt * 0.82, cabinLen * 0.75);
    const winMesh = new THREE.Mesh(winGeom, glassMat);
    winMesh.position.set(0, chassisHgt + cabinHgt / 2 + wheelR * 0.7, cabinZ);
    group.add(winMesh);

    // Sports car rear spoiler
    if (vehicle.classId === 'sports') {
      const wingGeom = new THREE.BoxGeometry(wid * 0.95, 0.08, 0.35);
      const wingMesh = new THREE.Mesh(wingGeom, chromeMat);
      wingMesh.position.set(0, chassisHgt + 0.35 + wheelR * 0.7, -len * 0.45);
      group.add(wingMesh);
    }

    // Police lightbar & emergency strobes
    if (vehicle.classId === 'police') {
      const barY = chassisHgt + cabinHgt + 0.1 + wheelR * 0.7;
      const blueMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
      const redMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

      const lightL = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.28, 0.14, 0.22), redMat);
      lightL.position.set(-wid * 0.18, barY, cabinZ);

      const lightR = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.28, 0.14, 0.22), blueMat);
      lightR.position.set(wid * 0.18, barY, cabinZ);

      // Strobe glow sprites
      const spriteL = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex,
          color: 0xef4444,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      spriteL.scale.set(4.5, 4.5, 1);
      spriteL.position.set(-wid * 0.18, barY + 0.1, cabinZ);

      const spriteR = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex,
          color: 0x3b82f6,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      spriteR.scale.set(4.5, 4.5, 1);
      spriteR.position.set(wid * 0.18, barY + 0.1, cabinZ);

      group.add(lightL, lightR, spriteL, spriteR);
      vehicle.sirenLights = [lightL, lightR];
      vehicle.sirenSprites = [spriteL, spriteR];
    }
  }

  // Headlights
  const hlY = hgt * 0.36 + wheelR * 0.7;
  const hlZ = len * 0.5;
  const hlGeom = new THREE.BoxGeometry(wid * 0.22, hgt * 0.16, 0.1);

  const hlL = new THREE.Mesh(hlGeom, headLightMat);
  hlL.position.set(-wid * 0.36, hlY, hlZ);
  const hlR = new THREE.Mesh(hlGeom, headLightMat);
  hlR.position.set(wid * 0.36, hlY, hlZ);

  // Additive glow bloom sprites on headlights
  const hlSpriteL = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xfffbeb,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  hlSpriteL.scale.set(2.4, 2.4, 1);
  hlSpriteL.position.set(-wid * 0.36, hlY, hlZ + 0.2);

  const hlSpriteR = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xfffbeb,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  hlSpriteR.scale.set(2.4, 2.4, 1);
  hlSpriteR.position.set(wid * 0.36, hlY, hlZ + 0.2);

  // Forward road illumination beam quad on the asphalt surface
  const beamMat = new THREE.MeshBasicMaterial({
    map: beamTex,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const beamGeom = new THREE.PlaneGeometry(wid * 1.8, 12);
  beamGeom.rotateX(-Math.PI / 2);
  const beamMesh = new THREE.Mesh(beamGeom, beamMat);
  beamMesh.position.set(0, 0.05, hlZ + 6.0);

  group.add(hlL, hlR, hlSpriteL, hlSpriteR, beamMesh);
  vehicle.headlights = [hlL, hlR, hlSpriteL, hlSpriteR, beamMesh];

  // Taillights
  const tlY = hgt * 0.36 + wheelR * 0.7;
  const tlZ = -len * 0.5;
  const tlGeom = new THREE.BoxGeometry(wid * 0.24, hgt * 0.14, 0.1);

  const tlL = new THREE.Mesh(tlGeom, tailLightMat);
  tlL.position.set(-wid * 0.36, tlY, tlZ);
  const tlR = new THREE.Mesh(tlGeom, tailLightMat);
  tlR.position.set(wid * 0.36, tlY, tlZ);

  // Additive red glow sprites on taillights
  const tlSpriteL = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xef4444,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  tlSpriteL.scale.set(1.8, 1.8, 1);
  tlSpriteL.position.set(-wid * 0.36, tlY, tlZ - 0.15);

  const tlSpriteR = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xef4444,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  tlSpriteR.scale.set(1.8, 1.8, 1);
  tlSpriteR.position.set(wid * 0.36, tlY, tlZ - 0.15);

  group.add(tlL, tlR, tlSpriteL, tlSpriteR);
  vehicle.taillights = [tlL, tlR, tlSpriteL, tlSpriteR];

  // 4 Wheels
  const wheelGeom = new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 12);
  wheelGeom.rotateZ(Math.PI / 2);

  const wheelPositions = [
    { x: -wid * 0.5, z: spec.wheelBase * 0.5, isFront: true },
    { x: wid * 0.5, z: spec.wheelBase * 0.5, isFront: true },
    { x: -wid * 0.5, z: -spec.wheelBase * 0.5, isFront: false },
    { x: wid * 0.5, z: -spec.wheelBase * 0.5, isFront: false },
  ];

  vehicle.frontWheels = [];
  vehicle.rearWheels = [];

  for (let i = 0; i < wheelPositions.length; i++) {
    const wp = wheelPositions[i];
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(wp.x, wheelR, wp.z);

    const wheelMesh = new THREE.Mesh(wheelGeom, blackMat);
    wheelMesh.castShadow = true;
    wheelGroup.add(wheelMesh);

    // Rim hubcap
    const rimGeom = new THREE.CylinderGeometry(wheelR * 0.52, wheelR * 0.52, wheelW * 1.05, 8);
    rimGeom.rotateZ(Math.PI / 2);
    const rimMesh = new THREE.Mesh(rimGeom, chromeMat);
    wheelGroup.add(rimMesh);

    group.add(wheelGroup);

    if (wp.isFront) {
      vehicle.frontWheels.push(wheelGroup);
    } else {
      vehicle.rearWheels.push(wheelGroup);
    }
  }

  vehicle.mesh = group;
  return group;
}

// Synchronize Three.js mesh with vehicle physics state
export function syncVehicleMesh(vehicle, dt) {
  if (!vehicle.mesh) return;

  vehicle.mesh.position.set(vehicle.x, vehicle.y, vehicle.z);
  vehicle.mesh.rotation.y = vehicle.angle;

  // Front wheels steering yaw
  for (let i = 0; i < vehicle.frontWheels.length; i++) {
    vehicle.frontWheels[i].rotation.y = vehicle.steerAngle;
    vehicle.frontWheels[i].children[0].rotation.x += (vehicle.speed / (vehicle.spec.height * 0.28)) * dt;
  }

  // Rear wheels spin
  for (let i = 0; i < vehicle.rearWheels.length; i++) {
    vehicle.rearWheels[i].children[0].rotation.x += (vehicle.speed / (vehicle.spec.height * 0.28)) * dt;
  }

  // Police strobe siren animation
  if (vehicle.isPolice && vehicle.sirenLights && vehicle.sirenSprites) {
    vehicle.sirenTimer = (vehicle.sirenTimer || 0) + dt * 12;
    const isRed = Math.floor(vehicle.sirenTimer) % 2 === 0;

    vehicle.sirenLights[0].material.color.setHex(isRed ? 0xff0000 : 0x330000);
    vehicle.sirenLights[1].material.color.setHex(!isRed ? 0x0088ff : 0x001133);

    vehicle.sirenSprites[0].visible = isRed;
    vehicle.sirenSprites[1].visible = !isRed;
  }
}
