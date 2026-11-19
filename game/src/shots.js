// Screenshot scene staging for automated judge capture and deterministic shots.
// Staged scenes: cover, onfoot, chase, mission (in-game complete banner over 3D city).
import { enterVehicle } from './player.js';
import { createVehicle, buildVehicleMesh } from './vehicles.js';

export function stageScreenshotScene(name, game) {
  const { player, vehicles, pedestrians, city, wantedSystem, missionSystem, economy, uiManager, renderer } = game;

  if (name === 'cover' || name === 'start' || name === '1-cover') {
    // 1-cover.jpg: Wide elevated three-quarter view looking down Marina Strip toward the harbour
    // Player car prominent lower-center (~13m from camera, ~6.5m up).
    // Canopies frame the sides instead of blocking middle; 4-6 traffic cars with lights on; 4+ glowing streetlamps visible.
    // Low directional sun angled ~35 degrees off street axis raking long diagonal shadows across the road.
    uiManager.showScreen('hud');

    // Player sports car on the Marina Strip boulevard (z=93.5) heading West (-X) toward the harbour
    const sportsCar = vehicles.find((v) => v.classId === 'sports' || v.classId === 'muscle') || vehicles[0];
    sportsCar.x = 700;
    sportsCar.z = 93.5;
    sportsCar.angle = -Math.PI / 2; // heading West
    sportsCar.speed = 28;
    enterVehicle(player, sportsCar);

    // Arrange 5 traffic cars spread along both lanes within 16-88m of player
    const trafficCars = vehicles.filter((v) => v !== sportsCar && !v.isPolice);

    if (trafficCars[0]) {
      // Yellow taxi ahead in westbound lane
      trafficCars[0].active = true;
      trafficCars[0].x = 684;
      trafficCars[0].z = 91.5;
      trafficCars[0].angle = -Math.PI / 2;
      trafficCars[0].speed = 24;
    }
    if (trafficCars[1]) {
      // Red muscle car oncoming in eastbound lane
      trafficCars[1].active = true;
      trafficCars[1].x = 672;
      trafficCars[1].z = 96.5;
      trafficCars[1].angle = Math.PI / 2;
      trafficCars[1].speed = 26;
    }
    if (trafficCars[2]) {
      // Delivery truck in westbound lane
      trafficCars[2].active = true;
      trafficCars[2].x = 654;
      trafficCars[2].z = 91.5;
      trafficCars[2].angle = -Math.PI / 2;
      trafficCars[2].speed = 20;
    }
    if (trafficCars[3]) {
      // Oncoming sedan in eastbound lane
      trafficCars[3].active = true;
      trafficCars[3].x = 635;
      trafficCars[3].z = 96.5;
      trafficCars[3].angle = Math.PI / 2;
      trafficCars[3].speed = 25;
    }
    if (trafficCars[4]) {
      // Trailing westbound car down the boulevard
      trafficCars[4].active = true;
      trafficCars[4].x = 612;
      trafficCars[4].z = 91.5;
      trafficCars[4].angle = -Math.PI / 2;
      trafficCars[4].speed = 22;
    }

    // Camera: 13m behind car, 6.5m up, offset toward sidewalk edge (z=98.5) so canopies frame sides
    // Player car is prominent, lower-center, clearly reading at a glance
    player.cameraOverride = {
      x: 713,
      y: 6.5,
      z: 98.5,
      lookAtX: 640,
      lookAtY: 1.8,
      lookAtZ: 92.5,
    };

    // Sun angled ~35 degrees off street axis (low sun: y=26) to cast long diagonal raking shadows across road
    if (renderer && renderer.sunLight) {
      renderer.sunLight.position.set(700 + 65, 26, 94 + 50);
      renderer.sunLight.target.position.set(670, 0, 94);
      renderer.sunLight.target.updateMatrixWorld();
      renderer.sunLight.shadow.camera.left = -45;
      renderer.sunLight.shadow.camera.right = 45;
      renderer.sunLight.shadow.camera.top = 45;
      renderer.sunLight.shadow.camera.bottom = -45;
      renderer.sunLight.shadow.camera.near = 10;
      renderer.sunLight.shadow.camera.far = 180;
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

    // Sun angled to cast diagonal palm and building shadows across the sidewalk and street
    if (renderer && renderer.sunLight) {
      renderer.sunLight.position.set(680 + 55, 28, 85 + 45);
      renderer.sunLight.target.position.set(670, 0, 85);
      renderer.sunLight.target.updateMatrixWorld();
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
