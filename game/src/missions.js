import { CONFIG } from './config.js';
import { districtIndexAt } from './city.js';
import { addHeat } from './ai.js';
import { addEvent } from './sim.js';
import { makeRng, deriveSeed } from './random.js';

/**
 * Missions definitions metadata.
 */
export const MISSIONS = [
  {
    index: 0,
    name: 'First Run',
    briefing: 'Old Harbor Delivery: Take your truck from the harbor and deliver the cargo to the Marina Strip.',
    timeLimit: 120,
    parTimes: { gold: 45, silver: 70, bronze: 100 },
    cashReward: 150,
    baseScore: 500
  },
  {
    index: 1,
    name: 'Neon Post',
    briefing: 'Marina Strip Express: Collect three packages on foot along the strip, then deliver them to Centro Tower.',
    timeLimit: 150,
    parTimes: { gold: 75, silver: 105, bronze: 135 },
    cashReward: 350,
    baseScore: 900
  },
  {
    index: 2,
    name: 'Hot Metal',
    briefing: 'Centro Boost: Steal the sports car in Centro, shake off the heat, and deliver it safely to Alto Mirador.',
    timeLimit: 0,
    parTimes: { gold: 60, silver: 90, bronze: 140 },
    cashReward: 600,
    baseScore: 1500
  },
  {
    index: 3,
    name: 'Alto Run',
    briefing: 'Barrio Alto Circuit: Complete five checkpoints through the winding roads of Barrio Alto before time runs out.',
    timeLimit: 90,
    parTimes: { gold: 35, silver: 50, bronze: 70 },
    cashReward: 500,
    baseScore: 1200
  }
];

/**
 * Creates and initializes mission and economy run state.
 */
export function createMissionState(world) {
  const seed = deriveSeed(world?.seed ?? 20261124, 7777);
  const rng = makeRng(seed);

  const intersections = world?.city?.intersections || [];
  const tokens = [];

  // Pick 20 road intersections scattered across districts
  const indices = [];
  if (intersections.length > 0) {
    const pool = intersections.map((_, i) => i);
    rng.shuffle(pool);
    for (let i = 0; i < Math.min(20, pool.length); i++) {
      indices.push(pool[i]);
    }
  }

  for (let i = 0; i < 20; i++) {
    let x = (i + 1) * 50;
    let z = (i + 1) * 40;
    if (indices[i] !== undefined && intersections[indices[i]]) {
      x = intersections[indices[i]].x;
      z = intersections[indices[i]].z;
    }
    tokens.push({
      id: i + 1,
      x,
      z,
      districtIndex: districtIndexAt(world?.city, x, z),
      collected: false
    });
  }

  return {
    cash: 120,
    cashEarned: 120,
    score: 0,
    activeMissionIndex: -1,
    phase: 'idle',
    currentStepIndex: 0,
    stepStartTick: 0,
    missionStartTick: 0,
    records: MISSIONS.map(() => ({
      bestTime: null,
      medal: null,
      completed: false
    })),
    counters: {
      busts: 0,
      wastes: 0,
      offences: 0
    },
    busts: 0,
    wastes: 0,
    offences: 0,
    tokens,
    toasts: ['Welcome to Port Solano'],
    activeSteps: [],
    missionVehicleId: null,
    missionVehicleStartHealth: null,
    lastProcessedEventIndex: 0
  };
}

/**
 * Resolves mission steps with world positions computed at start.
 */
