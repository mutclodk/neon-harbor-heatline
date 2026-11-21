import { MISSIONS } from './missions.js';

function elt(tag, className, textContent) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent !== undefined && textContent !== null) el.textContent = textContent;
  return el;
}

function hexColor(num, fallback) {
  if (typeof num !== 'number') return fallback;
  return '#' + num.toString(16).padStart(6, '0');
}

export function createUI(root, callbacks = {}) {
  const {
    onStartMission = () => {},
    onResume = () => {},
    onRestart = () => {},
    onQuitToMenu = () => {},
    onTogglePause = () => {},
    onToggleHelp = () => {}
  } = callbacks;

  root.replaceChildren();
  const container = elt('div', 'ui-root');
  root.appendChild(container);

  // HUD layer
  const hudLayer = elt('div', 'ui-hud-layer');
  container.appendChild(hudLayer);

  // Top-left status cluster: cash and score
  const statusCluster = elt('div', 'ui-status-cluster');
  const cashLabel = elt('div', 'ui-label ui-cash-label', 'CASH');
  const cashValue = elt('div', 'ui-value ui-cash-value', '$0');
  const scoreLabel = elt('div', 'ui-label ui-score-label', 'SCORE');
  const scoreValue = elt('div', 'ui-value ui-score-value', '0');
  statusCluster.append(cashLabel, cashValue, scoreLabel, scoreValue);
  hudLayer.appendChild(statusCluster);

  // Top-centre mission panel: name, objective, countdown
  const missionPanel = elt('div', 'ui-mission-panel ui-hidden');
  const missionTitle = elt('div', 'ui-mission-title', '');
  const missionObjective = elt('div', 'ui-mission-objective', '');
  const missionTimer = elt('div', 'ui-mission-timer', '');
  missionPanel.append(missionTitle, missionObjective, missionTimer);
  hudLayer.appendChild(missionPanel);

  // Top-right wanted cluster: 5 stars + heat bar
  const wantedCluster = elt('div', 'ui-wanted-cluster');
  const starsRow = elt('div', 'ui-wanted-stars');
  const starElements = [];
  for (let i = 0; i < 5; i++) {
    const star = elt('span', 'ui-wanted-star', '★');
    starElements.push(star);
    starsRow.appendChild(star);
  }
  const heatBarTrack = elt('div', 'ui-heat-track');
  const heatBarFill = elt('div', 'ui-heat-fill');
  heatBarTrack.appendChild(heatBarFill);
  wantedCluster.append(starsRow, heatBarTrack);
  hudLayer.appendChild(wantedCluster);

  // Bottom-left context panel: vehicle or on-foot stamina
  const contextPanel = elt('div', 'ui-context-panel');
  const contextName = elt('div', 'ui-context-name', 'ON FOOT');
  const contextSpeed = elt('div', 'ui-context-speed', '');
  const contextBarTrack = elt('div', 'ui-context-track');
  const contextBarFill = elt('div', 'ui-context-fill');
  contextBarTrack.appendChild(contextBarFill);
  contextPanel.append(contextName, contextSpeed, contextBarTrack);
  hudLayer.appendChild(contextPanel);

  // Bottom-right circular minimap canvas
  const minimapWrap = elt('div', 'ui-minimap-wrap');
  const minimapCanvas = elt('canvas', 'ui-minimap-canvas');
  minimapCanvas.width = 180;
  minimapCanvas.height = 180;
  minimapWrap.appendChild(minimapCanvas);
  hudLayer.appendChild(minimapWrap);
  const mapCtx = minimapCanvas.getContext('2d');

  // Damage vignette
  const vignette = elt('div', 'ui-vignette');
  container.appendChild(vignette);

  // Toast stack
  const toastStack = elt('div', 'ui-toast-stack');
  container.appendChild(toastStack);

  // Screens layer
  const screensLayer = elt('div', 'ui-screens-layer ui-hidden');
  container.appendChild(screensLayer);

  // Offscreen canvas for city layer
  const offscreenCanvas = document.createElement('canvas');
  const offscreenCtx = offscreenCanvas.getContext('2d');
  let cityBaked = false;
  let cityBounds = { minX: 0, maxX: 1000, minZ: 0, maxZ: 1000, spanX: 1000, spanZ: 1000 };

  const toastsList = [];
  let currentScreen = null;
  let screenPayload = null;

  function bakeCity(city) {
    if (!city) return;
    const width = 360;
    const height = 360;
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    if (city.intersections && city.intersections.length > 0) {
      for (let i = 0; i < city.intersections.length; i++) {
        const pt = city.intersections[i];
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.z < minZ) minZ = pt.z;
        if (pt.z > maxZ) maxZ = pt.z;
      }
    } else {
      minX = 0;
      maxX = 960;
      minZ = 0;
      maxZ = 800;
    }

    const pad = 40;
    minX -= pad;
    minZ -= pad;
    maxX += pad;
    maxZ += pad;
    const spanX = Math.max(1, maxX - minX);
    const spanZ = Math.max(1, maxZ - minZ);
    cityBounds = { minX, maxX, minZ, maxZ, spanX, spanZ };

    offscreenCtx.fillStyle = '#10121a';
    offscreenCtx.fillRect(0, 0, width, height);

    if (city.districts && city.districts.length > 0) {
      for (let i = 0; i < city.districts.length; i++) {
        const d = city.districts[i];
        offscreenCtx.fillStyle = hexColor(d.groundTint, '#1c1f28');
        const dx = (( (d.x ?? 0) - minX) / spanX) * width;
        const dz = (( (d.z ?? 0) - minZ) / spanZ) * height;
        const dw = ((d.width ?? (spanX / city.districts.length)) / spanX) * width;
        const dh = ((d.height ?? spanZ) / spanZ) * height;
        offscreenCtx.fillRect(dx, dz, dw, dh);
      }
    }

    if (city.roads && city.roads.length > 0) {
      offscreenCtx.strokeStyle = '#3a3f55';
      offscreenCtx.lineWidth = 4;
      offscreenCtx.lineCap = 'round';
      for (let i = 0; i < city.roads.length; i++) {
        const road = city.roads[i];
        const p1 = road.from || road.start || (road.x1 !== undefined ? { x: road.x1, z: road.z1 } : null);
        const p2 = road.to || road.end || (road.x2 !== undefined ? { x: road.x2, z: road.z2 } : null);
        if (p1 && p2) {
          const x1 = ((p1.x - minX) / spanX) * width;
          const z1 = ((p1.z - minZ) / spanZ) * height;
          const x2 = ((p2.x - minX) / spanX) * width;
          const z2 = ((p2.z - minZ) / spanZ) * height;
          offscreenCtx.beginPath();
          offscreenCtx.moveTo(x1, z1);
          offscreenCtx.lineTo(x2, z2);
          offscreenCtx.stroke();
        }
      }
    }

    cityBaked = true;
  }

  function renderMinimap(world, missionState) {
    const w = minimapCanvas.width;
    const h = minimapCanvas.height;
    mapCtx.clearRect(0, 0, w, h);

    const radius = w / 2 - 2;
    mapCtx.save();
    mapCtx.beginPath();
    mapCtx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
    mapCtx.clip();

    const playerX = world?.player?.x ?? world?.x ?? 0;
    const playerZ = world?.player?.z ?? world?.z ?? 0;
    const playerHeading = world?.player?.heading ?? world?.heading ?? 0;

    if (cityBaked) {
      const scale = 1.2;
      const offW = offscreenCanvas.width;
      const offH = offscreenCanvas.height;
      const normX = (playerX - cityBounds.minX) / cityBounds.spanX;
      const normZ = (playerZ - cityBounds.minZ) / cityBounds.spanZ;
      const srcCenterX = normX * offW;
      const srcCenterZ = normZ * offH;

      mapCtx.save();
      mapCtx.translate(w / 2, h / 2);
      mapCtx.rotate(-playerHeading);
      mapCtx.drawImage(
        offscreenCanvas,
        -srcCenterX * scale,
        -srcCenterZ * scale,
        offW * scale,
        offH * scale
      );
      mapCtx.restore();
    } else {
      mapCtx.fillStyle = '#141824';
      mapCtx.fillRect(0, 0, w, h);
    }

    const worldScale = (offscreenCanvas.width * 1.2) / cityBounds.spanX;

    function toMapCoords(tx, tz) {
      const dx = (tx - playerX) * worldScale;
      const dz = (tz - playerZ) * worldScale;
      const cos = Math.cos(-playerHeading);
      const sin = Math.sin(-playerHeading);
      const rx = dx * cos - dz * sin;
      const rz = dx * sin + dz * cos;
      return { x: w / 2 + rx, z: h / 2 + rz };
    }

    // Token dots
    const tokens = missionState?.tokens || [];
    mapCtx.fillStyle = '#00f0ff';
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (!tok.collected) {
        const pt = toMapCoords(tok.x, tok.z);
        const dist = Math.hypot(pt.x - w / 2, pt.z - h / 2);
        if (dist <= radius) {
          mapCtx.beginPath();
          mapCtx.arc(pt.x, pt.z, 2.5, 0, Math.PI * 2);
          mapCtx.fill();
        }
      }
    }

    // Police dots
    const vehicles = world?.vehicles || [];
    mapCtx.fillStyle = '#ff0055';
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      if (v.isPolice || v.police) {
        const pt = toMapCoords(v.x, v.z);
        const dist = Math.hypot(pt.x - w / 2, pt.z - h / 2);
        if (dist <= radius) {
          mapCtx.beginPath();
          mapCtx.arc(pt.x, pt.z, 3.5, 0, Math.PI * 2);
          mapCtx.fill();
        }
      }
    }

    // Active objective marker
    const activeSteps = missionState?.activeSteps || [];
    const stepIdx = missionState?.currentStepIndex ?? 0;
    const currentStep = activeSteps[stepIdx];
    let target = currentStep?.target;
    if (!target && currentStep?.checkpoints && currentStep?.currentCheckpoint !== undefined) {
      target = currentStep.checkpoints[currentStep.currentCheckpoint];
    }
    if (target) {
      const pt = toMapCoords(target.x, target.z);
      mapCtx.fillStyle = '#ffea00';
      mapCtx.beginPath();
      mapCtx.arc(pt.x, pt.z, 5, 0, Math.PI * 2);
      mapCtx.fill();
      mapCtx.strokeStyle = '#ffffff';
      mapCtx.lineWidth = 1.5;
      mapCtx.stroke();
    }

    // Player arrow (centre)
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.moveTo(w / 2, h / 2 - 7);
    mapCtx.lineTo(w / 2 - 5, h / 2 + 6);
    mapCtx.lineTo(w / 2, h / 2 + 3);
    mapCtx.lineTo(w / 2 + 5, h / 2 + 6);
    mapCtx.closePath();
    mapCtx.fill();

    mapCtx.restore();

    mapCtx.strokeStyle = '#00f0ff';
    mapCtx.lineWidth = 2.5;
    mapCtx.beginPath();
    mapCtx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
    mapCtx.stroke();
  }

  function rebuildScreen(screenName, payload, state) {
    screensLayer.replaceChildren();
    if (!screenName || screenName === 'game' || screenName === 'hud') {
      screensLayer.classList.add('ui-hidden');
      return;
    }
    screensLayer.classList.remove('ui-hidden');

    const panel = elt('div', `ui-screen-panel ui-screen-${screenName}`);
    screensLayer.appendChild(panel);

    if (screenName === 'menu') {
      const title = elt('h1', 'ui-title', 'NEON HARBOR: HEATLINE');
      const pitch = elt('p', 'ui-pitch', 'High-speed synthetic crime in the neon glow of Port Solano.');
      panel.append(title, pitch);

      const missionList = elt('div', 'ui-mission-list');
      const records = state?.records || [];

      MISSIONS.forEach((m, idx) => {
        const item = elt('div', 'ui-mission-card');
        const header = elt('div', 'ui-mission-card-header');
        const name = elt('span', 'ui-mission-card-name', m.name);
        const rec = records[idx] || {};
        const medalText = rec.medal && rec.medal !== 'none' ? `[${rec.medal.toUpperCase()}]` : '';
        const medalSpan = elt('span', 'ui-mission-card-medal', medalText);
        header.append(name, medalSpan);

        const bestTimeText = rec.bestTime !== null && rec.bestTime !== undefined
          ? `Best: ${rec.bestTime.toFixed(1)}s`
          : 'Best: --';
        const bestTimeEl = elt('div', 'ui-mission-card-time', bestTimeText);

        const btn = elt('button', 'ui-btn ui-btn-start', 'PLAY');
        btn.onclick = () => onStartMission(idx);

        item.append(header, bestTimeEl, btn);
        missionList.appendChild(item);
      });
      panel.appendChild(missionList);

      const helpBtn = elt('button', 'ui-btn ui-btn-help', 'HELP & CONTROLS');
      helpBtn.onclick = () => onToggleHelp();
      panel.appendChild(helpBtn);
    } else if (screenName === 'mission_briefing') {
      const missionIdx = payload?.missionIndex ?? 0;
      const m = MISSIONS[missionIdx] || MISSIONS[0];
      const title = elt('h2', 'ui-screen-title', m.name);
      const briefing = elt('p', 'ui-briefing-text', m.briefing);
      const reward = elt('div', 'ui-briefing-reward', `Reward: $${m.cashReward} | Score: ${m.baseScore}`);
      const startBtn = elt('button', 'ui-btn ui-btn-primary', 'START MISSION');
      startBtn.onclick = () => onStartMission(missionIdx);

      panel.append(title, briefing, reward, startBtn);
    } else if (screenName === 'help') {
      const title = elt('h2', 'ui-screen-title', 'HELP & CONTROLS');
      const controlsList = elt('div', 'ui-help-section');
      const chdr = elt('h3', 'ui-subtitle', 'CONTROLS');
      const c1 = elt('p', 'ui-help-p', 'WASD / Arrow Keys : Move / Steer & Accelerate');
      const c2 = elt('p', 'ui-help-p', 'Space : Handbrake / Sprint');
      const c3 = elt('p', 'ui-help-p', 'F / Enter : Enter / Exit Vehicle');
      const c4 = elt('p', 'ui-help-p', 'P / Esc : Pause Game');
      const c5 = elt('p', 'ui-help-p', 'H : Toggle Help');
      controlsList.append(chdr, c1, c2, c3, c4, c5);

      const wantedSection = elt('div', 'ui-help-section');
      const whdr = elt('h3', 'ui-subtitle', 'WANTED SYSTEM');
      const w1 = elt('p', 'ui-help-p', 'Crimes generate Heat. Every 100 heat adds 1 Wanted Star.');
      const w2 = elt('p', 'ui-help-p', 'High star ratings attract aggressive police interceptors.');
      const w3 = elt('p', 'ui-help-p', 'Evade patrol line-of-sight to let heat decay naturally.');
      wantedSection.append(whdr, w1, w2, w3);

      const closeBtn = elt('button', 'ui-btn', 'CLOSE');
      closeBtn.onclick = () => onToggleHelp();

      panel.append(title, controlsList, wantedSection, closeBtn);
    } else if (screenName === 'mission_complete') {
      const title = elt('h2', 'ui-screen-title', 'MISSION ACCOMPLISHED');
      const timeVal = payload?.timeSec ?? payload?.time ?? 0;
      const medal = payload?.medal || 'none';
      const cash = payload?.rewardCash ?? payload?.cash ?? 0;
      const score = payload?.rewardScore ?? payload?.score ?? 0;

      const stats = elt('div', 'ui-complete-stats');
      const pTime = elt('div', 'ui-stat-row', `Time: ${Number(timeVal).toFixed(1)}s`);
      const pMedal = elt('div', 'ui-stat-row', `Medal: ${medal.toUpperCase()}`);
      const pCash = elt('div', 'ui-stat-row', `Cash Earned: +$${cash}`);
      const pScore = elt('div', 'ui-stat-row', `Score Earned: +${score}`);
      stats.append(pTime, pMedal, pCash, pScore);

      const continueBtn = elt('button', 'ui-btn ui-btn-primary', 'CONTINUE');
      continueBtn.onclick = () => onQuitToMenu();

      panel.append(title, stats, continueBtn);
    } else if (screenName === 'mission_failed') {
      const title = elt('h2', 'ui-screen-title', 'MISSION FAILED');
      const reason = elt('p', 'ui-fail-reason', payload?.reason || 'Objective not completed');

      const btnRow = elt('div', 'ui-btn-row');
      const retryBtn = elt('button', 'ui-btn ui-btn-primary', 'RETRY');
      retryBtn.onclick = () => onRestart();
      const menuBtn = elt('button', 'ui-btn', 'MAIN MENU');
      menuBtn.onclick = () => onQuitToMenu();
      btnRow.append(retryBtn, menuBtn);

      panel.append(title, reason, btnRow);
    } else if (screenName === 'busted') {
      const title = elt('h2', 'ui-screen-title ui-text-busted', 'BUSTED');
      const penalty = elt('p', 'ui-penalty-text', payload?.penalty || 'Apprehended by CPD. Fines deducted.');
      const continueBtn = elt('button', 'ui-btn ui-btn-primary', 'CONTINUE');
      continueBtn.onclick = () => onResume();

      panel.append(title, penalty, continueBtn);
    } else if (screenName === 'wasted') {
      const title = elt('h2', 'ui-screen-title ui-text-wasted', 'WASTED');
      const summary = elt('p', 'ui-penalty-text', payload?.summary || 'Critical damage sustained. Recovered at clinic.');
      const continueBtn = elt('button', 'ui-btn ui-btn-primary', 'CONTINUE');
      continueBtn.onclick = () => onResume();

      panel.append(title, summary, continueBtn);
    } else if (screenName === 'pause') {
      const title = elt('h2', 'ui-screen-title', 'PAUSED');
      const resumeBtn = elt('button', 'ui-btn ui-btn-primary', 'RESUME');
      resumeBtn.onclick = () => onResume();
      const restartBtn = elt('button', 'ui-btn', 'RESTART MISSION');
      restartBtn.onclick = () => onRestart();
      const quitBtn = elt('button', 'ui-btn ui-btn-danger', 'QUIT TO MENU');
      quitBtn.onclick = () => onQuitToMenu();

      panel.append(title, resumeBtn, restartBtn, quitBtn);
    } else if (screenName === 'results') {
      const title = elt('h2', 'ui-screen-title', 'CAREER RESULTS');
      const grade = elt('div', 'ui-results-grade', payload?.grade || 'C');

      const table = elt('table', 'ui-results-table');
      const tbody = elt('tbody');

      function addRow(k, v) {
        const row = elt('tr');
        row.append(elt('td', 'ui-res-key', k), elt('td', 'ui-res-val', String(v)));
        tbody.appendChild(row);
      }

      addRow('Total Score', payload?.totalScore ?? payload?.score ?? 0);
      addRow('Final Cash', `$${payload?.finalCash ?? payload?.cash ?? 0}`);
      addRow('Missions Completed', `${payload?.missionsCompletedCount ?? payload?.missionsCompleted ?? 0} / 4`);
      addRow('Tokens Collected', `${payload?.tokensFoundCount ?? payload?.tokensFound ?? 0} / 20`);
      addRow('Peak Wanted Stars', payload?.peakWantedStars ?? payload?.peakStars ?? 0);
      addRow('Arrests (Busts)', payload?.busts ?? 0);
      addRow('Casualties (Wasted)', payload?.wastes ?? 0);

      table.appendChild(tbody);

      const menuBtn = elt('button', 'ui-btn ui-btn-primary', 'MAIN MENU');
      menuBtn.onclick = () => onQuitToMenu();

      panel.append(title, grade, table, menuBtn);
    }
  }

  function updateToasts(tick) {
    toastStack.replaceChildren();
    for (let i = toastsList.length - 1; i >= 0; i--) {
      const t = toastsList[i];
      const age = tick - t.createdTick;
      if (age > 240) {
        toastsList.splice(i, 1);
        continue;
      }
      const item = elt('div', 'ui-toast-msg', t.text);
      if (age > 180) {
        item.style.opacity = Math.max(0, (240 - age) / 60).toFixed(2);
      } else if (age < 30) {
        item.style.opacity = (age / 30).toFixed(2);
      } else {
        item.style.opacity = '1';
      }
      toastStack.appendChild(item);
    }
  }

  let lastScreenRendered = null;
  let lastPayloadRendered = null;

  return {
    update(view) {
      if (!view) return;
      const world = view.world || {};
      const missionState = view.mission || view.missionState || {};
      const screenName = view.currentScreen || currentScreen;
      const tick = world.tick || 0;

      // Status cluster
      const cash = missionState.cash ?? 0;
      const score = missionState.score ?? 0;
      cashValue.textContent = `$${cash}`;
      scoreValue.textContent = `${score}`;

      // Mission panel
      const activeIdx = missionState.activeMissionIndex;
      const hasMission = activeIdx !== undefined && activeIdx !== null && activeIdx >= 0;
      if (hasMission && MISSIONS[activeIdx]) {
        missionPanel.classList.remove('ui-hidden');
        const missionDef = MISSIONS[activeIdx];
        missionTitle.textContent = missionDef.name;

        const activeSteps = missionState.activeSteps || [];
        const stepIdx = missionState.currentStepIndex ?? 0;
        const currentStep = activeSteps[stepIdx];
        missionObjective.textContent = currentStep?.description || missionDef.briefing || '';

        if (missionDef.timeLimit > 0) {
          const elapsed = (tick - (missionState.missionStartTick || 0)) / 60;
          const rem = Math.max(0, missionDef.timeLimit - elapsed);
          const mins = Math.floor(rem / 60);
          const secs = Math.floor(rem % 60);
          missionTimer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
          missionTimer.classList.remove('ui-hidden');
        } else {
          missionTimer.classList.add('ui-hidden');
        }
      } else {
        missionPanel.classList.add('ui-hidden');
      }

      // Wanted cluster
      const wanted = world.wanted || {};
      const stars = wanted.stars ?? 0;
      const heat = wanted.heat ?? 0;
      const heatPerStar = 100;
      for (let i = 0; i < 5; i++) {
        starElements[i].className = i < stars ? 'ui-wanted-star ui-star-active' : 'ui-wanted-star';
      }
      const curStarHeat = heat % heatPerStar;
      const heatPct = stars >= 5 ? 100 : Math.min(100, Math.max(0, (curStarHeat / heatPerStar) * 100));
      heatBarFill.style.width = `${heatPct}%`;

      // Context panel (Driving vs On Foot)
      const playerMode = world.player?.mode || world.mode || 'on_foot';
      const vehicle = world.vehicle || world.player?.vehicle;
      if (playerMode === 'driving' || vehicle) {
        contextName.textContent = vehicle?.name || 'VEHICLE';
        const speedKmh = Math.round((vehicle?.speed || 0) * 3.6);
        contextSpeed.textContent = `${speedKmh} KM/H`;
        const health = vehicle?.health ?? 100;
        const maxHealth = vehicle?.maxHealth ?? 100;
        const healthPct = Math.min(100, Math.max(0, (health / maxHealth) * 100));
        contextBarFill.style.width = `${healthPct}%`;
        contextBarFill.className = 'ui-context-fill ui-fill-vehicle';
      } else {
        contextName.textContent = 'ON FOOT';
        contextSpeed.textContent = '';
        const stamina = world.player?.stamina ?? 100;
        const staminaPct = Math.min(100, Math.max(0, stamina));
        contextBarFill.style.width = `${staminaPct}%`;
        contextBarFill.className = 'ui-context-fill ui-fill-stamina';
      }

      // Bake city if not done
      if (!cityBaked && world.city) {
        bakeCity(world.city);
      }

      // Render minimap
      renderMinimap(world, missionState);

      // Damage vignette
      let recentDamage = 0;
      const events = world.events || [];
      for (let i = events.length - 1; i >= 0; i--) {
        const ev = events[i];
        if (ev.type === 'player_damage' || ev.type === 'vehicle_damage' || ev.name === 'damage') {
          const age = tick - (ev.tick || tick);
          if (age >= 0 && age < 30) {
            recentDamage = Math.max(recentDamage, 1 - age / 30);
          }
        }
      }
      vignette.style.opacity = (recentDamage * 0.7).toFixed(2);

      // Drain external toasts from mission state if present
      if (missionState.toasts && missionState.toasts.length > 0) {
        while (missionState.toasts.length > 0) {
          const msg = missionState.toasts.shift();
          toastsList.push({ text: msg, createdTick: tick });
        }
      }
      updateToasts(tick);

      // Screens refresh
      if (screenName !== lastScreenRendered || screenPayload !== lastPayloadRendered) {
        lastScreenRendered = screenName;
        lastPayloadRendered = screenPayload;
        rebuildScreen(screenName, screenPayload, missionState);
      }
    },

    showScreen(screenName, payload = null) {
      currentScreen = screenName;
      screenPayload = payload;
      lastScreenRendered = null; // force re-render
    },

    toast(message) {
      toastsList.push({ text: String(message), createdTick: 0 });
    }
  };
}
