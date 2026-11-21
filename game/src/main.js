import { CONFIG } from './config.js';
import { generateCity, districtIndexAt } from './city.js';
import { createWorld, stepWorld } from './sim.js';
import { MISSIONS, createMissionState, startMission, stepMissions, buildResults } from './missions.js';
import { createRenderer } from './render3d.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';

// Query string parameters
const urlParams = new URLSearchParams(window.location.search);
const querySeed = urlParams.get('seed') ? parseInt(urlParams.get('seed'), 10) : CONFIG.citySeed;
const shotParam = urlParams.get('shot') || null;
const demoParam = urlParams.has('demo') || urlParams.get('demo') === '1' || urlParams.get('demo') === 'true';

// Core State Setup
let city = generateCity(querySeed, CONFIG);
let world = createWorld(city, CONFIG, querySeed);
let missionState = createMissionState(world);

const canvas = document.getElementById('render-canvas') || document.querySelector('canvas');
const uiRoot = document.getElementById('ui-root') || document.body;

const renderer = createRenderer(canvas, city, CONFIG);
const audio = createAudio();

let isPaused = false;
let isMuted = false;
let currentScreen = 'menu';

// User Input tracking
const keys = {
  up: false,
  down: false,
  left: false,
  right: false,
  sprint: false,
  handbrake: false,
  interact: false
};
let interactTriggered = false;

window.addEventListener('keydown', (e) => {
  audio.unlock();
  const code = e.code;
  if (code === 'KeyW' || code === 'ArrowUp') keys.up = true;
  if (code === 'KeyS' || code === 'ArrowDown') keys.down = true;
  if (code === 'KeyA' || code === 'ArrowLeft') keys.left = true;
  if (code === 'KeyD' || code === 'ArrowRight') keys.right = true;
  if (code === 'ShiftLeft' || code === 'ShiftRight') keys.sprint = true;
  if (code === 'Space') keys.handbrake = true;
  if (code === 'KeyF' || code === 'KeyE' || code === 'Enter') {
    keys.interact = true;
    interactTriggered = true;
  }
  if (code === 'KeyP' || code === 'Escape') {
    uiCallbacks.onTogglePause();
  }
  if (code === 'KeyH') {
    uiCallbacks.onToggleHelp();
  }
  if (code === 'KeyM') {
    isMuted = !isMuted;
    audio.setMuted(isMuted);
  }
});

window.addEventListener('keyup', (e) => {
  const code = e.code;
  if (code === 'KeyW' || code === 'ArrowUp') keys.up = false;
  if (code === 'KeyS' || code === 'ArrowDown') keys.down = false;
  if (code === 'KeyA' || code === 'ArrowLeft') keys.left = false;
  if (code === 'KeyD' || code === 'ArrowRight') keys.right = false;
  if (code === 'ShiftLeft' || code === 'ShiftRight') keys.sprint = false;
  if (code === 'Space') keys.handbrake = false;
  if (code === 'KeyF' || code === 'KeyE' || code === 'Enter') {
    keys.interact = false;
  }
});

const uiCallbacks = {
  onStartMission: (idx) => {
    audio.unlock();
    startMission(world, missionState, idx);
    ui.showScreen('hud');
    currentScreen = 'hud';
    audio.blip('click');
  },
  onResume: () => {
    isPaused = false;
    ui.showScreen('hud');
    currentScreen = 'hud';
    audio.blip('click');
  },
  onRestart: () => {
    city = generateCity(querySeed, CONFIG);
    world = createWorld(city, CONFIG, querySeed);
    missionState = createMissionState(world);
    isPaused = false;
    ui.showScreen('menu');
    currentScreen = 'menu';
    audio.blip('click');
  },
  onQuitToMenu: () => {
    const results = buildResults(world, missionState);
    ui.showScreen('results', results);
    currentScreen = 'results';
    audio.blip('click');
  },
  onTogglePause: () => {
    if (currentScreen === 'hud' || currentScreen === 'pause') {
      isPaused = !isPaused;
      if (isPaused) {
        ui.showScreen('pause');
        currentScreen = 'pause';
      } else {
        ui.showScreen('hud');
        currentScreen = 'hud';
      }
      audio.blip('click');
    }
  },
  onToggleHelp: () => {
    if (currentScreen === 'help') {
      ui.showScreen('hud');
      currentScreen = 'hud';
    } else {
      ui.showScreen('help');
      currentScreen = 'help';
    }
    audio.blip('click');
  }
};

const ui = createUI(uiRoot, uiCallbacks);

// Staged shot camera registrations
const landmarks = city.landmarks || {};
const harbourCrane = landmarks.harbourCraneYard || landmarks.harbour || { x: 200, z: 100 };
const marinaPoint = landmarks.marinaLighthousePoint || landmarks.marina || { x: 100, z: 500 };
const centroPlaza = landmarks.centroTowerPlaza || landmarks.centro || { x: 500, z: 500 };