function resolveMissionSteps(world, missionIndex) {
  const landmarks = world?.city?.landmarks || {};
  const intersections = world?.city?.intersections || [];

  const marinaPt = landmarks.marinaLighthousePoint || { x: 100, z: 500 };
  const centroPt = landmarks.centroTowerPlaza || { x: 500, z: 500 };
  const altoPt = landmarks.altoMiradorLookout || { x: 800, z: 800 };

  if (missionIndex === 0) {
    // First Run
    const truck = world.vehicles?.find(v => v.isPlayerOwned) || world.vehicles?.[0];
    return [
      {
        type: 'enter_vehicle',
        vehicleId: truck ? truck.id : null,
        description: 'Enter your Dockmaster truck at Old Harbor'
      },
      {
        type: 'go_to',
        target: { x: marinaPt.x, z: marinaPt.z },
        radius: 12.0,
        requireVehicle: true,
        mustStop: true,
        description: 'Drive cargo to Marina Strip drop-off zone and stop'
      }
    ];
  }

  if (missionIndex === 1) {
    // Neon Post
    const marinaRoads = intersections.filter(p => districtIndexAt(world.city, p.x, p.z) === 1);
    const p1 = marinaRoads[0] || { x: marinaPt.x - 30, z: marinaPt.z - 30 };
    const p2 = marinaRoads[Math.floor(marinaRoads.length / 2)] || { x: marinaPt.x, z: marinaPt.z + 40 };
    const p3 = marinaRoads[marinaRoads.length - 1] || { x: marinaPt.x + 30, z: marinaPt.z - 20 };

    return [
      {
        type: 'collect_package',
        target: { x: p1.x, z: p1.z },
        radius: 4.0,
        description: 'Collect package 1/3 on foot'
      },
      {
        type: 'collect_package',
        target: { x: p2.x, z: p2.z },
        radius: 4.0,
        description: 'Collect package 2/3 on foot'
      },
      {
        type: 'collect_package',
        target: { x: p3.x, z: p3.z },
        radius: 4.0,
        description: 'Collect package 3/3 on foot'
      },
      {
        type: 'go_to',
        target: { x: centroPt.x, z: centroPt.z },
        radius: 12.0,
        description: 'Deliver packages to Centro Tower Plaza'
      }
    ];
  }

  if (missionIndex === 2) {
    // Hot Metal
    let sportsCar = world.vehicles?.find(v => v.classIndex === 2 || v.isMissionVehicle);
    if (!sportsCar) {
      const classIdx = 2;
      const vClass = world.config?.vehicles?.[classIdx] || world.config?.vehicles?.[0];
      const maxId = (world.vehicles || []).reduce((m, v) => Math.max(m, v.id), 0);
      sportsCar = {
        id: maxId + 1,
        classIndex: classIdx,
        kind: 'parked',
        x: centroPt.x + 8,
        z: centroPt.z + 8,
        heading: 0,
        speed: 0,
        health: vClass.health,
        bodyColour: vClass.bodyColour,
        driverAi: null,
        isPlayerOwned: false,
        isWreck: false,
        isSmoking: false,
        isMissionVehicle: true
      };
      if (world.vehicles) world.vehicles.push(sportsCar);
    } else {
      sportsCar.isMissionVehicle = true;
    }

    return [
      {
        type: 'enter_vehicle',
        vehicleId: sportsCar.id,
        heatAmount: 120,
        heatReason: 'car_theft',
        description: 'Steal the boosted sports car parked in Centro'
      },
      {
        type: 'reach_and_lose_wanted',
        target: { x: altoPt.x, z: altoPt.z },
        radius: 12.0,
        description: 'Reach Alto Mirador hideout with 0 wanted stars'
      }
    ];
  }

  if (missionIndex === 3) {
    // Alto Run
    const altoRoads = intersections.filter(p => districtIndexAt(world.city, p.x, p.z) === 3);
    const points = [];
    for (let i = 0; i < 5; i++) {
      if (altoRoads[i]) {
        points.push({ x: altoRoads[i].x, z: altoRoads[i].z });
      } else {
        const angle = (i / 5) * Math.PI * 2;
        points.push({ x: altoPt.x + Math.cos(angle) * 60, z: altoPt.z + Math.sin(angle) * 60 });
      }
    }

    return [
      {
        type: 'checkpoints',
        checkpoints: points,
        currentCheckpoint: 0,
        radius: 9.0,
        requireVehicle: true,
        description: 'Pass 5 checkpoints in Barrio Alto in order'
      }
    ];
  }

  return [];
}

/**
 * Starts a mission.
 */
