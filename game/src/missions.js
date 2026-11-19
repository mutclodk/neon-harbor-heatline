// Mission system: 7 fully-featured story jobs with waypoints, timers, medals, and rewards.
import { MISSIONS, STEP } from './config.js';
import { distSq } from './physics.js';

export function createMissionSystem() {
  let activeMission = null;
  let missionState = 'idle'; // 'idle', 'briefing', 'active', 'complete', 'failed'
  let missionTimer = 0;
  let elapsed = 0;
  let currentStep = 0;
  let targetEntity = null;
  let demolitionTargetsDestroyed = 0;
  const completedMissions = new Set();
  const missionRecords = {}; // medal, best time

  function startMission(missionId) {
    const def = MISSIONS.find((m) => m.id === missionId);
    if (!def) return false;

    activeMission = {
      ...def,
      pickups: def.pickups ? def.pickups.map((p) => ({ ...p, collected: false })) : null,
      legs: def.legs ? def.legs.map((l) => ({ ...l, completed: false })) : null,
      checkpoints: def.checkpoints ? def.checkpoints.slice() : null,
    };

    missionState = 'briefing';
    missionTimer = def.timeLimit || 240;
    elapsed = 0;
    currentStep = 0;
    demolitionTargetsDestroyed = 0;
    return true;
  }

  function acceptBriefing() {
    if (missionState === 'briefing') {
      missionState = 'active';
    }
  }

  function getActiveWaypoint() {
    if (!activeMission || missionState !== 'active') return null;

    const m = activeMission;

    // Mission 1: First Run
    if (m.id === 1) {
      return m.waypointPos;
    }

    // Mission 2: Neon Post (pickups then delivery)
    if (m.id === 2) {
      const nextPickup = m.pickups.find((p) => !p.collected);
      if (nextPickup) return nextPickup;
      return m.deliveryPos;
    }

    // Mission 3: Hot Metal
    if (m.id === 3) {
      if (currentStep === 0) return m.stealPos;
      return m.hideoutPos;
    }

    // Mission 4: Harbor Heat
    if (m.id === 4) {
      return m.targetPos;
    }

    // Mission 5: Alto Run
    if (m.id === 5) {
      if (currentStep < m.checkpoints.length) {
        return m.checkpoints[currentStep];
      }
    }

    // Mission 6: Flats Demolition
    if (m.id === 6) {
      return m.yardCenter;
    }

    // Mission 7: Heatline (Finale)
    if (m.id === 7) {
      if (currentStep < m.legs.length) {
        return m.legs[currentStep].pos;
      }
    }

    return null;
  }

  function update(player, wantedSystem, onMissionComplete, onMissionFailed) {
    if (!activeMission || missionState !== 'active') return;

    const dt = STEP;
    elapsed += dt;
    if (activeMission.timeLimit) {
      missionTimer -= dt;
      if (missionTimer <= 0) {
        // Time expired!
        failMission('Time expired!', onMissionFailed);
        return;
      }
    }

    const m = activeMission;
    const px = player.x;
    const pz = player.z;

    // Mission 1: First Run (Deliver cargo)
    if (m.id === 1) {
      // Check vehicle HP
      if (player.vehicle && player.vehicle.hp <= (player.vehicle.maxHp * m.minVehicleHpPercent) / 100) {
        failMission('Cargo vehicle critically damaged!', onMissionFailed);
        return;
      }
      const d = distSq(px, pz, m.waypointPos.x, m.waypointPos.z);
      if (d < 8 * 8) {
        completeMission(onMissionComplete);
      }
    }

    // Mission 2: Neon Post
    else if (m.id === 2) {
      let allCollected = true;
      for (let i = 0; i < m.pickups.length; i++) {
        const p = m.pickups[i];
        if (!p.collected) {
          allCollected = false;
          if (distSq(px, pz, p.x, p.z) < 4.5 * 4.5) {
            p.collected = true;
          }
          break;
        }
      }

      if (allCollected) {
        if (distSq(px, pz, m.deliveryPos.x, m.deliveryPos.z) < 8 * 8) {
          completeMission(onMissionComplete);
        }
      }
    }

    // Mission 3: Hot Metal
    else if (m.id === 3) {
      if (currentStep === 0) {
        // Near sports car lot
        if (distSq(px, pz, m.stealPos.x, m.stealPos.z) < 12 * 12) {
          currentStep = 1;
          wantedSystem.addHeat(320, 'STOLE_PROTOTYPE'); // 3 stars
        }
      } else {
        // Escaped to hideout with heat lost
        if (distSq(px, pz, m.hideoutPos.x, m.hideoutPos.z) < 10 * 10 && wantedSystem.stars === 0) {
          completeMission(onMissionComplete);
        }
      }
    }

    // Mission 4: Harbor Heat
    else if (m.id === 4) {
      if (distSq(px, pz, m.targetPos.x, m.targetPos.z) < 9 * 9) {
        completeMission(onMissionComplete);
      }
    }

    // Mission 5: Alto Run (Checkpoints)
    else if (m.id === 5) {
      const cp = m.checkpoints[currentStep];
      if (cp && distSq(px, pz, cp.x, cp.z) < 10 * 10) {
        currentStep++;
        if (currentStep >= m.checkpoints.length) {
          completeMission(onMissionComplete);
        }
      }
    }

    // Mission 6: Flats Demolition
    else if (m.id === 6) {
      if (demolitionTargetsDestroyed >= m.targetCount) {
        completeMission(onMissionComplete);
      }
    }

    // Mission 7: Heatline (Finale 3-legs)
    else if (m.id === 7) {
      const leg = m.legs[currentStep];
      if (leg && distSq(px, pz, leg.pos.x, leg.pos.z) < 9 * 9) {
        leg.completed = true;
        currentStep++;
        if (currentStep < m.legs.length) {
          wantedSystem.addHeat(100, 'HEATLINE_ESCALATE');
        } else {
          completeMission(onMissionComplete);
        }
      }
    }
  }

  function registerDemolitionHit() {
    if (activeMission && activeMission.id === 6) {
      demolitionTargetsDestroyed++;
    }
  }

  function completeMission(callback) {
    if (!activeMission) return;
    missionState = 'complete';
    completedMissions.add(activeMission.id);

    // Calculate medal for time trials
    let medal = 'Gold';
    if (activeMission.goldTime && elapsed > activeMission.goldTime) {
      medal = elapsed <= activeMission.silverTime ? 'Silver' : 'Bronze';
    }

    missionRecords[activeMission.id] = {
      completed: true,
      time: elapsed,
      medal,
    };

    const result = {
      mission: activeMission,
      elapsed,
      medal,
      cash: activeMission.cashReward,
      score: activeMission.scoreReward,
    };

    if (callback) callback(result);
  }

  function failMission(reason, callback) {
    if (!activeMission) return;
    missionState = 'failed';
    const result = {
      mission: activeMission,
      reason,
    };
    if (callback) callback(result);
  }

  function resetToFreeRoam() {
    activeMission = null;
    missionState = 'idle';
    missionTimer = 0;
    elapsed = 0;
    currentStep = 0;
  }

  return {
    get activeMission() {
      return activeMission;
    },
    get missionState() {
      return missionState;
    },
    get missionTimer() {
      return missionTimer;
    },
    get elapsed() {
      return elapsed;
    },
    get currentStep() {
      return currentStep;
    },
    get demolitionTargetsDestroyed() {
      return demolitionTargetsDestroyed;
    },
    completedMissions,
    missionRecords,
    startMission,
    acceptBriefing,
    getActiveWaypoint,
    registerDemolitionHit,
    failMission,
    resetToFreeRoam,
    update,
  };
}