renderer.setShotCamera('cover', {
  position: { x: harbourCrane.x + 35, y: 18, z: harbourCrane.z - 40 },
  lookAt: { x: harbourCrane.x, y: 3, z: harbourCrane.z + 10 }
});

renderer.setShotCamera('onfoot', {
  position: { x: marinaPoint.x + 12, y: 3.5, z: marinaPoint.z + 14 },
  lookAt: { x: marinaPoint.x, y: 1.2, z: marinaPoint.z }
});

renderer.setShotCamera('chase', {
  position: { x: centroPlaza.x - 22, y: 7, z: centroPlaza.z - 26 },
  lookAt: { x: centroPlaza.x, y: 2, z: centroPlaza.z }
});

renderer.setShotCamera('mission', {
  position: { x: centroPlaza.x + 28, y: 10, z: centroPlaza.z + 28 },
  lookAt: { x: centroPlaza.x, y: 1.5, z: centroPlaza.z }
});

function computeFollowCamera(world) {
  const p = world.player;
  const isDriving = p.mode === 'driving' && p.vehicleId !== null;
  const veh = isDriving ? world.vehicles.find(v => v.id === p.vehicleId) : null;
  const heading = veh ? veh.heading : p.heading;

  const targetX = isDriving && veh ? veh.x : p.x;
  const targetZ = isDriving && veh ? veh.z : p.z;
  const targetY = isDriving ? 1.4 : 1.2;

  const distance = isDriving ? 14.0 : 8.0;
  const height = isDriving ? 5.2 : 3.8;

  const camX = targetX - Math.sin(heading) * distance;
  const camZ = targetZ - Math.cos(heading) * distance;
  const camY = targetY + height;

  return {
    position: { x: camX, y: camY, z: camZ },
    lookAt: { x: targetX, y: targetY, z: targetZ }
  };
}

// Staging mode setup
let isStagingMode = false;
let stagingCameraName = null;

function setupStagingMode(name) {
  isStagingMode = true;
  stagingCameraName = name;

  if (name === 'cover') {
    world.player.x = harbourCrane.x + 8;
    world.player.z = harbourCrane.z + 5;
    const starterTruck = world.vehicles.find(v => v.isPlayerOwned) || world.vehicles[0];
    if (starterTruck) {
      starterTruck.x = harbourCrane.x + 8;
      starterTruck.z = harbourCrane.z + 5;
      starterTruck.heading = Math.PI / 4;
    }
  } else if (name === 'onfoot') {
    world.player.mode = 'foot';
    world.player.vehicleId = null;
    world.player.x = marinaPoint.x;
    world.player.z = marinaPoint.z;
    world.player.heading = Math.PI * 0.75;
  } else if (name === 'chase') {
    const starterTruck = world.vehicles.find(v => v.isPlayerOwned) || world.vehicles[0];
    if (starterTruck) {
      starterTruck.x = centroPlaza.x;
      starterTruck.z = centroPlaza.z;
      starterTruck.speed = 12.0;
      starterTruck.heading = 0;
      world.player.mode = 'driving';
      world.player.vehicleId = starterTruck.id;
    }
    world.wanted.stars = 3;
    world.wanted.heat = 75;
    world.vehicles.push({
      id: 9999,
      classIndex: 1,
      kind: 'police',
      x: centroPlaza.x - 4.5,
      z: centroPlaza.z - 6.0,
      heading: 0,
      speed: 12.0,
      health: 120,
      bodyColour: '#ffffff',
      driverAi: { state: 'pursue', targetVehicleId: starterTruck ? starterTruck.id : null },
      isPlayerOwned: false,
      isWreck: false,
      isSmoking: false
    });
  } else if (name === 'mission') {
    startMission(world, missionState, 0);
    const starterTruck = world.vehicles.find(v => v.isPlayerOwned) || world.vehicles[0];
    if (starterTruck) {
      starterTruck.x = centroPlaza.x - 15;
      starterTruck.z = centroPlaza.z - 15;
      starterTruck.heading = Math.PI / 4;
      starterTruck.speed = 8.0;
      world.player.mode = 'driving';
      world.player.vehicleId = starterTruck.id;
    }
  }
}

function getDemoInput() {
  const p = world.player;
  const isDriving = p.mode === 'driving' && p.vehicleId !== null;
  if (!isDriving) {
    return { moveX: 0, moveZ: 1, sprint: false, throttle: 0, steer: 0, handbrake: false, interact: false };
  }
  const veh = world.vehicles.find(v => v.id === p.vehicleId);
  const currentSpeed = veh ? veh.speed : 0;
  return {
    throttle: currentSpeed < 14 ? 0.75 : 0.2,
    steer: 0,
    handbrake: false,
    sprint: false,
    interact: false,
    moveX: 0,
    moveZ: 0
  };
}

let previousPhase = missionState.phase;