export function startMission(world, state, missionIndex) {
  if (missionIndex < 0 || missionIndex >= MISSIONS.length) {
    return false;
  }

  const mission = MISSIONS[missionIndex];
  const steps = resolveMissionSteps(world, missionIndex);

  state.activeMissionIndex = missionIndex;
  state.phase = 'active';
  state.currentStepIndex = 0;
  state.missionStartTick = world.tick;
  state.stepStartTick = world.tick;
  state.activeSteps = steps;

  // Track mission vehicle
  if (missionIndex === 0) {
    const truck = world.vehicles?.find(v => v.isPlayerOwned) || world.vehicles?.[0];
    state.missionVehicleId = truck ? truck.id : null;
    state.missionVehicleStartHealth = truck ? truck.health : null;
  } else if (missionIndex === 2) {
    const veh = world.vehicles?.find(v => v.isMissionVehicle || v.id === steps[0]?.vehicleId);
    state.missionVehicleId = veh ? veh.id : null;
    state.missionVehicleStartHealth = veh ? veh.health : null;
  } else {
    state.missionVehicleId = null;
    state.missionVehicleStartHealth = null;
  }

  pushToast(state, `Mission Started: ${mission.name}`);
  addEvent(world, 'mission_started', { missionIndex, name: mission.name });
  return true;
}

/**
 * Helper to queue toast strings up to max 5 items.
 */
function pushToast(state, text) {
  if (!state.toasts) state.toasts = [];
  state.toasts.push(text);
  if (state.toasts.length > 5) {
    state.toasts.shift();
  }
}

/**
 * Calculates medal for mission finish time in seconds.
 */
function calculateMedal(parTimes, elapsedSec) {
  if (!parTimes) return 'bronze';
  if (elapsedSec <= parTimes.gold) return 'gold';
  if (elapsedSec <= parTimes.silver) return 'silver';
  if (elapsedSec <= parTimes.bronze) return 'bronze';
  return 'bronze';
}

/**
 * Updates mission state and economy logic each fixed step.
 */
