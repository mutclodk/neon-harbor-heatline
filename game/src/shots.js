// Screenshot scene staging for automated judge capture and deterministic shots.
// Staged scenes: cover, onfoot, chase, mission (in-game complete banner over 3D city).
import { enterVehicle } from './player.js';
import { createVehicle, buildVehicleMesh } from './vehicles.js';

export function stageScreenshotScene(name, game) {
  const { player, vehicles, pedestrians, city, wantedSystem, missionSystem, economy, uiManager } = game;

  if (name === 'cover' || name === 'start' || name === '1-cover') {
    // 1-cover.jpg: Wide elevated three-quarter view looking down Marina Strip toward the harbour
    // Camera on street side: 20m behind player, 9m above road, looking down street axis.
    // Zero buildings within 10m of camera. Player car lower-center.
    // Top third: golden-hour sky gradient. Skyline with lit windows, palms, streetlamps, harbour cranes & ocean at end.
    // 5 traffic cars spread over the road with headlights & taillights on.
    uiManager.showScreen('hud');

    // Player sports car on the Marina Strip boulevard (z=94) heading West (-X) toward the harbour
    const sportsCar = vehicles.find((v) => v.classId === 'sports' || v.classId === 'muscle') || vehicles[0];
    sportsCar.x = 700;
    sportsCar.z = 94; // center of the 14m wide street
    sportsCar.angle = -Math.PI / 2; // heading West
    sportsCar.speed = 28;
    enterVehicle(player, sportsCar);

    // Arrange 5 traffic cars spread along the road ahead with headlights/taillights on
    const trafficCars = vehicles.filter((v) => v !== sportsCar && !v.isPolice);

    if (trafficCars[0]) {
      // Ahead in westbound lane
      trafficCars[0].active = true;
      trafficCars[0].x = 665;
      trafficCars[0].z = 91.5;
      trafficCars[0].angle = -Math.PI / 2;
      trafficCars[0].speed = 24;
    }
    if (trafficCars[1]) {
      // Oncoming in eastbound lane
      trafficCars[1].active = true;
      trafficCars[1].x = 640;
      trafficCars[1].z = 96.5;
      trafficCars[1].angle = Math.PI / 2;
      trafficCars[1].speed = 26;
    }
    if (trafficCars[2]) {
      // Delivery truck further down toward harbour
      trafficCars[2].active = true;
      trafficCars[2].x = 600;
      trafficCars[2].z = 91.5;
      trafficCars[2].angle = -Math.PI / 2;
      trafficCars[2].speed = 20;
    }
    if (trafficCars[3]) {
      // Oncoming car in eastbound lane
      trafficCars[3].active = true;
      trafficCars[3].x = 565;
      trafficCars[3].z = 96.5;
      trafficCars[3].angle = Math.PI / 2;
      trafficCars[3].speed = 25;
    }
    if (trafficCars[4]) {
      // Car near harbour entrance
      trafficCars[4].active = true;
      trafficCars[4].x = 525;
      trafficCars[4].z = 91.5;
      trafficCars[4].angle = -Math.PI / 2;
      trafficCars[4].speed = 22;
    }

    // Elevated camera on the street axis (20m behind player, 9m above road)
    // Guarantee: camZ=94 is center of street (10m from any building wall!)
    player.cameraOverride = {
      x: 720,
      y: 9.0,
      z: 94,
      lookAtX: 610,
      lookAtY: 2.2,
      lookAtZ: 94,
    };

    economy.addCash(1250);
    economy.addScore(1850);
  } else if (name === 'onfoot' || name === 'play' || name === '2-onfoot') {
    // 2-onfoot.jpg: On foot in Marina Strip market district along the sidewalk
    // 5 pedestrians within 3-8m of player, player in third person among them.
    // Camera at ~5.5m behind player at head height +1m (2.7m), offset sideways into the street so no trunk blocks lens.
    uiManager.showScreen('hud');
    player.inVehicle = false;
    player.vehicle = null;
    player.x = 680;
    player.z = 85.5; // on sidewalk along Marina Strip
    player.facingAngle = -Math.PI / 2; // walking West down sidewalk

    // Position 5 pedestrians on the sidewalk within 3-8m of the player
    if (pedestrians && pedestrians.length > 0) {
      const pedPositions = [
        { x: 676, z: 85.2, angle: -Math.PI / 2 },
        { x: 673, z: 86.0, angle: Math.PI / 2 },
        { x: 684, z: 85.0, angle: -Math.PI / 2 },
        { x: 677, z: 86.4, angle: -Math.PI / 2 },
        { x: 686, z: 85.8, angle: Math.PI / 2 },
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
      vehicles[0].x = 682;
      vehicles[0].z = 88.5;
      vehicles[0].angle = -Math.PI / 2;
      vehicles[0].speed = 0;
    }

    // Driving car on the street
    if (vehicles[1]) {
      vehicles[1].x = 672;
      vehicles[1].z = 95.0;
      vehicles[1].angle = -Math.PI / 2;
      vehicles[1].speed = 18;
    }

    // Mission 2 active for the glowing waypoint beacon
    missionSystem.startMission(2);
    missionSystem.acceptBriefing();

    // Camera: 5.5m behind player (+X = 685.5), 2.7m high, offset sideways into street (z=89.0)
    // No palm trunk or wall blocks the lens; angled down the sidewalk showing player and pedestrians!
    player.cameraOverride = {
      x: 685.5,
      y: 2.7,
      z: 89.0,
      lookAtX: 673,
      lookAtY: 1.4,
      lookAtZ: 85.5,
    };
  } else if (name === 'chase' || name === '3-chase') {
    // 3-chase.jpg: High-action police chase mid-city in Centro with 2 police interceptors LARGE in frame!
    // Staged on lit Centro avenue (x=564), heading North (-Z).
    // 2 police cars 6-8m behind player car, large in frame with alternating red/blue flashing glow sprites!
    // Camera: elevated 8.5m on street axis, 19m behind player, looking down street axis.
    uiManager.showScreen('hud');

    const playerCar = vehicles.find((v) => v.classId === 'muscle' || v.classId === 'sports') || vehicles[0];
    playerCar.x = 564;
    playerCar.z = 470; // heading North down Centro avenue
    playerCar.angle = Math.PI; // heading North (-Z)
    playerCar.speed = 38;
    enterVehicle(player, playerCar);

    // Escalate heat to 3 stars
    wantedSystem.addHeat(285, 'HIGH_SPEED_CHASE');

    // Spawn 2 police interceptors 6-8m behind the player car (LARGE in frame!)
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
    cop1.sirenTimer = 0; // red strobe

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
    cop2.sirenTimer = 1.0; // blue strobe

    // Camera: elevated 8.5m on the street center axis (x=564), 19m behind player (z=489)
    // 14m from any building wall! Looking North down the street axis:
    // Frames the 2 large police cruisers right in front of the lens with glowing red & blue strobes,
    // player car lower-center speeding ahead, lit skyscrapers, streetlamps, and colorful sunset sky!
    player.cameraOverride = {
      x: 564,
      y: 8.5,
      z: 489,
      lookAtX: 564,
      lookAtY: 2.0,
      lookAtZ: 430,
    };
  } else if (name === 'mission' || name === 'end' || name === '4-mission') {
    // 4-mission.jpg: In-game MISSION COMPLETE moment (PASSED in round 2)
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