function updateAudioFromWorld() {
  const p = world.player;
  const isDriving = p.mode === 'driving' && p.vehicleId !== null;
  if (isDriving) {
    const veh = world.vehicles.find(v => v.id === p.vehicleId);
    const speed = veh ? Math.abs(veh.speed) : 0;
    audio.setEngine(speed / 28.0, true);
  } else {
    audio.setEngine(0, false);
  }

  const policeNearby = world.vehicles.some(v => v.kind === 'police' && Math.hypot(v.x - p.x, v.z - p.z) < 120);
  audio.setSiren(policeNearby, world.wanted.stars);
}

function processMissionToastsAndEvents() {
  if (missionState.toasts && missionState.toasts.length > 0) {
    while (missionState.toasts.length > 0) {
      const msg = missionState.toasts.shift();
      ui.toast(msg);
    }
  }

  if (missionState.phase !== previousPhase) {
    const ph = missionState.phase;
    if (ph === 'complete') {
      audio.blip('success');
      const allComplete = missionState.records.every(r => r.completed);
      if (allComplete) {
        const res = buildResults(world, missionState);
        ui.showScreen('results', res);
        currentScreen = 'results';
      }
    } else if (ph === 'failed') {
      audio.blip('fail');
    } else if (ph === 'busted') {
      audio.blip('bust');
    } else if (ph === 'wasted') {
      audio.blip('bust');
    }
    previousPhase = ph;
  }
}

function stepGame(input) {
  stepWorld(world, input);
  stepMissions(world, missionState);
  updateAudioFromWorld();
  processMissionToastsAndEvents();
}

function buildViewObject() {
  const p = world.player;
  const isDriving = p.mode === 'driving' && p.vehicleId !== null;
  const veh = isDriving ? world.vehicles.find(v => v.id === p.vehicleId) : null;
  const activeMission = missionState.activeMissionIndex >= 0 ? MISSIONS[missionState.activeMissionIndex] : null;

  return {
    speed: veh ? Math.abs(veh.speed) * 3.6 : 0,
    health: p.health,
    stamina: p.stamina,
    cash: missionState.cash,
    score: missionState.score,
    stars: world.wanted.stars,
    heat: world.wanted.heat,
    districtIndex: districtIndexAt(city, p.x, p.z),
    activeMission,
    currentStep: missionState.activeSteps ? missionState.activeSteps[missionState.currentStepIndex] : null,
    phase: missionState.phase,
    records: missionState.records
  };
}

// Window resize handling
function handleResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (canvas) {
    canvas.width = w;
    canvas.height = h;
  }
  renderer.resize(w, h);
}
window.addEventListener('resize', handleResize);
handleResize();

if (shotParam) {
  setupStagingMode(shotParam);
} else {
  ui.showScreen('menu');
  currentScreen = 'menu';
}

// Fixed-step animation loop
let lastTime = performance.now();
let accumulator = 0;
const fixedDt = CONFIG.simulation?.fixedStep ?? (1 / 60);
const fixedDtMs = fixedDt * 1000;

function frame(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;

  if (!isPaused && (currentScreen === 'hud' || isStagingMode || demoParam)) {
    accumulator += dt;
    while (accumulator >= fixedDt) {
      let frameInput;
      if (isStagingMode || demoParam) {
        frameInput = getDemoInput();
      } else {
        frameInput = {
          throttle: keys.up ? 1 : (keys.down ? -1 : 0),
          steer: keys.left ? -1 : (keys.right ? 1 : 0),
          handbrake: keys.handbrake,
          sprint: keys.sprint,
          interact: interactTriggered,
          moveX: (keys.right ? 1 : 0) - (keys.left ? 1 : 0),
          moveZ: (keys.up ? 1 : 0) - (keys.down ? 1 : 0)
        };
        interactTriggered = false;
      }
      stepGame(frameInput);
      accumulator -= fixedDt;
    }
  }

  const cameraDesc = isStagingMode && stagingCameraName ? stagingCameraName : computeFollowCamera(world);
  renderer.render(world, cameraDesc, world.tick);
  ui.update(buildViewObject());

  if (window.__game) {
    window.__game.ready = true;
  }

  requestAnimationFrame(frame);
}

// Testing / Dossier handle
window.__game = {
  ready: false,
  tick: (n = 1) => {
    for (let i = 0; i < n; i++) {
      const input = (isStagingMode || demoParam) ? getDemoInput() : {
        throttle: keys.up ? 1 : (keys.down ? -1 : 0),
        steer: keys.left ? -1 : (keys.right ? 1 : 0),
        handbrake: keys.handbrake,
        sprint: keys.sprint,
        interact: false,
        moveX: 0,
        moveZ: 0
      };
      stepGame(input);
    }
    const cam = isStagingMode && stagingCameraName ? stagingCameraName : computeFollowCamera(world);
    renderer.render(world, cam, world.tick);
    ui.update(buildViewObject());
  },
  get state() {
    const p = world.player;
    return {
      tick: world.tick,
      playerMode: p.mode,
      position: { x: p.x, z: p.z },
      wantedStars: world.wanted.stars,
      cash: missionState.cash,
      score: missionState.score,
      activeMissionIndex: missionState.activeMissionIndex
    };
  }
};

requestAnimationFrame(frame);