export function updateMissions(world, state, dt) {
  if (!world || !state) return;

  const player = world.player;
  const events = world.events || [];

  // Process world events (busted, wasted, offences, near-misses)
  for (let i = state.lastProcessedEventIndex || 0; i < events.length; i++) {
    const evt = events[i];
    if (!evt) continue;

    if (evt.type === 'busted') {
      state.counters.busts++;
      state.busts++;
      const cashPenalty = Math.floor(state.cash * 0.15) + 50;
      state.cash = Math.max(0, state.cash - cashPenalty);
      state.score = Math.max(0, state.score - 200);
      pushToast(state, `Busted! Lost $${cashPenalty}`);

      if (state.phase === 'active') {
        failActiveMission(world, state, 'busted');
      }
    } else if (evt.type === 'wasted') {
      state.counters.wastes++;
      state.wastes++;
      const cashPenalty = Math.floor(state.cash * 0.20) + 100;
      state.cash = Math.max(0, state.cash - cashPenalty);
      state.score = Math.max(0, state.score - 300);
      pushToast(state, `Wasted! Medical bill: $${cashPenalty}`);

      if (state.phase === 'active') {
        failActiveMission(world, state, 'wasted');
      }
    } else if (evt.type === 'offence' || evt.type === 'car_stolen' || evt.type === 'hit_and_run' || evt.type === 'pedestrian_hit' || evt.type === 'police_rammed') {
      state.counters.offences++;
      state.offences++;
    } else if (evt.type === 'near_miss') {
      state.score += 50;
    } else if (evt.type === 'drift') {
      state.score += 30;
    }
  }
  state.lastProcessedEventIndex = events.length;

  // Check collectible tokens
  if (state.tokens && player) {
    for (let i = 0; i < state.tokens.length; i++) {
      const tok = state.tokens[i];
      if (!tok.collected) {
        const dist = Math.hypot(player.x - tok.x, player.z - tok.z);
        if (dist <= 4.0) {
          tok.collected = true;
          state.cash += 50;
          state.cashEarned += 50;
          state.score += 200;
          const found = state.tokens.filter(t => t.collected).length;
          pushToast(state, `Collectible Found (${found}/20) +$50`);
          addEvent(world, 'token_collected', { tokenId: tok.id, found, total: 20 });
        }
      }
    }
  }

  // Active mission tick processing
  if (state.phase === 'active' && state.activeMissionIndex >= 0) {
    const mission = MISSIONS[state.activeMissionIndex];
    const steps = state.activeSteps || [];
    const elapsedSec = (world.tick - state.missionStartTick) * dt;

    // Time limit check
    if (mission.timeLimit > 0 && elapsedSec >= mission.timeLimit) {
      failActiveMission(world, state, 'time_expired');
      return;
    }

    // Required vehicle destruction check
    if (state.missionVehicleId !== null) {
      const targetVeh = world.vehicles?.find(v => v.id === state.missionVehicleId);
      if (!targetVeh || targetVeh.health <= 0 || targetVeh.isWreck) {
        failActiveMission(world, state, 'vehicle_destroyed');
        return;
      }
    }

    // Process current step
    if (state.currentStepIndex < steps.length) {
      const step = steps[state.currentStepIndex];
      let stepComplete = false;

      const pVeh = player.mode === 'driving' ? world.vehicles?.find(v => v.id === player.vehicleId) : null;

      if (step.type === 'enter_vehicle') {
        if (player.mode === 'driving' && player.vehicleId === (step.vehicleId || state.missionVehicleId)) {
          stepComplete = true;
          if (step.heatAmount) {
            addHeat(world, step.heatAmount, step.heatReason || 'stolen_vehicle');
          }
        }
      } else if (step.type === 'collect_package') {
        if (player.mode === 'foot') {
          const dist = Math.hypot(player.x - step.target.x, player.z - step.target.z);
          if (dist <= step.radius) {
            stepComplete = true;
          }
        }
      } else if (step.type === 'go_to') {
        const dist = Math.hypot(player.x - step.target.x, player.z - step.target.z);
        let inVehOk = !step.requireVehicle || player.mode === 'driving';
        let stopOk = !step.mustStop || (pVeh && Math.abs(pVeh.speed) < 0.5);

        if (dist <= step.radius && inVehOk && stopOk) {
          stepComplete = true;
        }
      } else if (step.type === 'reach_and_lose_wanted') {
        const dist = Math.hypot(player.x - step.target.x, player.z - step.target.z);
        const stars = world.wanted?.stars ?? 0;
        if (dist <= step.radius && stars === 0) {
          stepComplete = true;
        }
      } else if (step.type === 'checkpoints') {
        if (player.mode === 'driving') {
          const cpIndex = step.currentCheckpoint || 0;
          const cp = step.checkpoints[cpIndex];
          if (cp) {
            const dist = Math.hypot(player.x - cp.x, player.z - cp.z);
            if (dist <= step.radius) {
              step.currentCheckpoint = cpIndex + 1;
              state.score += 100;
              pushToast(state, `Checkpoint ${step.currentCheckpoint}/${step.checkpoints.length}`);
              addEvent(world, 'checkpoint_passed', { checkpoint: step.currentCheckpoint, total: step.checkpoints.length });

              if (step.currentCheckpoint >= step.checkpoints.length) {
                stepComplete = true;
              }
            }
          }
        }
      }

      if (stepComplete) {
        state.currentStepIndex++;
        state.stepStartTick = world.tick;
        state.score += 200;
        addEvent(world, 'step_complete', {
          missionIndex: state.activeMissionIndex,
          stepIndex: state.currentStepIndex - 1
        });

        if (state.currentStepIndex < steps.length) {
          const nextStep = steps[state.currentStepIndex];
          pushToast(state, nextStep.description || 'Next objective update');
        } else {
          // Final step complete -> complete mission
          completeActiveMission(world, state, elapsedSec);
        }
      }
    }
  }
}

/**
 * Fails the active mission.
 */
