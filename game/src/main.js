// NEON HARBOR: HEATLINE - Main bootstrap and fixed-timestep game loop.
import * as THREE from 'three';
import { STEP, DEFAULT_CITY_SEED, SAVE_STORAGE_KEY } from './config.js';
import { createRandom } from './random.js';
import { generateCity, getDistrictAt } from './city.js';
import { createRenderer } from './render3d.js';
import { createPlayer, updatePlayer, respawnPlayer } from './player.js';
import { createVehicle, buildVehicleMesh, syncVehicleMesh } from './vehicles.js';
import { createTrafficSystem } from './traffic.js';
import { createPedestrian, buildPedestrianMesh, updatePedestrians } from './pedestrians.js';
import { createWantedSystem } from './wanted.js';
import { createCombatSystem } from './combat.js';
import { createMissionSystem } from './missions.js';
import { createEconomySystem } from './economy.js';
import { createAudioSystem } from './audio.js';
import { createMinimap } from './minimap.js';
import { createHud } from './hud.js';
import { createUiManager } from './ui.js';
import { createInput } from './input.js';
import { updateVehiclePhysics } from './physics.js';
import { stageScreenshotScene } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotParam = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : DEFAULT_CITY_SEED;

const rng = createRandom(seed);
const city = generateCity(seed);

// DOM Elements
const canvas = document.getElementById('game');
const minimapCanvas = document.getElementById('minimap');
const hudContainer = document.getElementById('hud');
const uiContainer = document.getElementById('ui');

// Core Subsystems
const renderer = createRenderer(canvas);
renderer.buildCityMeshes(city);

const audio = createAudioSystem();
const input = createInput(canvas);
const player = createPlayer(180, 240);
renderer.scene.add(player.mesh);

// Parked Cars
const vehicles = [];
city.parkedCars.forEach((p) => {
  const v = createVehicle(p.vehicleClass, p.x, p.z, p.angle);
  v.isParked = true;
  buildVehicleMesh(v);
  renderer.scene.add(v.mesh);
  vehicles.push(v);
});

// Starter Car near player garage
const starterCar = createVehicle('hatch', 185, 235, 0);
starterCar.isParked = true;
buildVehicleMesh(starterCar);
renderer.scene.add(starterCar.mesh);
vehicles.push(starterCar);

// Traffic AI
const traffic = createTrafficSystem(city, rng.fork(9911));
traffic.init(player.x, player.z);
traffic.activeCars.forEach((c) => {
  buildVehicleMesh(c);
  renderer.scene.add(c.mesh);
  vehicles.push(c);
});

// Pedestrians
const pedestrians = [];
for (let i = 0; i < 28; i++) {
  const b = rng.choice(city.buildings);
  const ped = createPedestrian(b.minX - 2.5, b.minZ - 2.5, rng.float(0, Math.PI * 2));
  buildPedestrianMesh(ped);
  renderer.scene.add(ped.mesh);
  pedestrians.push(ped);
}

// Wanted, Combat, Missions, Economy, Minimap, HUD
const wantedSystem = createWantedSystem(city, rng.fork(7723));
const combatSystem = createCombatSystem();
const missionSystem = createMissionSystem();
const economy = createEconomySystem();
const minimap = createMinimap(minimapCanvas);
const hud = createHud(hudContainer);

// UI Manager
let isPaused = false;

const uiManager = createUiManager(uiContainer, (action) => {
  audio.init();

  if (action === 'start_free_roam') {
    uiManager.showScreen('hud');
    isPaused = false;
    audio.startSynthwaveRadio();
  } else if (action === 'open_missions_menu') {
    missionSystem.startMission(1);
    uiManager.showScreen('briefing', missionSystem.activeMission);
  } else if (action === 'accept_mission') {
    missionSystem.acceptBriefing();
    uiManager.showScreen('hud');
    hud.addToast(`Mission: ${missionSystem.activeMission.title} Started!`);
  } else if (action === 'decline_mission') {
    missionSystem.resetToFreeRoam();
    uiManager.showScreen('hud');
  } else if (action === 'continue_free_roam') {
    missionSystem.resetToFreeRoam();
    uiManager.showScreen('hud');
  } else if (action === 'resume') {
    isPaused = false;
    uiManager.showScreen('hud');
  } else if (action === 'restart_mission') {
    if (missionSystem.activeMission) {
      missionSystem.startMission(missionSystem.activeMission.id);
      missionSystem.acceptBriefing();
    }
    isPaused = false;
    uiManager.showScreen('hud');
  } else if (action === 'finish_run') {
    const finalStats = {
      grade: economy.getFinalGrade(),
      score: economy.score,
      cash: economy.cash,
      missionsCompleted: missionSystem.completedMissions.size,
      tokens: economy.tokensCollected,
      busts: economy.bustsCount,
      wastes: economy.wastesCount,
    };
    uiManager.showScreen('results', finalStats);
  } else if (action === 'quit_to_title') {
    uiManager.showScreen('title');
    isPaused = true;
  } else if (action === 'respawn_busted') {
    respawnPlayer(player, { x: 440, z: 460 }); // Police HQ
    uiManager.showScreen('hud');
  } else if (action === 'respawn_wasted') {
    respawnPlayer(player, { x: 740, z: 220 }); // Hospital
    uiManager.showScreen('hud');
  }
});

// Police vehicle meshes dynamic sync
function syncPoliceUnits() {
  wantedSystem.policeCars.forEach((cop) => {
    if (!cop.mesh) {
      buildVehicleMesh(cop);
      renderer.scene.add(cop.mesh);
      vehicles.push(cop);
    }
  });
}

