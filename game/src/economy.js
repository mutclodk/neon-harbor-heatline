// Economy and score tracker: cash, stunt bonuses, Sol Tokens collectibles, and final run grading.
import { STEP } from './config.js';
import { distSq } from './physics.js';

export function createEconomySystem() {
  let cash = 500;
  let score = 0;
  let tokensCollected = 0;
  let driftTimer = 0;
  let lastStuntToast = null;
  let peakStars = 0;
  let bustsCount = 0;
  let wastesCount = 0;
  let totalCashEarned = 500;
  let totalCashSpent = 0;

  function addCash(amount, reason = '') {
    cash += amount;
    if (amount > 0) totalCashEarned += amount;
    else totalCashSpent += Math.abs(amount);
  }

  function addScore(amount) {
    score += amount;
  }

  function checkTokenPickups(player, tokens, onTokenCollected) {
    const px = player.x;
    const pz = player.z;

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (!t.collected) {
        if (distSq(px, pz, t.x, t.z) < 3.2 * 3.2) {
          t.collected = true;
          tokensCollected++;
          addCash(50, 'SOL_TOKEN');
          addScore(100);
          if (onTokenCollected) onTokenCollected(tokensCollected, tokens.length);
        }
      }
    }
  }

  function updateStunts(player, trafficCars, onStunt) {
    const dt = STEP;

    if (player.inVehicle && player.vehicle) {
      const v = player.vehicle;

      // 1. Drift stunt
      if (v.isDrifting && Math.abs(v.speed) > 10) {
        driftTimer += dt;
        if (driftTimer > 1.8) {
          driftTimer = 0;
          addCash(15, 'POWER_DRIFT');
          addScore(120);
          if (onStunt) onStunt('Power Drift! +$15', 120);
        }
      } else {
        driftTimer = Math.max(0, driftTimer - dt * 2);
      }

      // 2. Near-miss stunt with traffic
      if (trafficCars && Math.abs(v.speed) > 16) {
        for (let i = 0; i < trafficCars.length; i++) {
          const t = trafficCars[i];
          if (!t.active) continue;
          const dSq = distSq(v.x, v.z, t.x, t.z);
          if (dSq < 4.2 * 4.2 && dSq > 2.2 * 2.2 && !t.nearMissFlag) {
            t.nearMissFlag = true;
            addCash(5, 'NEAR_MISS');
            addScore(50);
            if (onStunt) onStunt('Near Miss! +$5', 50);
            break;
          }
        }
      }
    }
  }

  function recordBust() {
    bustsCount++;
    const penalty = Math.max(75, Math.floor(cash * 0.15));
    cash = Math.max(0, cash - penalty);
    score = Math.max(0, score - 500);
    totalCashSpent += penalty;
    return penalty;
  }

  function recordWaste() {
    wastesCount++;
    const penalty = Math.max(50, Math.floor(cash * 0.1));
    cash = Math.max(0, cash - penalty);
    score = Math.max(0, score - 400);
    totalCashSpent += penalty;
    return penalty;
  }

  function getFinalGrade() {
    if (score >= 8000) return 'S';
    if (score >= 5500) return 'A';
    if (score >= 3500) return 'B';
    if (score >= 2000) return 'C';
    return 'D';
  }

  return {
    get cash() {
      return cash;
    },
    get score() {
      return score;
    },
    get tokensCollected() {
      return tokensCollected;
    },
    get bustsCount() {
      return bustsCount;
    },
    get wastesCount() {
      return wastesCount;
    },
    get totalCashEarned() {
      return totalCashEarned;
    },
    get totalCashSpent() {
      return totalCashSpent;
    },
    addCash,
    addScore,
    checkTokenPickups,
    updateStunts,
    recordBust,
    recordWaste,
    getFinalGrade,
  };
}
