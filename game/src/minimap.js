// Minimap radar: Canvas 2D road network, player chevron, police blips, and mission waypoints with edge clamping.
import { CITY_GRID, PALETTE } from './config.js';
import { dist, clamp } from './physics.js';

export function createMinimap(canvas) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const radius = size / 2;
  const viewRange = 140; // meters shown on radar

  function render(player, city, policeCars, missionWaypoint, tokens, healthRatio) {
    ctx.clearRect(0, 0, size, size);

    // Circular radar clipping
    ctx.save();
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 4, 0, Math.PI * 2);
    ctx.clip();

    // Radar backdrop
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(0, 0, size, size);

    // Transform relative to player
    ctx.translate(radius, radius);
    const rotation = -player.facingAngle;
    ctx.rotate(rotation);

    const scale = (radius - 10) / viewRange;

    // 1. Draw road network
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = CITY_GRID.streetWidth * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();

    const edges = city.roadEdges;
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const relX1 = (e.x1 - player.x) * scale;
      const relZ1 = (e.z1 - player.z) * scale;
      const relX2 = (e.x2 - player.x) * scale;
      const relZ2 = (e.z2 - player.z) * scale;

      ctx.moveTo(relX1, relZ1);
      ctx.lineTo(relX2, relZ2);
    }
    ctx.stroke();

    // Road centerlines
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 2. Nearby Sol Tokens
    if (tokens) {
      ctx.fillStyle = '#facc15';
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.collected) continue;
        const tx = (t.x - player.x) * scale;
        const tz = (t.z - player.z) * scale;
        if (tx * tx + tz * tz < radius * radius) {
          ctx.beginPath();
          ctx.arc(tx, tz, 3.0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 3. Police Blips
    if (policeCars) {
      for (let i = 0; i < policeCars.length; i++) {
        const cop = policeCars[i];
        if (!cop.active) continue;

        const cx = (cop.x - player.x) * scale;
        const cz = (cop.z - player.z) * scale;

        ctx.fillStyle = i % 2 === 0 ? '#ef4444' : '#3b82f6';
        ctx.beginPath();
        ctx.arc(cx, cz, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 4. Mission Waypoint (with radar edge clamping)
    let wpDistanceText = '';
    if (missionWaypoint) {
      const wx = (missionWaypoint.x - player.x) * scale;
      const wz = (missionWaypoint.z - player.z) * scale;
      const wpDist = dist(player.x, player.z, missionWaypoint.x, missionWaypoint.z);
      wpDistanceText = `${Math.round(wpDist)}m`;

      const dFromCenter = Math.sqrt(wx * wx + wz * wz);
      const maxClamp = radius - 16;

      let drawWpX = wx;
      let drawWpZ = wz;

      if (dFromCenter > maxClamp) {
        drawWpX = (wx / dFromCenter) * maxClamp;
        drawWpZ = (wz / dFromCenter) * maxClamp;
      }

      // Draw pulsating diamond
      ctx.save();
      ctx.translate(drawWpX, drawWpZ);
      ctx.rotate(-rotation); // keep icon upright
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore(); // restore clipping and rotation

    // 5. Player Chevron at center
    ctx.save();
    ctx.translate(radius, radius);
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 8);
    ctx.lineTo(0, 5);
    ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 6. Perimeter Circular Border and Health Arc
    ctx.save();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 3, 0, Math.PI * 2);
    ctx.stroke();

    // Health Arc
    const healthAngle = (Math.PI * 2) * clamp(healthRatio || 1.0, 0, 1);
    ctx.strokeStyle = (healthRatio || 1.0) > 0.3 ? '#10b981' : '#ef4444';
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 3, -Math.PI / 2, -Math.PI / 2 + healthAngle);
    ctx.stroke();
    ctx.restore();

    // Waypoint distance readout label at top
    if (wpDistanceText) {
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(wpDistanceText, radius, 18);
    }
  }

  return { render };
}
