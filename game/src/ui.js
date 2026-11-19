// Screen manager: Title/Start screen, Garage, Pause menu, Mission cards, Busted/Wasted, and Results screen.
import { MISSIONS, VEHICLE_CLASSES } from './config.js';

export function createUiManager(container, onAction) {
  let currentScreen = 'title'; // 'title', 'garage', 'hud', 'pause', 'briefing', 'complete', 'busted', 'wasted', 'results'
  let screenData = null;

  function showScreen(name, data = null) {
    currentScreen = name;
    screenData = data;
    render();
  }

  function render() {
    if (currentScreen === 'hud') {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';

    // 1. Title / Start Screen
    if (currentScreen === 'title') {
      container.innerHTML = `
        <div style="position: fixed; inset: 0; background: radial-gradient(circle at center, rgba(30, 27, 75, 0.85) 0%, rgba(15, 23, 42, 0.98) 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: system-ui, -apple-system, sans-serif; color: #f8fafc; z-index: 100;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="font-size: 14px; letter-spacing: 6px; text-transform: uppercase; color: #38bdf8; font-weight: 700; margin-bottom: 8px;">Port Solano 1986</div>
            <h1 style="font-size: 52px; font-weight: 900; margin: 0; background: linear-gradient(135deg, #f43f5e 0%, #facc15 50%, #38bdf8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-transform: uppercase; letter-spacing: 2px;">
              Neon Harbor
            </h1>
            <div style="font-size: 26px; font-weight: 800; letter-spacing: 8px; color: #f8fafc; text-transform: uppercase; margin-top: -4px;">
              Heatline
            </div>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 10px; max-width: 440px;">
              Open-world crime syndicate in sun-drenched Port Solano. Take jobs, outdrive the CPD, and build your fortune.
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px; width: 260px;">
            <button id="btn-start" style="background: linear-gradient(135deg, #0284c7, #0369a1); border: none; padding: 14px; border-radius: 6px; color: white; font-weight: 800; font-size: 16px; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);">
              Start Game
            </button>
            <button id="btn-missions" style="background: rgba(30, 41, 59, 0.8); border: 1px solid #475569; padding: 12px; border-radius: 6px; color: white; font-weight: 700; font-size: 14px; cursor: pointer;">
              Mission Select
            </button>
            <button id="btn-garage" style="background: rgba(30, 41, 59, 0.8); border: 1px solid #475569; padding: 12px; border-radius: 6px; color: white; font-weight: 700; font-size: 14px; cursor: pointer;">
              Vehicles & Garage
            </button>
            <button id="btn-controls" style="background: rgba(30, 41, 59, 0.8); border: 1px solid #475569; padding: 12px; border-radius: 6px; color: white; font-weight: 700; font-size: 14px; cursor: pointer;">
              Controls & Lore
            </button>
          </div>

          <div style="margin-top: 36px; font-size: 12px; color: #64748b; text-align: center;">
            WASD / Arrows to Drive & Walk &bull; Space / F to Fire &bull; E to Enter/Exit &bull; P to Pause
          </div>
        </div>
      `;

      container.querySelector('#btn-start').onclick = () => onAction('start_free_roam');
      container.querySelector('#btn-missions').onclick = () => onAction('open_missions_menu');
      container.querySelector('#btn-garage').onclick = () => showScreen('garage');
      container.querySelector('#btn-controls').onclick = () => onAction('open_controls');
    }

    // 2. Garage Preview Screen
    else if (currentScreen === 'garage') {
      const vKeys = Object.keys(VEHICLE_CLASSES);
      let vCards = '';

      vKeys.forEach((key) => {
        const v = VEHICLE_CLASSES[key];
        vCards += `
          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 14px; width: 180px;">
            <div style="font-size: 16px; font-weight: 800; color: #f8fafc;">${v.name}</div>
            <div style="font-size: 11px; color: #38bdf8; text-transform: uppercase; font-weight: 700;">${v.category}</div>
            <div style="margin-top: 10px; font-size: 12px; color: #94a3b8;">
              <div>Top Speed: <span style="color:#f8fafc; font-weight:700;">${Math.round(v.topSpeed * 3.6)} km/h</span></div>
              <div>Armor HP: <span style="color:#f8fafc; font-weight:700;">${v.maxHp}</span></div>
              <div>Handling: <span style="color:#f8fafc; font-weight:700;">${Math.round(v.grip * 100)}%</span></div>
            </div>
          </div>
        `;
      });

      container.innerHTML = `
        <div style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.95); display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: system-ui, sans-serif; color: #f8fafc; z-index: 100; padding: 20px;">
          <h2 style="font-size: 32px; font-weight: 900; margin: 0 0 8px 0; text-transform: uppercase; color: #38bdf8;">Vehicle Depot</h2>
          <div style="font-size: 14px; color: #94a3b8; margin-bottom: 24px;">All vehicles engineered with custom arcade physics models.</div>
          <div style="display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; max-width: 680px;">
            ${vCards}
          </div>
          <button id="btn-back" style="margin-top: 30px; background: #0284c7; border: none; padding: 12px 30px; border-radius: 6px; color: white; font-weight: 800; cursor: pointer;">
            Back to Menu
          </button>
        </div>
      `;
      container.querySelector('#btn-back').onclick = () => showScreen('title');
    }

    // 3. Pause Menu
    else if (currentScreen === 'pause') {
      container.innerHTML = `
        <div style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px); display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: system-ui, sans-serif; color: #f8fafc; z-index: 100;">
          <h2 style="font-size: 36px; font-weight: 900; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 2px;">Game Paused</h2>
          <div style="display: flex; flex-direction: column; gap: 12px; width: 240px;">
            <button id="btn-resume" style="background: #0284c7; border: none; padding: 12px; border-radius: 6px; color: white; font-weight: 800; cursor: pointer;">Resume Game</button>
            <button id="btn-restart" style="background: #334155; border: none; padding: 12px; border-radius: 6px; color: white; font-weight: 700; cursor: pointer;">Restart Mission</button>
            <button id="btn-finish" style="background: #334155; border: none; padding: 12px; border-radius: 6px; color: #facc15; font-weight: 800; cursor: pointer;">Finish Run (Results)</button>
            <button id="btn-quit" style="background: #1e293b; border: 1px solid #475569; padding: 12px; border-radius: 6px; color: #ef4444; font-weight: 700; cursor: pointer;">Quit to Title</button>
          </div>
        </div>
      `;
      container.querySelector('#btn-resume').onclick = () => onAction('resume');
      container.querySelector('#btn-restart').onclick = () => onAction('restart_mission');
      container.querySelector('#btn-finish').onclick = () => onAction('finish_run');
      container.querySelector('#btn-quit').onclick = () => onAction('quit_to_title');
    }

    // 4. Mission Briefing Screen
    else if (currentScreen === 'briefing' && screenData) {
      const m = screenData;
      container.innerHTML = `
        <div style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.9); display: flex; align-items: center; justify-content: center; font-family: system-ui, sans-serif; color: #f8fafc; z-index: 100;">
          <div style="background: #1e293b; border: 2px solid #0284c7; border-radius: 10px; padding: 28px; width: 440px; box-shadow: 0 10px 25px rgba(0,0,0,0.6);">
            <div style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 1px;">Mission Briefing</div>
            <h2 style="font-size: 28px; font-weight: 900; margin: 4px 0 12px 0;">${m.title}</h2>
            <div style="font-size: 14px; color: #94a3b8; line-height: 1.5; margin-bottom: 20px;">
              ${m.briefing}
            </div>
            <div style="background: #0f172a; padding: 14px; border-radius: 6px; margin-bottom: 20px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
                <span style="color: #94a3b8;">District:</span>
                <span style="font-weight: 700; color: #f8fafc;">${m.district}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
                <span style="color: #94a3b8;">Time Limit:</span>
                <span style="font-weight: 700; color: #facc15;">${m.timeLimit ? `${m.timeLimit}s` : 'None'}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 13px;">
                <span style="color: #94a3b8;">Payout:</span>
                <span style="font-weight: 700; color: #34d399;">$ ${m.cashReward} &bull; +${m.scoreReward} pts</span>
              </div>
            </div>
            <div style="display: flex; gap: 12px;">
              <button id="btn-accept" style="flex: 1; background: #0284c7; border: none; padding: 12px; border-radius: 6px; color: white; font-weight: 800; font-size: 15px; cursor: pointer;">
                Accept Job
              </button>
              <button id="btn-decline" style="background: #334155; border: none; padding: 12px 20px; border-radius: 6px; color: white; font-weight: 700; cursor: pointer;">
                Cancel
              </button>
            </div>
          </div>
        </div>
      `;
      container.querySelector('#btn-accept').onclick = () => onAction('accept_mission');
      container.querySelector('#btn-decline').onclick = () => onAction('decline_mission');
    }

    // 5. Mission Complete Card
    else if (currentScreen === 'complete' && screenData) {
      const res = screenData;
      container.innerHTML = `
        <div style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; font-family: system-ui, sans-serif; color: #f8fafc; z-index: 100;">
          <div style="background: rgba(30, 41, 59, 0.95); border: 2px solid #10b981; border-radius: 12px; padding: 28px 36px; width: 440px; text-align: center; box-shadow: 0 12px 36px rgba(0,0,0,0.7);">
            <div style="font-size: 40px; margin-bottom: 4px;">🏆</div>
            <div style="font-size: 13px; font-weight: 800; color: #34d399; text-transform: uppercase; letter-spacing: 2px;">Job Accomplished</div>
            <h2 style="font-size: 32px; font-weight: 900; margin: 4px 0 6px 0; color: #f8fafc; text-transform: uppercase;">${res.mission.title}</h2>
            <div style="font-size: 13px; color: #cbd5e1; margin-bottom: 18px;">${res.mission.tagline || 'Contraband delivered safely to Centro contact.'}</div>
            <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid #334155; padding: 16px 20px; border-radius: 8px; margin-bottom: 22px; text-align: left;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                <span style="color: #94a3b8;">Time Taken:</span>
                <span style="font-weight: 800; color: #f8fafc;">${Math.round(res.elapsed)}s</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                <span style="color: #94a3b8;">Medal Rating:</span>
                <span style="font-weight: 800; color: #facc15;">${res.medal || 'Gold'} ★★★</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                <span style="color: #94a3b8;">Reward Payout:</span>
                <span style="font-weight: 900; color: #34d399;">+$ ${res.cash.toLocaleString()}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 14px;">
                <span style="color: #94a3b8;">Score Gained:</span>
                <span style="font-weight: 900; color: #38bdf8;">+${res.score.toLocaleString()} pts</span>
              </div>
            </div>
            <button id="btn-continue" style="width: 100%; background: linear-gradient(135deg, #10b981, #059669); border: none; padding: 14px; border-radius: 8px; color: white; font-weight: 800; font-size: 16px; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
              Continue Free Roam
            </button>
          </div>
        </div>
      `;
      container.querySelector('#btn-continue').onclick = () => onAction('continue_free_roam');
    }

    // 6. Busted Screen
    else if (currentScreen === 'busted') {
      container.innerHTML = `
        <div style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.95); display: flex; align-items: center; justify-content: center; font-family: system-ui, sans-serif; color: #f8fafc; z-index: 100;">
          <div style="text-align: center;">
            <h1 style="font-size: 64px; font-weight: 900; color: #3b82f6; text-transform: uppercase; margin: 0; letter-spacing: 4px;">Busted</h1>
            <div style="font-size: 18px; color: #94a3b8; margin: 12px 0 24px 0;">Arrested by CPD. Bail deducted, mission forfeited.</div>
            <button id="btn-respawn" style="background: #3b82f6; border: none; padding: 12px 32px; border-radius: 6px; color: white; font-weight: 800; font-size: 16px; cursor: pointer;">
              Respawn at Police HQ
            </button>
          </div>
        </div>
      `;
      container.querySelector('#btn-respawn').onclick = () => onAction('respawn_busted');
    }

    // 7. Wasted Screen
    else if (currentScreen === 'wasted') {
      container.innerHTML = `
        <div style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.95); display: flex; align-items: center; justify-content: center; font-family: system-ui, sans-serif; color: #f8fafc; z-index: 100;">
          <div style="text-align: center;">
            <h1 style="font-size: 64px; font-weight: 900; color: #ef4444; text-transform: uppercase; margin: 0; letter-spacing: 4px;">Wasted</h1>
            <div style="font-size: 18px; color: #94a3b8; margin: 12px 0 24px 0;">Critical damage sustained. Medical fees charged.</div>
            <button id="btn-respawn" style="background: #ef4444; border: none; padding: 12px 32px; border-radius: 6px; color: white; font-weight: 800; font-size: 16px; cursor: pointer;">
              Respawn at Marina Hospital
            </button>
          </div>
        </div>
      `;
      container.querySelector('#btn-respawn').onclick = () => onAction('respawn_wasted');
    }

    // 8. Results / End Screen
    else if (currentScreen === 'results' && screenData) {
      const stats = screenData;
      container.innerHTML = `
        <div style="position: fixed; inset: 0; background: radial-gradient(circle at center, #1e1b4b 0%, #0f172a 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: system-ui, sans-serif; color: #f8fafc; z-index: 100; padding: 20px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="font-size: 12px; letter-spacing: 4px; text-transform: uppercase; color: #38bdf8; font-weight: 700;">Career Dossier</div>
            <h1 style="font-size: 40px; font-weight: 900; margin: 0; text-transform: uppercase;">Run Performance</h1>
          </div>

          <div style="display: flex; gap: 24px; align-items: center; margin-bottom: 28px;">
            <!-- Large Grade Badge -->
            <div style="background: #1e293b; border: 3px solid #facc15; border-radius: 12px; width: 130px; height: 130px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 0 25px rgba(250, 204, 21, 0.3);">
              <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">Final Rating</div>
              <div style="font-size: 64px; font-weight: 900; color: #facc15; line-height: 1;">${stats.grade}</div>
            </div>

            <!-- Stats Table -->
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 18px 24px; min-width: 320px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                <span style="color: #94a3b8;">Final Score:</span>
                <span style="font-weight: 900; color: #38bdf8; font-size: 16px;">${stats.score.toLocaleString()}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                <span style="color: #94a3b8;">Cash Accumulated:</span>
                <span style="font-weight: 800; color: #34d399;">$ ${stats.cash.toLocaleString()}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                <span style="color: #94a3b8;">Missions Completed:</span>
                <span style="font-weight: 800; color: #f8fafc;">${stats.missionsCompleted} / 7</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                <span style="color: #94a3b8;">Sol Tokens Collected:</span>
                <span style="font-weight: 800; color: #facc15;">${stats.tokens} / 20</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 14px;">
                <span style="color: #94a3b8;">Arrests / Hospital:</span>
                <span style="font-weight: 700; color: #ef4444;">${stats.busts} / ${stats.wastes}</span>
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 14px;">
            <button id="btn-again" style="background: #0284c7; border: none; padding: 14px 32px; border-radius: 6px; color: white; font-weight: 800; font-size: 15px; cursor: pointer;">
              Play Again
            </button>
            <button id="btn-menu" style="background: #334155; border: none; padding: 14px 28px; border-radius: 6px; color: white; font-weight: 700; font-size: 15px; cursor: pointer;">
              Title Menu
            </button>
          </div>
        </div>
      `;
      container.querySelector('#btn-again').onclick = () => onAction('start_free_roam');
      container.querySelector('#btn-menu').onclick = () => showScreen('title');
    }
  }

  return {
    showScreen,
    get currentScreen() {
      return currentScreen;
    },
  };
}