function failActiveMission(world, state, reason) {
  state.phase = 'failed';
  state.score = Math.max(0, state.score - 100);
  const mIndex = state.activeMissionIndex;
  state.activeMissionIndex = -1;

  let msg = 'Mission Failed';
  if (reason === 'time_expired') msg = 'Mission Failed: Time Expired';
  if (reason === 'vehicle_destroyed') msg = 'Mission Failed: Vehicle Destroyed';
  if (reason === 'busted') msg = 'Mission Failed: Busted';
  if (reason === 'wasted') msg = 'Mission Failed: Wasted';

  pushToast(state, msg);
  addEvent(world, 'mission_failed', { missionIndex: mIndex, reason });
}

/**
 * Completes the active mission with rewards and record updates.
 */
function completeActiveMission(world, state, elapsedSec) {
  const mission = MISSIONS[state.activeMissionIndex];
  const medal = calculateMedal(mission.parTimes, elapsedSec);

  // Time bonus
  const maxTime = mission.timeLimit > 0 ? mission.timeLimit : (mission.parTimes.bronze * 1.5);
  const timeBonus = Math.max(0, Math.floor((maxTime - elapsedSec) * 10));

  // No-damage bonus
  let noDamageCash = 0;
  let noDamageScore = 0;
  if (state.missionVehicleId !== null) {
    const veh = world.vehicles?.find(v => v.id === state.missionVehicleId);
    if (veh && state.missionVehicleStartHealth && veh.health >= state.missionVehicleStartHealth) {
      noDamageCash = 200;
      noDamageScore = 500;
    }
  }

  const totalCash = mission.cashReward + noDamageCash;
  const totalScore = mission.baseScore + timeBonus + noDamageScore;

  state.cash += totalCash;
  state.cashEarned += totalCash;
  state.score += totalScore;

  const rec = state.records[state.activeMissionIndex];
  rec.completed = true;
  if (rec.bestTime === null || elapsedSec < rec.bestTime) {
    rec.bestTime = elapsedSec;
  }

  const medalRank = { gold: 3, silver: 2, bronze: 1, none: 0 };
  if ((medalRank[medal] || 0) > (medalRank[rec.medal] || 0)) {
    rec.medal = medal;
  }

  state.phase = 'complete';
  const mIndex = state.activeMissionIndex;
  state.activeMissionIndex = -1;

  pushToast(state, `Mission Complete! +$${totalCash}`);
  addEvent(world, 'mission_completed', {
    missionIndex: mIndex,
    timeSec: elapsedSec,
    medal,
    rewardCash: totalCash,
    rewardScore: totalScore
  });
}

/**
 * Computes end-of-run grade.
 */
function computeGrade(score) {
  if (score >= 5000) return 'S';
  if (score >= 3500) return 'A';
  if (score >= 2000) return 'B';
  if (score >= 1000) return 'C';
  return 'D';
}

/**
 * Returns end-of-run summary.
 */
export function buildResults(world, state) {
  const completedCount = state.records.filter(r => r.completed).length;
  const tokensFound = state.tokens.filter(t => t.collected).length;

  return {
    score: state.score,
    totalScore: state.score,
    cash: state.cash,
    finalCash: state.cash,
    cashEarned: state.cashEarned,
    missionsCompleted: completedCount,
    missionsCompletedCount: completedCount,
    missions: MISSIONS.map((m, i) => {
      const rec = state.records[i] || {};
      const timeSec = rec.bestTime || 0;
      return {
        index: i,
        name: m.name,
        timeSec,
        timeTicks: Math.round(timeSec * 60),
        bestTimeTicks: Math.round(timeSec * 60),
        medal: rec.medal || 'none',
        completed: !!rec.completed
      };
    }),
    peakStars: world?.wanted?.peakStars || 0,
    peakWantedStars: world?.wanted?.peakStars || 0,
    tokensFound,
    tokensFoundCount: tokensFound,
    totalTokens: 20,
    busts: state.counters?.busts ?? state.busts ?? 0,
    wastes: state.counters?.wastes ?? state.wastes ?? 0,
    timePlayedTicks: world?.tick || 0,
    grade: computeGrade(state.score)
  };
}