// Fixed-step game update
function tick() {
  if (isPaused) return;

  const inputFrame = input.poll();

  // Pause toggle
  if (inputFrame.pauseJustPressed && uiManager.currentScreen === 'hud') {
    isPaused = true;
    uiManager.showScreen('pause');
    return;
  }

  // Combat Firing
  if (inputFrame.fireJustPressed && combatSystem.canFire()) {
    combatSystem.fireWeapon(
      player,
      renderer.scene,
      (ox, oz, dx, dz, range) => {
        // Raycast against vehicles & pedestrians
        let hit = null;
        for (let i = 0; i < vehicles.length; i++) {
          const v = vehicles[i];
          if (v === player.vehicle || !v.active) continue;
          const toVx = v.x - ox;
          const toVz = v.z - oz;
          const proj = toVx * dx + toVz * dz;
          if (proj > 0 && proj < range) {
            const perpSq = toVx * toVx + toVz * toVz - proj * proj;
            if (perpSq < 2.5 * 2.5) {
              v.hp = Math.max(0, v.hp - 35);
              hit = v;
              break;
            }
          }
        }
        return hit;
      },
      (shotInfo) => {
        audio.playGunshot();
        wantedSystem.addHeat(30, 'DISCHARGE_FIREARM');
      }
    );
  }

  combatSystem.update(renderer.scene, STEP);

  // Player & Driving physics
  if (player.inVehicle && player.vehicle) {
    const v = player.vehicle;
    const { impactOccurred, impactImpulse } = updateVehiclePhysics(
      v,
      inputFrame,
      city.buildings,
      vehicles
    );

    if (impactOccurred) {
      audio.playImpact(impactImpulse);
      player.screenShake = Math.min(1.2, impactImpulse * 0.08);
      if (impactImpulse > 9.0) {
        wantedSystem.addHeat(25, 'RECKLESS_COLLISION');
        missionSystem.registerDemolitionHit();
      }
    }

    if (v.isDrifting && Math.random() < 0.25) {
      audio.playTireScreech();
    }

    audio.updateEngine(v.speed, v.spec.topSpeed, true);
  } else {
    audio.updateEngine(0, 30, false);
  }

  // Update Rafi Sol
  updatePlayer(player, inputFrame, city.buildings, vehicles, renderer.camera, STEP);

  // Traffic & Pedestrians AI
  traffic.update(player, city.buildings, wantedSystem.policeCars, wantedSystem.stars);
  updatePedestrians(pedestrians, player, vehicles, rng);

  // Wanted police pursuit
  syncPoliceUnits();
  wantedSystem.update(
    player,
    city.buildings,
    vehicles,
    () => {
      // BUSTED!
      audio.playImpact(15);
      economy.recordBust();
      missionSystem.failMission('Arrested by police!', () => {});
      uiManager.showScreen('busted');
    },
    () => {
      // HEAT LOST
      hud.addToast('Heat Lost! +$150', 'info');
      economy.addCash(150, 'HEAT_LOST');
      economy.addScore(250);
      audio.playCashChime();
    }
  );

  audio.updateSiren(wantedSystem.stars > 0 && wantedSystem.inLineOfSight);

  // Missions update
  missionSystem.update(
    player,
    wantedSystem,
    (res) => {
      // Mission Complete!
      audio.playMissionFanfare();
      economy.addCash(res.cash, 'MISSION_REWARD');
      economy.addScore(res.score);
      uiManager.showScreen('complete', res);
    },
    (res) => {
      // Mission Failed
      hud.addToast(`Job Failed: ${res.reason}`, 'alert');
      missionSystem.resetToFreeRoam();
    }
  );

  // Economy stunt & collectible pickups
  economy.checkTokenPickups(player, city.tokens, (count, total) => {
    audio.playCashChime();
    hud.addToast(`Sol Token Found! (${count}/${total}) +$50`, 'info');
  });

  economy.updateStunts(player, traffic.activeCars, (stuntMsg, pts) => {
    hud.addToast(stuntMsg, 'info');
  });

  // Sync 3D meshes for all vehicles
  for (let i = 0; i < vehicles.length; i++) {
    syncVehicleMesh(vehicles[i], STEP);
  }

  // Visuals & Waypoints
  const currentDistrict = getDistrictAt(player.x, player.z);
  const activeWaypoint = missionSystem.getActiveWaypoint();
  renderer.updateVisuals(STEP, activeWaypoint, player.x, player.z);

  // Minimap & HUD
  minimap.render(
    player,
    city,
    wantedSystem.policeCars,
    activeWaypoint,
    city.tokens,
    player.hp / player.maxHp
  );

  hud.update(STEP);
  if (uiManager.currentScreen === 'hud') {
    hud.render(player, wantedSystem, missionSystem, economy, currentDistrict);
  }
}

// Render & animation loop with fixed timestep accumulator
let accumulator = 0;
let lastTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);

  const delta = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += delta;

  while (accumulator >= STEP) {
    tick();
    accumulator -= STEP;
  }

  renderer.render(delta);
}

// Automated screenshot query execution
if (shotParam) {
  isPaused = false;
  stageScreenshotScene(shotParam, {
    player,
    vehicles,
    pedestrians,
    city,
    wantedSystem,
    missionSystem,
    economy,
    uiManager,
    renderer,
  });

  // Paint two frames and signal screenshot readiness
  let frames = 0;
  function paintShot() {
    tick();
    renderer.render(STEP);
    frames++;
    if (frames < 3) {
      requestAnimationFrame(paintShot);
    } else {
      window.__shotReady = true;
    }
  }
  requestAnimationFrame(paintShot);
} else {
  // Start normal interactive game on Title screen
  uiManager.showScreen('title');
  requestAnimationFrame(animate);
}
