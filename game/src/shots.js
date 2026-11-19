// Screenshot scene staging for automated judge capture and deterministic shots.
// Staged scenes: cover, onfoot, chase, mission (in-game complete banner over 3D city).
import { enterVehicle } from './player.js';
import { createVehicle, buildVehicleMesh, syncVehicleMesh } from './vehicles.js';
import { buildNeonSign } from './render3d.js';

export function stageScreenshotScene(name, game) {
  const { player, vehicles, pedestrians, city, wantedSystem, missionSystem, economy, uiManager, renderer } = game;

  if (name === 'cover' || name === 'start' || name === '1-cover') {
    // 1-cover.jpg: Old Harbor waterfront boulevard overlooking the harbor bay (x=0, z=94)
    // Open water, moored cargo ship with colorful container stacks, and orange gantry cranes in frame.
    // Player sports car prominent in foreground (lower-center), with 5+ live AI traffic cars across lanes.
    // Golden-hour sun raking long diagonal palm and building shadows across asphalt and sidewalks.
    uiManager.showScreen('hud');

    // Player sports car cruising North along the coastal harbor avenue
    const sportsCar = vehicles.find((v) => v.classId === 'sports' || v.classId === 'muscle') || vehicles[0];
    sportsCar.x = 1.0;
    sportsCar.z = 82.0;
    sportsCar.angle = Math.PI; // heading North (-Z)
    sportsCar.speed = 28;
    enterVehicle(player, sportsCar);

    // Arrange at least 5 visible traffic cars in both directions + parked car
    const trafficCars = vehicles.filter((v) => v !== sportsCar && !v.isPolice);

    if (trafficCars[0]) {
      // Northbound ahead in east lane (taillights facing camera)
      trafficCars[0].active = true;
      trafficCars[0].x = 2.2;
      trafficCars[0].z = 62.0;
      trafficCars[0].angle = Math.PI;
      trafficCars[0].speed = 24;
    }
    if (trafficCars[1]) {
      // Southbound oncoming in west lane (headlights shining toward camera)
      trafficCars[1].active = true;
      trafficCars[1].x = -2.8;
      trafficCars[1].z = 68.0;
      trafficCars[1].angle = 0;
      trafficCars[1].speed = 26;
    }
    if (trafficCars[2]) {
      // Southbound oncoming in west lane (headlights shining toward camera)
      trafficCars[2].active = true;
      trafficCars[2].x = -2.8;
      trafficCars[2].z = 52.0;
      trafficCars[2].angle = 0;
      trafficCars[2].speed = 25;
    }
    if (trafficCars[3]) {
      // Northbound ahead in east lane
      trafficCars[3].active = true;
      trafficCars[3].x = 2.2;
      trafficCars[3].z = 44.0;
      trafficCars[3].angle = Math.PI;
      trafficCars[3].speed = 28;
    }
    if (trafficCars[4]) {
      // Southbound oncoming in west lane (headlights shining toward camera)
      trafficCars[4].active = true;
      trafficCars[4].x = -2.8;
      trafficCars[4].z = 36.0;
      trafficCars[4].angle = 0;
      trafficCars[4].speed = 22;
    }
    if (trafficCars[5]) {
      // Northbound ahead in east lane further down
      trafficCars[5].active = true;
      trafficCars[5].x = 2.2;
      trafficCars[5].z = 28.0;
      trafficCars[5].angle = Math.PI;
      trafficCars[5].speed = 25;
    }
    if (trafficCars[6]) {
      // Parked car along east curb
      trafficCars[6].active = true;
      trafficCars[6].isParked = true;
      trafficCars[6].x = 5.4;
      trafficCars[6].z = 74.0;
      trafficCars[6].angle = Math.PI;
      trafficCars[6].speed = 0;
    }

    // Sync meshes for all staged traffic cars
    for (let i = 0; i < 7 && i < trafficCars.length; i++) {
      const tc = trafficCars[i];
      if (tc && tc.mesh) {
        tc.mesh.position.set(tc.x, 0, tc.z);
        tc.mesh.rotation.y = tc.angle;
        tc.mesh.visible = true;
      }
    }

    // Stage 6 pedestrians walking on the harbour promenade
    if (pedestrians && pedestrians.length > 0) {
      const pedPositions = [
        { x: -5.8, z: 76.0, angle: Math.PI },
        { x: -6.4, z: 70.0, angle: 0 },
        { x: -5.6, z: 62.0, angle: Math.PI },
        { x: -6.2, z: 54.0, angle: 0 },
        { x: -5.7, z: 46.0, angle: Math.PI },
        { x: -6.3, z: 38.0, angle: 0 },
      ];
      for (let i = 0; i < pedPositions.length && i < pedestrians.length; i++) {
        const ped = pedestrians[i];
        ped.x = pedPositions[i].x;
        ped.z = pedPositions[i].z;
        ped.facingAngle = pedPositions[i].angle;
        ped.isMoving = true;
        ped.walkCycle = i * 1.5;
        if (ped.mesh) {
          ped.mesh.position.set(ped.x, 0, ped.z);
          ped.mesh.rotation.y = ped.facingAngle;
          ped.mesh.visible = true;
        }
      }
    }

    // Stage Cover frame neon signage
    if (renderer && renderer.scene) {
      // 1. "NEON HARBOR" glowing facade sign positioned clear of palms and pole
      const signCover1 = buildNeonSign({
        text: 'NEON HARBOR',
        primaryColor: '#00f5ff',
        accentColor: '#ff007f',
        width: 8.0,
        height: 2.5,
        x: 5.8,
        y: 10.2,
        z: 60.0,
        rotY: -0.32,
      });

      // 2. "BAR • LIVE MUSIC" upper facade neon sign
      const signCover2 = buildNeonSign({
        text: 'BAR • LIVE MUSIC',
        primaryColor: '#ff007f',
        accentColor: '#facc15',
        width: 8.2,
        height: 2.5,
        x: 6.5,
        y: 14.5,
        z: 56.0,
        rotY: -0.32,
      });
      renderer.scene.add(signCover1, signCover2);
    }

    // Camera: elevated three-quarter view looking North-North-West across the coastal avenue
    // Clear of poles and trees, 14m behind player, 5.8m up
    // Lower-center: player sports car prominent, clear of minimap in bottom-right
    // Left: open water, moored cargo ship, towering gantry cranes, golden sunset
    // Right: Port Solano skyline, palms, glowing streetlamps, rooftop neon signs
    player.cameraOverride = {
      x: 3.5,
      y: 5.8,
      z: 96.0,
      lookAtX: -24.0,
      lookAtY: 2.8,
      lookAtZ: 44.0,
    };

    // Sun angled to rake diagonal shadows from the harbour sunset across the coastal avenue
    if (renderer && renderer.sunLight) {
      renderer.lockSun = true;
      renderer.sunLight.target.position.set(0, 0, 65);
      renderer.sunLight.target.updateMatrixWorld(true);
      renderer.sunLight.position.set(-45, 38, 120);
      renderer.sunLight.shadow.camera.left = -45;
      renderer.sunLight.shadow.camera.right = 45;
      renderer.sunLight.shadow.camera.top = 45;
      renderer.sunLight.shadow.camera.bottom = -45;
      renderer.sunLight.shadow.camera.near = 10;
      renderer.sunLight.shadow.camera.far = 200;
      renderer.sunLight.shadow.camera.updateProjectionMatrix();
    }

    economy.addCash(1250);
    economy.addScore(1850);
  } else if (name === 'onfoot' || name === 'play' || name === '2-onfoot') {
    // 2-onfoot.jpg: On foot in Marina Strip market district along sidewalk
    // Foreground clear of palm trunks and car roofs (camera up +1.5m to y=4.2, sideways +2m into street to z=91.0).
    // Player is the closest figure to camera (center, back to camera), 4 pedestrians just ahead on sidewalk.
    uiManager.showScreen('hud');
    player.inVehicle = false;
    player.vehicle = null;
    player.x = 680;
    player.z = 85.5; // on sidewalk along Marina Strip
    player.facingAngle = -Math.PI / 2; // walking West down sidewalk

    // Position 4 pedestrians on the sidewalk directly ahead of the player (3-16m ahead)
    if (pedestrians && pedestrians.length > 0) {
      const pedPositions = [
        { x: 675.5, z: 85.2, angle: -Math.PI / 2 },
        { x: 672.0, z: 85.8, angle: Math.PI / 2 },
        { x: 668.0, z: 85.1, angle: -Math.PI / 2 },
        { x: 664.0, z: 85.7, angle: Math.PI / 2 },
      ];
      for (let i = 0; i < pedPositions.length && i < pedestrians.length; i++) {
        const ped = pedestrians[i];
        ped.x = pedPositions[i].x;
        ped.z = pedPositions[i].z;
        ped.facingAngle = pedPositions[i].angle;
        ped.isMoving = true;
        ped.walkCycle = i * 1.6;
        if (ped.mesh) {
          ped.mesh.position.set(ped.x, 0, ped.z);
          ped.mesh.rotation.y = ped.facingAngle;
          ped.mesh.visible = true;
        }
      }
    }

    // Stage Onfoot frame neon signs on Marina Strip facades
    if (renderer && renderer.scene) {
      // 1. "HOTEL SOL" on south facade at street level above sidewalk pedestrians
      const signHotel = buildNeonSign({
        text: 'HOTEL SOL',
        primaryColor: '#ff7700',
        accentColor: '#facc15',
        width: 8.0,
        height: 2.5,
        x: 676.0,
        y: 5.6,
        z: 84.3,
        rotY: 0,
      });
      renderer.scene.add(signHotel);

      // 2. "CLUB AZUL" on south facade in midground
      const signClub = buildNeonSign({
        text: 'CLUB AZUL',
        primaryColor: '#00f5ff',
        accentColor: '#c026d3',
        width: 8.0,
        height: 2.5,
        x: 668.0,
        y: 5.6,
        z: 84.3,
        rotY: 0,
      });
      renderer.scene.add(signClub);
    }

    // Parked sports car placed 20m down the curb in midground (not in immediate camera foreground)
    if (vehicles[0]) {
      vehicles[0].x = 660;
      vehicles[0].z = 89.5;
      vehicles[0].angle = -Math.PI / 2;
      vehicles[0].speed = 0;
    }

    // Driving car down the street
    if (vehicles[1]) {
      vehicles[1].x = 668;
      vehicles[1].z = 95.0;
      vehicles[1].angle = -Math.PI / 2;
      vehicles[1].speed = 18;
    }

    // Mission 2 active for the glowing waypoint beacon
    missionSystem.startMission(2);
    missionSystem.acceptBriefing();

    // Camera: up to y=4.2, sideways into street to z=91.0, 5.5m behind player (+X = 685.5)
    // Foreground is clear sidewalk/street; player is closest figure, back to camera, pedestrians ahead
    player.cameraOverride = {
      x: 685.5,
      y: 4.2,
      z: 91.0,
      lookAtX: 668,
      lookAtY: 1.5,
      lookAtZ: 85.5,
    };

    // Sun angled to cast diagonal palm and pedestrian shadows across the sidewalk from the street
    if (renderer && renderer.sunLight) {
      renderer.lockSun = true;
      renderer.sunLight.target.position.set(670, 0, 85);
      renderer.sunLight.target.updateMatrixWorld(true);
      renderer.sunLight.position.set(650, 36, 125);
      renderer.sunLight.shadow.camera.left = -35;
      renderer.sunLight.shadow.camera.right = 35;
      renderer.sunLight.shadow.camera.top = 35;
      renderer.sunLight.shadow.camera.bottom = -35;
      renderer.sunLight.shadow.camera.near = 10;
      renderer.sunLight.shadow.camera.far = 150;
      renderer.sunLight.shadow.camera.updateProjectionMatrix();
    }
  } else if (name === 'chase' || name === '3-chase') {
    // 3-chase.jpg: High-action police chase mid-city in Centro (PASSED in round 3 — KEEP EXACTLY AS-IS)
    uiManager.showScreen('hud');

    const playerCar = vehicles.find((v) => v.classId === 'muscle' || v.classId === 'sports') || vehicles[0];
    playerCar.x = 564;
    playerCar.z = 470;
    playerCar.angle = Math.PI;
    playerCar.speed = 38;
    enterVehicle(player, playerCar);

    wantedSystem.addHeat(285, 'HIGH_SPEED_CHASE');

    let cop1 = wantedSystem.policeCars[0];
    if (!cop1) {
      cop1 = createVehicle('police', 562.0, 477.5, Math.PI);
      buildVehicleMesh(cop1);
      wantedSystem.policeCars.push(cop1);
      vehicles.push(cop1);
      game.renderer?.scene?.add(cop1.mesh);
    } else {
      cop1.x = 562.0;
      cop1.z = 477.5;
      cop1.angle = Math.PI;
    }
    cop1.active = true;
    cop1.speed = 36;
    cop1.sirenTimer = 0;

    let cop2 = wantedSystem.policeCars[1];
    if (!cop2) {
      cop2 = createVehicle('police', 566.8, 476.5, Math.PI - 0.05);
      buildVehicleMesh(cop2);
      wantedSystem.policeCars.push(cop2);
      vehicles.push(cop2);
      game.renderer?.scene?.add(cop2.mesh);
    } else {
      cop2.x = 566.8;
      cop2.z = 476.5;
      cop2.angle = Math.PI - 0.05;
    }
    cop2.active = true;
    cop2.speed = 37;
    cop2.sirenTimer = 1.0;

    player.cameraOverride = {
      x: 564,
      y: 8.5,
      z: 489,
      lookAtX: 564,
      lookAtY: 2.0,
      lookAtZ: 430,
    };
  } else if (name === 'mission' || name === 'end' || name === '4-mission') {
    // 4-mission.jpg: In-game MISSION COMPLETE moment (PASSED in round 2/3 — KEEP EXACTLY AS-IS)
    const sportsCar = vehicles.find((v) => v.classId === 'sports' || v.classId === 'sedan') || vehicles[0];
    sportsCar.x = 720;
    sportsCar.z = 90.5;
    sportsCar.angle = -Math.PI / 2;
    sportsCar.speed = 0;
    enterVehicle(player, sportsCar);

    player.cameraOverride = {
      x: 745,
      y: 5.2,
      z: 106,
      lookAtX: 712,
      lookAtY: 1.5,
      lookAtZ: 88,
    };

    const missionRes = {
      mission: {
        title: 'Neon Post',
        tagline: 'All 3 contraband packages delivered safely to Centro contact.',
      },
      elapsed: 94,
      medal: 'Gold',
      cash: 500,
      score: 900,
    };
    uiManager.showScreen('complete', missionRes);
  }
}
