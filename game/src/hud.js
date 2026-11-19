// In-game HUD: wanted stars, speedometer, health, stamina, mission objectives, crosshair, and toast feed.
import { PALETTE } from './config.js';

export function createHud(container) {
  const toasts = [];

  function addToast(message, type = 'info') {
    toasts.push({
      id: Date.now() + Math.random(),
      message,
      type,
      life: 3.5,
      opacity: 1.0,
    });
    if (toasts.length > 4) toasts.shift();
  }

  function render(player, wantedSystem, missionSystem, economy, district) {
    const stars = wantedSystem.stars;
    const heat = wantedSystem.heat;
    const cash = economy.cash;
    const score = economy.score;
    const activeMission = missionSystem.activeMission;
    const isDriving = player.inVehicle && player.vehicle;
    const speedKmh = isDriving ? Math.round(Math.abs(player.vehicle.speed) * 3.6) : 0;
    const vehicleHpRatio = isDriving ? player.vehicle.hp / player.vehicle.maxHp : 1.0;
    const playerHpRatio = player.hp / player.maxHp;
    const staminaRatio = player.stamina / player.maxStamina;

    // Build Wanted Stars HTML
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      const active = i <= stars;
      starsHtml += `<span style="color: ${active ? '#f59e0b' : '#334155'}; font-size: 22px; margin-right: 2px;">★</span>`;
    }

    // Mission objective line
    let missionHtml = '';
    if (activeMission && missionSystem.missionState === 'active') {
      const minutes = Math.floor(missionSystem.missionTimer / 60);
      const seconds = Math.floor(missionSystem.missionTimer % 60);
      const timeStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

      missionHtml = `
        <div style="background: rgba(15, 23, 42, 0.9); border-left: 4px solid #facc15; padding: 8px 12px; margin-top: 8px; border-radius: 4px;">
          <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">Job: ${activeMission.title}</div>
          <div style="font-size: 13px; color: #f8fafc; margin-top: 2px;">${activeMission.tagline}</div>
          <div style="font-size: 12px; color: #facc15; font-weight: 700; margin-top: 3px;">TIME REMAINING: ${timeStr}</div>
        </div>
      `;
    }

    // Vehicle panel or On-foot panel
    let bottomPanelHtml = '';
    if (isDriving) {
      bottomPanelHtml = `
        <div style="background: rgba(15, 23, 42, 0.88); border: 1px solid #334155; padding: 8px 14px; border-radius: 6px; display: inline-block;">
          <div style="display: flex; align-items: baseline; gap: 8px;">
            <span style="font-size: 28px; font-weight: 900; color: #f8fafc; font-family: monospace;">${speedKmh}</span>
            <span style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">KM/H</span>
            <span style="font-size: 12px; color: #38bdf8; font-weight: 600; margin-left: 8px;">${player.vehicle.spec.name}</span>
          </div>
          <div style="width: 160px; height: 6px; background: #1e293b; border-radius: 3px; overflow: hidden; margin-top: 4px;">
            <div style="width: ${vehicleHpRatio * 100}%; height: 100%; background: ${vehicleHpRatio > 0.35 ? '#38bdf8' : '#ef4444'};"></div>
          </div>
        </div>
      `;
    } else {
      bottomPanelHtml = `
        <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid #334155; padding: 6px 12px; border-radius: 6px; display: inline-block;">
          <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Stamina</div>
          <div style="width: 140px; height: 5px; background: #1e293b; border-radius: 3px; overflow: hidden; margin-top: 3px;">
            <div style="width: ${staminaRatio * 100}%; height: 100%; background: #38bdf8;"></div>
          </div>
          <div style="font-size: 11px; color: #cbd5e1; margin-top: 4px;">[E] Enter Car &nbsp;|&nbsp; [Shift] Sprint</div>
        </div>
      `;
    }

    // Build Toasts HTML
    let toastsHtml = '';
    for (let i = 0; i < toasts.length; i++) {
      const t = toasts[i];
      toastsHtml += `
        <div style="background: rgba(15, 23, 42, 0.92); border-left: 3px solid ${t.type === 'alert' ? '#ef4444' : '#38bdf8'}; padding: 6px 12px; border-radius: 4px; margin-bottom: 6px; font-size: 12px; color: #f8fafc; opacity: ${t.opacity};">
          ${t.message}
        </div>
      `;
    }

    container.innerHTML = `
      <!-- Crosshair -->
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none; width: 14px; height: 14px;">
        <div style="position: absolute; top: 6px; left: 0; width: 4px; height: 2px; background: #ffffff;"></div>
        <div style="position: absolute; top: 6px; right: 0; width: 4px; height: 2px; background: #ffffff;"></div>
        <div style="position: absolute; left: 6px; top: 0; width: 2px; height: 4px; background: #ffffff;"></div>
        <div style="position: absolute; left: 6px; bottom: 0; width: 2px; height: 4px; background: #ffffff;"></div>
      </div>

      <!-- Top Left: District, Cash, Score, Mission -->
      <div style="position: absolute; top: 16px; left: 16px; width: 280px; pointer-events: none;">
        <div style="font-size: 18px; font-weight: 900; color: #f8fafc; text-shadow: 0 2px 4px rgba(0,0,0,0.8); letter-spacing: 0.5px;">
          ${district ? district.name : 'Port Solano'}
        </div>
        <div style="display: flex; gap: 14px; margin-top: 4px; align-items: center;">
          <span style="font-size: 16px; font-weight: 800; color: #34d399; font-family: monospace;">$ ${cash.toLocaleString()}</span>
          <span style="font-size: 13px; font-weight: 700; color: #cbd5e1;">Score: ${score.toLocaleString()}</span>
        </div>
        ${missionHtml}
      </div>

      <!-- Top Right: Wanted Stars & Heat -->
      <div style="position: absolute; top: 16px; right: 16px; text-align: right; pointer-events: none;">
        <div>${starsHtml}</div>
        ${
          stars > 0
            ? `
          <div style="width: 120px; height: 4px; background: #1e293b; border-radius: 2px; margin-left: auto; margin-top: 2px; overflow: hidden;">
            <div style="width: ${(heat / 500) * 100}%; height: 100%; background: #ef4444;"></div>
          </div>
          <div style="font-size: 10px; color: ${wantedSystem.inLineOfSight ? '#ef4444' : '#38bdf8'}; font-weight: 700; margin-top: 2px;">
            ${wantedSystem.inLineOfSight ? 'POLICE PURSUIT' : 'LOSING HEAT...'}
          </div>
        `
            : ''
        }
      </div>

      <!-- Center Left Toasts -->
      <div style="position: absolute; top: 120px; left: 16px; width: 240px; pointer-events: none;">
        ${toastsHtml}
      </div>

      <!-- Bottom Left: Vehicle / Walk Status -->
      <div style="position: absolute; bottom: 20px; left: 16px; pointer-events: none;">
        ${bottomPanelHtml}
      </div>
    `;
  }

  function update(dt) {
    for (let i = toasts.length - 1; i >= 0; i--) {
      const t = toasts[i];
      t.life -= dt;
      if (t.life <= 0) {
        toasts.splice(i, 1);
      } else if (t.life < 0.6) {
        t.opacity = t.life / 0.6;
      }
    }
  }

  return {
    render,
    addToast,
    update,
  };
}
