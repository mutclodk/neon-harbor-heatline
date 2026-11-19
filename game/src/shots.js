// Screenshot scene staging for automated judge capture and deterministic shots.
// Staged scenes: cover, onfoot, chase, mission (in-game complete banner over 3D city).
import { enterVehicle } from './player.js';
import { createVehicle, buildVehicleMesh } from './vehicles.js';

export function stageScreenshotScene(name, game) {
  const { player, vehicles, pedestrians, city, wantedSystem, missionSystem, economy, uiManager } = game;

  if (name === 'cover' || name === 'start' || name === '1-cover') {
    // 1-cover.jpg: Wide elevated three-quarter view looking down Marina Strip toward the harbour
    // Top third: golden-hour sky. City: skyline with lit windows, palm trees, glowing streetlamps.
    // End of street: harbour water & gantry cranes. Traffic: 5 cars with headlights/taillights on.
    uiManager.showScreen('hud');

    // Player sports car heading West toward the harbour
    const sportsCar = vehicles.find((v) => v.classId === 'sports' || v.classId === 'muscle') || vehicles[0];
    sportsCar.x = 720;
    sportsCar.z = 90.5; // right westbound lane
    sportsCar.angle = -Math.PI / 2; // heading West
    sportsCar.speed = 28;
    enterVehicle(player, sportsCar);

    // Arrange 5 surrounding traffic cars with headlights & taillights active
    const trafficCars = vehicles.filter((v) => v !== sportsCar && !v.isPolice);

    if (trafficCars[0]) {
      // Yellow taxi / sedan ahead in player's lane
      trafficCars[0].active = true;
      trafficCars[0].x = 665;
      trafficCars[0].z = 90.5;
      trafficCars[0].angle = -Math.PI / 2;
      trafficCars[0].speed = 24;
    }
    if (trafficCars[1]) {
      // Red muscle car oncoming in opposite eastbound lane
      trafficCars[1].active = true;
      trafficCars[1].x = 645;
      trafficCars[1].z = 97.5;
      trafficCars[1].angle = Math.PI / 2;
      trafficCars[1].speed = 26;
    }
    if (trafficCars[2]) {
      // Delivery truck further down the avenue toward harbour
      trafficCars[2].active = true;
      trafficCars[2].x = 595;
      trafficCars[2].z = 90.5;
      trafficCars[2].angle = -Math.PI / 2;
      trafficCars[2].speed = 20;
    }
    if (trafficCars[3]) {
      // Second oncoming sedan in opposite lane
      trafficCars[3].active = true;
      trafficCars[3].x = 560;
      trafficCars[3].z = 97.5;
      trafficCars[3].angle = Math.PI / 2;
      trafficCars[3].speed = 25;
    }
    if (trafficCars[4]) {
      // Trailing sports car in opposite lane
      trafficCars[4].active = true;
      trafficCars[4].x = 745;
      trafficCars[4].z = 97.5;
      trafficCars[4].angle = Math.PI / 2;
      trafficCars[4].speed = 26;
    }

    // Wide elevated camera: pulled back & up, looking down the avenue toward the harbour & sunset
    player.cameraOverride = {
      x: 770,
      y: 15.5,
      z: 114,
      lookAtX: 620,
      lookAtY: 2.5,
      lookAtZ: 88,
    };

    economy.addCash(1250);
    economy.addScore(1850);
  } else if (name === 'onfoot' || name === 'play' || name === '2-onfoot') {
    // 2-onfoot.jpg: On foot in Marina Strip market district along the sidewalk
    // Player + at least 4 pedestrians on sidewalk, street with parked & driving car, palms & lamps, sky visible.
    uiManager.showScreen('hud');
    player.inVehicle = false;
    player.vehicle = null;
    player.x = 692;
    player.z = 85.5; // on sidewalk along Marina Strip
    player.facingAngle = -Math.PI / 2; // walking West down sidewalk

    // Position 5 pedestrians walking on the sidewalk
    if (pedestrians && pedestrians.length > 0) {
      const pedPositions = [
        { x: 684, z: 85.0, angle: -Math.PI / 2 },
        { x: 677, z: 85.8, angle: -Math.PI / 2 },
        { x: 700, z: 85.2, angle: Math.PI / 2 },
        { x: 708, z: 84.8, angle: Math.PI / 2 },
        { x: 670, z: 85.0, angle: -Math.PI / 2 },
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

    // Parked sports car at the curb beside the sidewalk
    if (vehicles[0]) {
      vehicles[0].x = 696;
      vehicles[0].z = 89.5;
      vehicles[0].angle = -Math.PI / 2;
      vehicles[0].speed = 0;
    }

    // Driving car on the street
    if (vehicles[1]) {
      vehicles[1].x = 680;
      vehicles[1].z = 95.0;
      vehicles[1].angle = -Math.PI / 2;
      vehicles[1].speed = 18;
    }

    // Mission 2 active for the glowing waypoint beacon
    missionSystem.startMission(2);
    missionSystem.acceptBriefing();

    // Camera angled along the sidewalk from street side, pulled back so player & pedestrians & sky are in frame
    player.cameraOverride = {
      x: 710,
      y: 3.8,
      z: 97,
      lookAtX: 672,
      lookAtY: 1.5,
      lookAtZ: 85,
    };
  } else if (name === 'chase' || name === '3-chase') {
    // 3-chase.jpg: High-action police chase mid-city in Centro with 2 police cars visible in frame!
    // Staged on lit Centro avenue with flashing red/blue light glow, wanted stars up, skyline & sky visible.
    uiManager.showScreen('hud');

    const playerCar = vehicles.find((v) => v.classId === 'muscle' || v.classId === 'sports') || vehicles[0];
    playerCar.x = 561;
    playerCar.z = 478; // speeding North down Centro avenue
    playerCar.angle = Math.PI; // heading North
    playerCar.speed = 38;
    enterVehicle(player, playerCar);

    // Escalate heat to 3 stars
    wantedSystem.addHeat(285, 'HIGH_SPEED_CHASE');

    // Ensure 2 police interceptors exist and are in the scene
    let cop1 = wantedSystem.policeCars[0];
    if (!cop1) {
      cop1 = createVehicle('police', 560.5, 498, Math.PI);
      buildVehicleMesh(cop1);
      wantedSystem.policeCars.push(cop1);
      vehicles.push(cop1);
      game.renderer?.scene?.add(cop1.mesh);
    } else {
      cop1.x = 560.5;
      cop1.z = 498;
      cop1.angle = Math.PI;
    }
    cop1.active = true;
    cop1.speed = 36;
    cop1.sirenTimer = 0; // red strobe

    let cop2 = wantedSystem.policeCars[1];
    if (!cop2) {
      cop2 = createVehicle('police', 567.5, 514, Math.PI - 0.08);
      buildVehicleMesh(cop2);
      wantedSystem.policeCars.push(cop2);
      vehicles.push(cop2);
      game.renderer?.scene?.add(cop2.mesh);
    } else {
      cop2.x = 567.5;
      cop2.z = 514;
      cop2.angle = Math.PI - 0.08;
    }
    cop2.active = true;
    cop2.speed = 38;
    cop2.sirenTimer = 1.0; // blue strobe

    // Elevated trailing chase camera looking North down Centro avenue:
    // Frames the 2 police cars pursuing right behind player, lit skyscrapers, streetlamps, and colorful sky!
    player.cameraOverride = {
      x: 553,
      y: 9.8,
      z: 536,
      lookAtX: 563,
      lookAtY: 1.8,
      lookAtZ: 458,
    };
  } else if (name === 'mission' || name === 'end' || name === '4-mission') {
    // 4-mission.jpg: In-game MISSION COMPLETE moment
    // 3D city scene clearly visible behind a glowing mission complete card with reward & medal!

    // Stage 3D world: player car parked at Marina drop-off at golden hour
    const sportsCar = vehicles.find((v) => v.classId === 'sports' || v.classId === 'sedan') || vehicles[0];
    sportsCar.x = 720;
    sportsCar.z = 90.5;
    sportsCar.angle = -Math.PI / 2;
    sportsCar.speed = 0;
    enterVehicle(player, sportsCar);

    // Camera angled to show the sports car, palm trees, lit buildings, and golden sunset sky
    player.cameraOverride = {
      x: 745,
      y: 5.2,
      z: 106,
      lookAtX: 712,
      lookAtY: 1.5,
      lookAtZ: 88,
    };

    // Show the in-game Mission Complete modal card
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
