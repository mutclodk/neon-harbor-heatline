// Three.js 3D world builder: lighting, sunset sky, procedural window textures,
// roads with markings, sidewalks, palm trees, streetlamps with additive bloom sprites,
// neon signs with glow, harbour ships and cranes, water specular reflections.
import * as THREE from 'three';
import { CITY_GRID, PALETTE, DISTRICTS } from './config.js';
import { buildVehicleMesh, syncVehicleMesh } from './vehicles.js';
import { buildPedestrianMesh } from './pedestrians.js';

// Reusable procedural textures
let sharedGlowTex = null;
let sharedWindowTextures = null;
let sharedHeadlightBeamTex = null;
let sharedWaterTex = null;
let sharedRoadTex = null;
let sharedYellowLineTex = null;
let sharedWhiteLineTex = null;
let sharedSidewalkTex = null;
let sharedGroundTex = null;
const NEON_LABELS = ['HEATLINE', 'PORT SOLANO', 'MARINA', 'NEON CLUB', 'SOLANO', 'HOTEL VICE'];

// Fast deterministic Mulberry32 PRNG for code-generated textures
function makeSeededRng(seed) {
  let s = (seed >>> 0) || 1;
  return function next() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getNeonSignTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 112);

  ctx.font = 'bold 54px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillText(text, 256, 64);
  ctx.fillText(text, 256, 64);

  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function getWaterTexture() {
  if (sharedWaterTex) return sharedWaterTex;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  const rng = makeSeededRng(9943);

  // 1. Deep ocean & coastal harbor depth gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#06283d'); // deep sea navy
  grad.addColorStop(0.35, '#0e7490'); // port Solano luminous teal
  grad.addColorStop(0.7, '#0284c7'); // surface tropical aqua
  grad.addColorStop(1.0, '#083344'); // dark wave trough
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // 2. Multi-frequency wave swells and ripples
  for (let y = 4; y < 512; y += 12) {
    ctx.strokeStyle = (y % 24 === 0) ? 'rgba(56, 189, 248, 0.65)' : 'rgba(125, 211, 252, 0.35)';
    ctx.lineWidth = (y % 24 === 0) ? 2.0 : 1.2;
    ctx.beginPath();
    for (let x = 0; x <= 512; x += 16) {
      const cy = y + Math.sin(x * 0.05 + y * 0.04) * 3.5 + Math.cos(x * 0.11 - y * 0.06) * 1.5;
      if (x === 0) ctx.moveTo(x, cy);
      else ctx.lineTo(x, cy);
    }
    ctx.stroke();
  }

  // 3. Golden sun specular sheen band across the bay
  const sunBand = ctx.createLinearGradient(0, 0, 512, 0);
  sunBand.addColorStop(0.0, 'rgba(254, 240, 138, 0.0)');
  sunBand.addColorStop(0.2, 'rgba(249, 115, 22, 0.18)');
  sunBand.addColorStop(0.5, 'rgba(254, 240, 138, 0.45)');
  sunBand.addColorStop(0.8, 'rgba(249, 115, 22, 0.18)');
  sunBand.addColorStop(1.0, 'rgba(254, 240, 138, 0.0)');
  ctx.fillStyle = sunBand;
  ctx.fillRect(0, 0, 512, 512);

  // 4. Subtle foam specks and micro-turbulence
  for (let i = 0; i < 450; i++) {
    const fx = rng() * 512;
    const fy = rng() * 512;
    const fr = 0.7 + rng() * 1.8;
    ctx.fillStyle = 'rgba(224, 242, 254, 0.22)';
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    ctx.fill();
  }

  sharedWaterTex = new THREE.CanvasTexture(c);
  sharedWaterTex.wrapS = THREE.RepeatWrapping;
  sharedWaterTex.wrapT = THREE.RepeatWrapping;
  sharedWaterTex.repeat.set(40, 40);
  return sharedWaterTex;
}

function getRoadTexture() {
  if (sharedRoadTex) return sharedRoadTex;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  const rng = makeSeededRng(8812);

  // Base warm slate asphalt
  ctx.fillStyle = '#343a44';
  ctx.fillRect(0, 0, 512, 512);

  // Mineral aggregate speckles (crushed stone, bitumen, mineral flecks)
  const aggregateColors = ['#252b33', '#3d4552', '#4b5563', '#2d333d', '#1f242b', '#525d6d'];
  for (let i = 0; i < 16000; i++) {
    const x = Math.floor(rng() * 512);
    const y = Math.floor(rng() * 512);
    const w = 1 + Math.floor(rng() * 2);
    const h = 1 + Math.floor(rng() * 2);
    ctx.fillStyle = aggregateColors[Math.floor(rng() * aggregateColors.length)];
    ctx.fillRect(x, y, w, h);
  }

  // Polished tire wear tracks in each traffic lane
  const laneG = ctx.createLinearGradient(0, 0, 512, 0);
  laneG.addColorStop(0.00, 'rgba(15, 18, 22, 0.0)');
  laneG.addColorStop(0.18, 'rgba(15, 18, 22, 0.35)'); // outer wheel track lane 1
  laneG.addColorStop(0.32, 'rgba(15, 18, 22, 0.35)'); // inner wheel track lane 1
  laneG.addColorStop(0.50, 'rgba(15, 18, 22, 0.05)'); // center dividing strip
  laneG.addColorStop(0.68, 'rgba(15, 18, 22, 0.35)'); // inner wheel track lane 2
  laneG.addColorStop(0.82, 'rgba(15, 18, 22, 0.35)'); // outer wheel track lane 2
  laneG.addColorStop(1.00, 'rgba(15, 18, 22, 0.0)');
  ctx.fillStyle = laneG;
  ctx.fillRect(0, 0, 512, 512);

  // Transverse tar sealant expansion cracks
  ctx.strokeStyle = '#14161a';
  ctx.lineWidth = 1.6;
  for (let k = 0; k < 3; k++) {
    const startY = (k * 170 + 35 + rng() * 30) % 512;
    ctx.beginPath();
    let cx = 0;
    let cy = startY;
    ctx.moveTo(cx, cy);
    while (cx < 512) {
      cx += 18 + rng() * 26;
      cy += (rng() - 0.5) * 6;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  // Faint oil drip tracks along the center of each travel lane
  for (const center of [128, 384]) {
    const dripG = ctx.createLinearGradient(center - 18, 0, center + 18, 0);
    dripG.addColorStop(0.0, 'rgba(10, 12, 16, 0)');
    dripG.addColorStop(0.5, 'rgba(10, 12, 16, 0.28)');
    dripG.addColorStop(1.0, 'rgba(10, 12, 16, 0)');
    ctx.fillStyle = dripG;
    ctx.fillRect(center - 18, 0, 36, 512);
  }

  // Weathered road repair patch
  ctx.fillStyle = 'rgba(40, 46, 56, 0.25)';
  ctx.fillRect(60, 210, 110, 85);
  ctx.strokeStyle = '#181b22';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(60, 210, 110, 85);

  sharedRoadTex = new THREE.CanvasTexture(c);
  sharedRoadTex.wrapS = THREE.RepeatWrapping;
  sharedRoadTex.wrapT = THREE.RepeatWrapping;
  return sharedRoadTex;
}

function getYellowLineTexture() {
  if (sharedYellowLineTex) return sharedYellowLineTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext('2d');
  const rng = makeSeededRng(3341);

  // Highway yellow road marking
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 0, 64, 256);

  // Paint stipple & edge aggregate bleed
  for (let i = 0; i < 700; i++) {
    const x = Math.floor(rng() * 64);
    const y = Math.floor(rng() * 256);
    ctx.fillStyle = rng() > 0.6 ? '#eab308' : (rng() > 0.3 ? '#fde047' : '#334155');
    ctx.fillRect(x, y, 1, 1 + Math.floor(rng() * 2));
  }

  // Subtle darkened edge bevel
  ctx.fillStyle = 'rgba(20, 24, 30, 0.3)';
  ctx.fillRect(0, 0, 2, 256);
  ctx.fillRect(62, 0, 2, 256);

  sharedYellowLineTex = new THREE.CanvasTexture(c);
  sharedYellowLineTex.wrapS = THREE.RepeatWrapping;
  sharedYellowLineTex.wrapT = THREE.RepeatWrapping;
  return sharedYellowLineTex;
}

function getWhiteLineTexture() {
  if (sharedWhiteLineTex) return sharedWhiteLineTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const rng = makeSeededRng(4412);

  // White thermoplastic road stripe
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 128, 128);

  // Paint stipple, wear, and aggregate flecks
  for (let i = 0; i < 900; i++) {
    const x = Math.floor(rng() * 128);
    const y = Math.floor(rng() * 128);
    ctx.fillStyle = rng() > 0.7 ? '#e2e8f0' : (rng() > 0.25 ? '#cbd5e1' : '#475569');
    ctx.fillRect(x, y, 1, 1);
  }

  // Edge bevel
  ctx.fillStyle = 'rgba(30, 41, 59, 0.3)';
  ctx.fillRect(0, 0, 3, 128);
  ctx.fillRect(125, 0, 3, 128);

  sharedWhiteLineTex = new THREE.CanvasTexture(c);
  sharedWhiteLineTex.wrapS = THREE.RepeatWrapping;
  sharedWhiteLineTex.wrapT = THREE.RepeatWrapping;
  return sharedWhiteLineTex;
}

function getSidewalkTexture() {
  if (sharedSidewalkTex) return sharedSidewalkTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const rng = makeSeededRng(7721);

  // Base concrete
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(0, 0, 256, 256);

  // 4x4 paver slabs (64px each)
  const tileSize = 64;
  for (let py = 0; py < 256; py += tileSize) {
    for (let px = 0; px < 256; px += tileSize) {
      // Individual slab tone variation (±6%)
      const slabTint = (rng() - 0.5) * 16;
      ctx.fillStyle = slabTint >= 0 ? `rgba(241, 245, 249, ${slabTint / 100})` : `rgba(71, 85, 105, ${-slabTint / 100})`;
      ctx.fillRect(px, py, tileSize, tileSize);

      // Expansion groove (recessed dark joint)
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);

      // Light bevel highlight on top/left
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + 2, py + tileSize - 2);
      ctx.lineTo(px + 2, py + 2);
      ctx.lineTo(px + tileSize - 2, py + 2);
      ctx.stroke();
    }
  }

  // Fine concrete aggregate specks
  for (let i = 0; i < 4500; i++) {
    const x = Math.floor(rng() * 256);
    const y = Math.floor(rng() * 256);
    ctx.fillStyle = rng() > 0.5 ? '#cbd5e1' : '#64748b';
    ctx.fillRect(x, y, 1, 1);
  }

  sharedSidewalkTex = new THREE.CanvasTexture(c);
  sharedSidewalkTex.wrapS = THREE.RepeatWrapping;
  sharedSidewalkTex.wrapT = THREE.RepeatWrapping;
  return sharedSidewalkTex;
}

function getGroundTexture() {
  if (sharedGroundTex) return sharedGroundTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const rng = makeSeededRng(5533);

  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 256, 256);

  // Gravel, grit, and earth speckles
  for (let i = 0; i < 7000; i++) {
    const x = Math.floor(rng() * 256);
    const y = Math.floor(rng() * 256);
    ctx.fillStyle = rng() > 0.6 ? '#475569' : (rng() > 0.3 ? '#1e293b' : '#64748b');
    ctx.fillRect(x, y, 1 + Math.floor(rng() * 2), 1 + Math.floor(rng() * 2));
  }

  sharedGroundTex = new THREE.CanvasTexture(c);
  sharedGroundTex.wrapS = THREE.RepeatWrapping;
  sharedGroundTex.wrapT = THREE.RepeatWrapping;
  return sharedGroundTex;
}

export function getGlowTexture() {
  if (sharedGlowTex) return sharedGlowTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.2, 'rgba(255, 240, 180, 0.9)');
  g.addColorStop(0.5, 'rgba(255, 180, 80, 0.4)');
  g.addColorStop(0.8, 'rgba(255, 120, 40, 0.1)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  sharedGlowTex = new THREE.CanvasTexture(c);
  return sharedGlowTex;
}

export function getHeadlightBeamTexture() {
  if (sharedHeadlightBeamTex) return sharedHeadlightBeamTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 0, 4, 64, 180, 120);
  g.addColorStop(0, 'rgba(255, 250, 220, 0.55)');
  g.addColorStop(0.3, 'rgba(255, 240, 180, 0.3)');
  g.addColorStop(0.7, 'rgba(255, 220, 140, 0.1)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 256);
  sharedHeadlightBeamTex = new THREE.CanvasTexture(c);
  return sharedHeadlightBeamTex;
}

function createSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  // Upper hemisphere (0.0 to 0.5 = zenith down to horizon)
  const gTop = ctx.createLinearGradient(0, 0, 0, 256);
  gTop.addColorStop(0.0, '#1e1b4b'); // deep twilight indigo
  gTop.addColorStop(0.32, '#581c87'); // royal purple
  gTop.addColorStop(0.55, '#c026d3'); // vibrant magenta
  gTop.addColorStop(0.72, '#e11d48'); // bright neon rose
  gTop.addColorStop(0.85, '#ea580c'); // fiery sunset orange
  gTop.addColorStop(0.95, '#f97316'); // glowing sunset orange
  gTop.addColorStop(1.0, '#fde047'); // golden yellow horizon
  ctx.fillStyle = gTop;
  ctx.fillRect(0, 0, 512, 256);

  // Lower hemisphere (horizon down to nadir / water reflection)
  const gBottom = ctx.createLinearGradient(0, 256, 0, 512);
  gBottom.addColorStop(0.0, '#fde047');
  gBottom.addColorStop(0.12, '#ea580c');
  gBottom.addColorStop(0.4, '#0e7490');
  gBottom.addColorStop(1.0, '#083344');
  ctx.fillStyle = gBottom;
  ctx.fillRect(0, 256, 512, 256);

  // Glowing sun disc right at the horizon (y = 230)
  const sunGrad = ctx.createRadialGradient(256, 230, 4, 256, 230, 48);
  sunGrad.addColorStop(0, 'rgba(255, 255, 245, 1)');
  sunGrad.addColorStop(0.3, 'rgba(254, 240, 138, 0.8)');
  sunGrad.addColorStop(0.7, 'rgba(249, 115, 22, 0.3)');
  sunGrad.addColorStop(1.0, 'rgba(249, 115, 22, 0)');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(256, 230, 48, 0, Math.PI * 2);
  ctx.fill();

  // Subtle clouds along the horizon
  ctx.fillStyle = 'rgba(253, 186, 116, 0.42)';
  for (let i = 0; i < 9; i++) {
    const cx = (i * 65 + 20) % 512;
    const cy = 205 + (i % 3) * 14;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 65, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

function getWindowTextures() {
  if (sharedWindowTextures) return sharedWindowTextures;

  function makeTex(type) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');

    const cEm = document.createElement('canvas');
    cEm.width = 512;
    cEm.height = 512;
    const ctxEm = cEm.getContext('2d');
    ctxEm.fillStyle = '#000000';
    ctxEm.fillRect(0, 0, 512, 512);

    const rng = makeSeededRng(
      type === 'harbor' ? 10101 :
      type === 'marina' ? 20202 :
      type === 'centro' ? 30303 :
      type === 'alto' ? 40404 : 50505
    );

    let cols = 8;
    let rows = 14;

    if (type === 'harbor') {
      // Old Harbor: Weathered port brick & concrete masonry with industrial multi-pane windows
      cols = 6;
      rows = 12;
      ctx.fillStyle = '#442e26';
      ctx.fillRect(0, 0, 512, 512);

      // Horizontal brick courses with staggered mortar joints
      const courseH = 16;
      for (let y = 0; y < 512; y += courseH) {
        ctx.strokeStyle = '#261813';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();

        const offset = (Math.floor(y / courseH) % 2) * 16;
        for (let x = offset; x < 512; x += 32) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + courseH);
          ctx.stroke();

          // Subtle brick hue variation
          const bTint = (rng() - 0.5) * 24;
          ctx.fillStyle = bTint >= 0 ? `rgba(217, 107, 39, ${bTint / 250})` : `rgba(20, 10, 8, ${-bTint / 250})`;
          ctx.fillRect(x + 1, y + 1, 30, courseH - 2);
        }
      }

      // Soot and industrial grime specks
      for (let i = 0; i < 4000; i++) {
        const x = Math.floor(rng() * 512);
        const y = Math.floor(rng() * 512);
        ctx.fillStyle = rng() > 0.5 ? '#1f130e' : '#573d32';
        ctx.fillRect(x, y, 1, 1);
      }
    } else if (type === 'marina') {
      // Marina Strip: Art Deco warm pastel rose stucco with elegant decorative relief bands
      cols = 8;
      rows = 14;
      ctx.fillStyle = '#362134'; // warm rose-terracotta
      ctx.fillRect(0, 0, 512, 512);

      // Fine stucco plaster stipple
      for (let i = 0; i < 5000; i++) {
        const x = Math.floor(rng() * 512);
        const y = Math.floor(rng() * 512);
        ctx.fillStyle = rng() > 0.5 ? '#4a2c47' : '#271625';
        ctx.fillRect(x, y, 1, 1);
      }

      // Decorative horizontal Art Deco frieze bands in turquoise and coral
      for (let b = 0; b < 512; b += 72) {
        ctx.fillStyle = '#0d9488'; // deco teal band
        ctx.fillRect(0, b, 512, 4);
        ctx.fillStyle = '#fb7185'; // deco rose pinstripe
        ctx.fillRect(0, b + 5, 512, 2);
      }
    } else if (type === 'centro') {
      // Centro: Modern high-rise glass curtain wall & titanium mullions
      cols = 8;
      rows = 16;
      ctx.fillStyle = '#0f172a'; // deep titanium slate
      ctx.fillRect(0, 0, 512, 512);

      // Structural metallic floor spandrel bands
      for (let y = 0; y < 512; y += 32) {
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, y, 512, 6);
        ctx.fillStyle = '#64748b';
        ctx.fillRect(0, y + 1, 512, 1);
      }

      // Vertical metallic mullions
      for (let x = 0; x < 512; x += 32) {
        ctx.fillStyle = '#475569';
        ctx.fillRect(x, 0, 3, 512);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(x + 1, 0, 1, 512);
      }
    } else if (type === 'alto') {
      // Barrio Alto: Sun-drenched terracotta masonry & adobe stucco
      cols = 6;
      rows = 10;
      ctx.fillStyle = '#5c2b1d';
      ctx.fillRect(0, 0, 512, 512);

      // Terracotta brick courses
      const courseH = 20;
      for (let y = 0; y < 512; y += courseH) {
        ctx.strokeStyle = '#38170d';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();

        const offset = (Math.floor(y / courseH) % 2) * 20;
        for (let x = offset; x < 512; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + courseH);
          ctx.stroke();

          const bTint = (rng() - 0.5) * 28;
          ctx.fillStyle = bTint >= 0 ? `rgba(245, 158, 11, ${bTint / 250})` : `rgba(35, 12, 6, ${-bTint / 250})`;
          ctx.fillRect(x + 1, y + 1, 38, courseH - 2);
        }
      }
    } else {
      // Industrial Flats: Precast industrial concrete seams, grime, and steel ribs
      cols = 8;
      rows = 10;
      ctx.fillStyle = '#292e36';
      ctx.fillRect(0, 0, 512, 512);

      // Concrete panel seams & tie bolts
      for (let y = 0; y < 512; y += 48) {
        ctx.strokeStyle = '#181b20';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();

        // Tie-bolt anchor points
        for (let x = 24; x < 512; x += 48) {
          ctx.fillStyle = '#0f1115';
          ctx.beginPath();
          ctx.arc(x, y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Grime weathering
      for (let i = 0; i < 4000; i++) {
        const x = Math.floor(rng() * 512);
        const y = Math.floor(rng() * 512);
        ctx.fillStyle = rng() > 0.6 ? '#1c1f24' : '#383f4a';
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Window Grid placement
    const padX = 10;
    const padY = 8;
    const w = (512 - padX * (cols + 1)) / cols;
    const h = (512 - padY * (rows + 1)) / rows;

    for (let r = 0; r < rows; r++) {
      for (let cl = 0; cl < cols; cl++) {
        const x = padX + cl * (w + padX);
        const y = padY + r * (h + padY);

        // Window frame surround / sill
        if (type === 'harbor') {
          // Concrete lintel above & sill below
          ctx.fillStyle = '#64748b';
          ctx.fillRect(x - 2, y - 3, w + 4, 3);
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(x - 2, y + h, w + 4, 3);
        } else if (type === 'marina') {
          // Elegant white architrave surround
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 2;
          ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
        } else if (type === 'alto') {
          // Timber lintel header
          ctx.fillStyle = '#78350f';
          ctx.fillRect(x - 1, y - 3, w + 2, 3);
        }

        // Window Glass & Illumination
        const isLit = (Math.sin(r * 19.3 + cl * 7.7 + (type === 'centro' ? 2 : 0)) > 0.12);

        if (isLit) {
          let winColor = '#fbbf24';
          if (type === 'centro') {
            winColor = (cl + r) % 3 === 0 ? '#38bdf8' : ((cl + r) % 3 === 1 ? '#f0f9ff' : '#fde047');
          } else if (type === 'marina') {
            winColor = (cl + r) % 2 === 0 ? '#f472b6' : '#fef08a';
          } else if (type === 'flats') {
            winColor = '#eab308';
          } else if (type === 'alto') {
            winColor = (cl + r) % 2 === 0 ? '#f59e0b' : '#fbbf24';
          }

          // Diffuse lit window
          ctx.fillStyle = winColor;
          ctx.fillRect(x, y, w, h);

          // Subtle window cross mullion
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(x + w / 2, y);
          ctx.lineTo(x + w / 2, y + h);
          ctx.moveTo(x, y + h / 2);
          ctx.lineTo(x + w, y + h / 2);
          ctx.stroke();

          // Emissive glow map - ONLY lit windows glow!
          ctxEm.fillStyle = winColor;
          ctxEm.fillRect(x, y, w, h);
        } else {
          // Dark reflective glass with subtle sky reflection
          if (type === 'centro') {
            const glassG = ctx.createLinearGradient(x, y, x, y + h);
            glassG.addColorStop(0, '#1e3a5f');
            glassG.addColorStop(1, '#090d16');
            ctx.fillStyle = glassG;
          } else {
            ctx.fillStyle = '#0f172a';
          }
          ctx.fillRect(x, y, w, h);

          // Dark window divider
          ctx.strokeStyle = '#050811';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + w / 2, y);
          ctx.lineTo(x + w / 2, y + h);
          ctx.stroke();
        }
      }
    }

    const diffuse = new THREE.CanvasTexture(c);
    diffuse.wrapS = THREE.RepeatWrapping;
    diffuse.wrapT = THREE.RepeatWrapping;

    const emissive = new THREE.CanvasTexture(cEm);
    emissive.wrapS = THREE.RepeatWrapping;
    emissive.wrapT = THREE.RepeatWrapping;

    return { diffuse, emissive };
  }

  sharedWindowTextures = {
    harbor: makeTex('harbor'),
    marina: makeTex('marina'),
    centro: makeTex('centro'),
    alto: makeTex('alto'),
    flats: makeTex('flats'),
  };
  return sharedWindowTextures;
}

export function createRenderer(canvas) {
  const scene = new THREE.Scene();
  const skyTex = createSkyTexture();
  scene.background = skyTex;
  scene.fog = new THREE.FogExp2(0xf97316, 0.001);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.10;

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.5,
    950
  );

  // Lighting: High-contrast golden hour illumination with deep, readable shadows
  const hemiLight = new THREE.HemisphereLight(0xffeedd, 0x3b2d42, 0.22);
  scene.add(hemiLight);

  const ambientLight = new THREE.AmbientLight(0xfdba74, 0.08);
  scene.add(ambientLight);

  // Directional Sun with high shadow contrast
  const sunLight = new THREE.DirectionalLight(0xfff1db, 3.6);
  sunLight.position.set(220, 85, 240);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 400;
  sunLight.shadow.camera.left = -75;
  sunLight.shadow.camera.right = 75;
  sunLight.shadow.camera.top = 75;
  sunLight.shadow.camera.bottom = -75;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.04;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Ocean Plane surrounding Port Solano with water ripples & golden sheen
  const oceanGeom = new THREE.PlaneGeometry(4000, 4000);
  const waterTex = getWaterTexture();
  const oceanMat = new THREE.MeshLambertMaterial({
    map: waterTex,
    color: 0xffffff,
  });
  const oceanMesh = new THREE.Mesh(oceanGeom, oceanMat);
  oceanMesh.rotation.x = -Math.PI / 2;
  oceanMesh.position.set(CITY_GRID.totalWidth / 2, -0.25, CITY_GRID.totalHeight / 2);
  scene.add(oceanMesh);

  // Ground base beneath city (stops at western harbor dock at x = -8 so water is open)
  const groundMinX = -8;
  const groundMaxX = CITY_GRID.totalWidth + 90;
  const groundWidth = groundMaxX - groundMinX;
  const groundGeom = new THREE.PlaneGeometry(groundWidth, CITY_GRID.totalHeight + 180);
  const groundTex = getGroundTexture();
  groundTex.repeat.set(groundWidth / 14, (CITY_GRID.totalHeight + 180) / 14);
  const groundMat = new THREE.MeshLambertMaterial({
    map: groundTex,
    color: 0xffffff,
  });
  const groundMesh = new THREE.Mesh(groundGeom, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set((groundMinX + groundMaxX) / 2, 0, CITY_GRID.totalHeight / 2);
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // Harbor concrete bulkhead seawall along x = -8 dropping into the water
  const dockWallGeom = new THREE.BoxGeometry(2.5, 4.0, 700);
  const dockWallTex = getSidewalkTexture().clone();
  dockWallTex.repeat.set(2, 35);
  const dockWallMat = new THREE.MeshLambertMaterial({
    map: dockWallTex,
    color: 0x64748b,
  });
  const dockWall = new THREE.Mesh(dockWallGeom, dockWallMat);
  dockWall.position.set(-9.25, -1.8, 250);
  dockWall.receiveShadow = true;
  scene.add(dockWall);

  // Seaside promenade safety railing along the harbor edge (x = -7.8)
  const railMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
  const railGroup = new THREE.Group();
  for (let rz = -20; rz <= 250; rz += 6) {
    // Post
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), railMat);
    post.position.set(-7.8, 0.55, rz);
    post.castShadow = true;
    railGroup.add(post);
  }
  // Top & mid horizontal rail bars
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 270), railMat);
  topRail.position.set(-7.8, 1.05, 115);
  topRail.castShadow = true;
  const midRail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 270), railMat);
  midRail.position.set(-7.8, 0.55, 115);
  railGroup.add(topRail, midRail);
  scene.add(railGroup);

  // Mooring bollards along the quayside edge
  const bollardMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
  for (let bz = -20; bz <= 250; bz += 18) {
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.65, 8), bollardMat);
    bollard.position.set(-7.5, 0.32, bz);
    bollard.castShadow = true;
    scene.add(bollard);
  }

  // Marina wooden dock pier extending into the water
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
  const pierGeom = new THREE.BoxGeometry(22, 0.35, 4.2);
  const pier = new THREE.Mesh(pierGeom, pierMat);
  pier.position.set(-18, 0.08, 62);
  pier.receiveShadow = true;
  pier.castShadow = true;
  scene.add(pier);

  // Sleek white motor yacht moored at the marina slip
  const yachtGroup = new THREE.Group();
  const yachtHullMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
  const yachtHull = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.2, 14), yachtHullMat);
  yachtHull.position.y = 0.6;
  yachtHull.castShadow = true;

  const yachtStripe = new THREE.Mesh(
    new THREE.BoxGeometry(4.3, 0.4, 14.1),
    new THREE.MeshLambertMaterial({ color: 0x0284c7 })
  );
  yachtStripe.position.y = 0.3;

  const cabinMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
  const yachtCabin = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 6.5), cabinMat);
  yachtCabin.position.set(0, 2.0, -1.0);
  yachtCabin.castShadow = true;

  const archMat = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 });
  const radarArch = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.4, 0.4), archMat);
  radarArch.position.set(0, 3.2, -3.2);

  yachtGroup.add(yachtHull, yachtStripe, yachtCabin, radarArch);
  yachtGroup.position.set(-20, -0.1, 72);
  scene.add(yachtGroup);

  // Waypoint Beacon in 3D world
  const beaconGroup = new THREE.Group();
  const beaconGeom = new THREE.CylinderGeometry(0.9, 0.9, 50, 8);
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    transparent: true,
    opacity: 0.6,
  });
  const beaconCyl = new THREE.Mesh(beaconGeom, beaconMat);
  beaconCyl.position.y = 25;

  const beaconMarker = new THREE.Mesh(
    new THREE.OctahedronGeometry(2.2),
    new THREE.MeshBasicMaterial({ color: 0xfacc15 })
  );
  beaconMarker.position.y = 3.8;

  const beaconGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getGlowTexture(),
      color: 0xfacc15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  beaconGlow.scale.set(14, 14, 1);
  beaconGlow.position.y = 3.8;

  beaconGroup.add(beaconCyl, beaconMarker, beaconGlow);
  scene.add(beaconGroup);

  const tokenMeshes = [];
  const glowTex = getGlowTexture();
  const windowTextures = getWindowTextures();

  function buildCityMeshes(city) {
    const { cols, rows, pitch, streetWidth, sidewalkWidth, blockSize, totalWidth, totalHeight } = CITY_GRID;

    // 1. Roads: procedural textured asphalt receiving shadows
    const roadTexV = getRoadTexture();
    roadTexV.repeat.set(2, totalHeight / 14);

    const roadTexH = getRoadTexture().clone();
    roadTexH.repeat.set(totalWidth / 14, 2);
    roadTexH.rotation = Math.PI / 2;
    roadTexH.center.set(0.5, 0.5);

    const roadMatV = new THREE.MeshLambertMaterial({
      map: roadTexV,
      color: 0xffffff,
    });
    const roadMatH = new THREE.MeshLambertMaterial({
      map: roadTexH,
      color: 0xffffff,
    });
    const roadGroup = new THREE.Group();

    const yellowLineTex = getYellowLineTexture();
    yellowLineTex.repeat.set(1, totalHeight / 12);
    const yellowLineMat = new THREE.MeshLambertMaterial({
      map: yellowLineTex,
      color: 0xffffff,
    });

    const whiteLineTex = getWhiteLineTexture();
    const whiteLineMat = new THREE.MeshLambertMaterial({
      map: whiteLineTex,
      color: 0xffffff,
    });

    // Vertical streets
    for (let c = 0; c <= cols; c++) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(streetWidth, totalHeight), roadMatV);
      road.rotation.x = -Math.PI / 2;
      road.position.set(c * pitch, 0.02, totalHeight / 2);
      road.receiveShadow = true;
      roadGroup.add(road);

      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.35, totalHeight), yellowLineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(c * pitch, 0.03, totalHeight / 2);
      line.receiveShadow = true;
      roadGroup.add(line);
    }

    // Horizontal streets
    for (let r = 0; r <= rows; r++) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(totalWidth, streetWidth), roadMatH);
      road.rotation.x = -Math.PI / 2;
      road.position.set(totalWidth / 2, 0.02, r * pitch);
      road.receiveShadow = true;
      roadGroup.add(road);

      const line = new THREE.Mesh(new THREE.PlaneGeometry(totalWidth, 0.35), yellowLineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(totalWidth / 2, 0.03, r * pitch);
      line.receiveShadow = true;
      roadGroup.add(line);
    }

    // Pedestrian crosswalks at intersections
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const ix = c * pitch;
        const iz = r * pitch;

        for (let s = -3; s <= 3; s++) {
          const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 2.8), whiteLineMat);
          stripe.rotation.x = -Math.PI / 2;
          stripe.position.set(ix + s * 1.5, 0.035, iz - streetWidth * 0.55);
          stripe.receiveShadow = true;
          roadGroup.add(stripe);
        }
        for (let s = -3; s <= 3; s++) {
          const stripe = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.85), whiteLineMat);
          stripe.rotation.x = -Math.PI / 2;
          stripe.position.set(ix + streetWidth * 0.55, 0.035, iz + s * 1.5);
          stripe.receiveShadow = true;
          roadGroup.add(stripe);
        }
      }
    }
    scene.add(roadGroup);

    // 2. Concrete Sidewalks around each block (raised curbs with paver grid & aggregate)
    const sidewalkTex = getSidewalkTexture();
    sidewalkTex.repeat.set(blockSize / 8, blockSize / 8);
    const sidewalkMat = new THREE.MeshLambertMaterial({
      map: sidewalkTex,
      color: 0xffffff,
    });
    const sidewalkGroup = new THREE.Group();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bx = c * pitch + streetWidth / 2;
        const bz = r * pitch + streetWidth / 2;
        const sidewalkGeom = new THREE.BoxGeometry(blockSize, 0.22, blockSize);
        const sidewalk = new THREE.Mesh(sidewalkGeom, sidewalkMat);
        sidewalk.position.set(bx + blockSize / 2, 0.11, bz + blockSize / 2);
        sidewalk.receiveShadow = true;
        sidewalkGroup.add(sidewalk);
      }
    }
    scene.add(sidewalkGroup);

    // 3. Buildings with glowing procedural window textures & directional shading
    const buildings = city.buildings;
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      const bGroup = new THREE.Group();

      const winTex = windowTextures[b.district] || windowTextures.harbor;
      const mat = new THREE.MeshLambertMaterial({
        map: winTex.diffuse,
        emissiveMap: winTex.emissive,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.65,
      });

      const geom = new THREE.BoxGeometry(b.width, b.height, b.depth);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(b.x, b.height / 2 + 0.22, b.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      bGroup.add(mesh);

      // Rooftop cornice
      const cornice = new THREE.Mesh(
        new THREE.BoxGeometry(b.width + 0.8, 0.6, b.depth + 0.8),
        new THREE.MeshLambertMaterial({ color: 0x475569 })
      );
      cornice.position.set(b.x, b.height + 0.22 + 0.3, b.z);
      cornice.castShadow = true;
      cornice.receiveShadow = true;
      bGroup.add(cornice);

      // Rooftop AC units
      const acMesh = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 1.8, 3.2),
        new THREE.MeshLambertMaterial({ color: 0x64748b })
      );
      acMesh.position.set(b.x, b.height + 1.1, b.z);
      acMesh.castShadow = true;
      acMesh.receiveShadow = true;
      bGroup.add(acMesh);

      // Architectural stepped crown for skyline silhouette variety
      if (b.height > 24) {
        const tierW = b.width * 0.72;
        const tierD = b.depth * 0.72;
        const tierH = Math.min(14, b.height * 0.24);
        const tierGeom = new THREE.BoxGeometry(tierW, tierH, tierD);
        const tierMesh = new THREE.Mesh(tierGeom, mat);
        tierMesh.position.set(b.x, b.height + tierH / 2 + 0.22, b.z);
        tierMesh.castShadow = true;
        tierMesh.receiveShadow = true;
        bGroup.add(tierMesh);

        // Art-deco spire on tall towers
        if (b.height > 42) {
          const spireGeom = new THREE.ConeGeometry(1.2, 12, 6);
          const spireMat = new THREE.MeshLambertMaterial({ color: 0xf1f5f9 });
          const spireMesh = new THREE.Mesh(spireGeom, spireMat);
          spireMesh.position.set(b.x, b.height + tierH + 6 + 0.22, b.z);
          spireMesh.castShadow = true;
          bGroup.add(spireMesh);
        }
      }

      // Prominent rooftop neon signs with glowing text canvas textures
      if (b.hasNeonSign) {
        const signGroup = new THREE.Group();
        const signText = NEON_LABELS[b.id % NEON_LABELS.length];
        const signTex = getNeonSignTexture(signText, b.neonColor || '#f43f5e');
        const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true });

        const signWidth = Math.min(b.width * 0.85, 26);
        const signHeight = 5.5;
        const signGeom = new THREE.PlaneGeometry(signWidth, signHeight);

        // North-facing sign
        const signMeshN = new THREE.Mesh(signGeom, signMat);
        signMeshN.position.set(b.x, b.height + signHeight / 2 + 1.5, b.z - b.depth * 0.38);
        signMeshN.rotation.y = Math.PI;

        // South-facing sign
        const signMeshS = new THREE.Mesh(signGeom, signMat);
        signMeshS.position.set(b.x, b.height + signHeight / 2 + 1.5, b.z + b.depth * 0.38);

        // West-facing facade marquee sign on coastal / avenue buildings
        const signMeshW = new THREE.Mesh(signGeom, signMat);
        signMeshW.position.set(b.minX - 0.25, Math.min(b.height * 0.65, 16.5), b.z);
        signMeshW.rotation.y = -Math.PI / 2;

        const signGlowW = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowTex,
            color: new THREE.Color(b.neonColor || '#f43f5e'),
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        signGlowW.scale.set(signWidth * 1.2, signHeight * 2.0, 1);
        signGlowW.position.set(b.minX - 0.5, Math.min(b.height * 0.65, 16.5), b.z);

        // Neon glow sprite
        const signGlow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowTex,
            color: new THREE.Color(b.neonColor || '#f43f5e'),
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        signGlow.scale.set(signWidth * 1.25, signHeight * 2.2, 1);
        signGlow.position.set(b.x, b.height + signHeight / 2 + 1.5, b.z);

        signGroup.add(signMeshN, signMeshS, signMeshW, signGlowW, signGlow);
        bGroup.add(signGroup);
      }

      scene.add(bGroup);
    }

    // 4. Landmarks
    buildLandmarks();

    // 5. Props: Palm trees, streetlights with bloom sprites, containers
    buildProps(city.props);

    // 6. Collectible Tokens
    buildTokens(city.tokens);
  }

  function buildLandmarks() {
    // Port Gantry Cranes along the industrial harbor pier across the bay
    for (let cpos of [{ x: -70, z: 20 }, { x: -70, z: 65 }]) {
      const craneGroup = new THREE.Group();
      const steelMat = new THREE.MeshLambertMaterial({ color: 0xea580c }); // industrial safety orange

      // 4 heavy steel legs
      for (let dx of [-5.5, 5.5]) {
        for (let dz of [-6.5, 6.5]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(1.6, 44, 1.6), steelMat);
          leg.position.set(dx, 22, dz);
          leg.castShadow = true;
          craneGroup.add(leg);
        }
      }

      // Horizontal boom extending 85m out over the water, ship, and harbor slip
      const boom = new THREE.Mesh(new THREE.BoxGeometry(85, 3.8, 5.2), steelMat);
      boom.position.set(5, 44, 0); // reaches over the open water and ship toward dock
      boom.castShadow = true;
      craneGroup.add(boom);

      // Operator cabin
      const cabMat = new THREE.MeshLambertMaterial({ color: 0xfacc15 });
      const cab = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.8, 4.5), cabMat);
      cab.position.set(-8, 41, 0);
      cab.castShadow = true;
      craneGroup.add(cab);

      // Flashing red aviation warning beacon on apex
      const beaconSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex,
          color: 0xef4444,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      beaconSprite.scale.set(9, 9, 1);
      beaconSprite.position.set(-15, 47, 0);
      craneGroup.add(beaconSprite);

      craneGroup.position.set(cpos.x, 0, cpos.z);
      scene.add(craneGroup);
    }

    // Cargo ship moored at industrial docks across the open harbor water
    const shipGroup = new THREE.Group();
    const hullMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const hullGeom = new THREE.BoxGeometry(26, 7.5, 175);
    const hull = new THREE.Mesh(hullGeom, hullMat);
    hull.position.set(0, 1.8, 0);
    hull.castShadow = true;
    shipGroup.add(hull);

    // Red waterline stripe
    const keelMat = new THREE.MeshLambertMaterial({ color: 0x991b1b });
    const keel = new THREE.Mesh(new THREE.BoxGeometry(26.4, 2.0, 175.4), keelMat);
    keel.position.set(0, -1.0, 0);
    shipGroup.add(keel);

    // Bridge superstructure
    const bridgeGeom = new THREE.BoxGeometry(22, 16, 24);
    const bridgeMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
    const bridge = new THREE.Mesh(bridgeGeom, bridgeMat);
    bridge.position.set(0, 11, -55);
    bridge.castShadow = true;
    shipGroup.add(bridge);

    // Bridge windows
    const winMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
    const winBand = new THREE.Mesh(new THREE.BoxGeometry(22.4, 2.4, 20), winMat);
    winBand.position.set(0, 16, -55);
    shipGroup.add(winBand);

    // Radar mast with red beacon
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.8, 12, 6),
      new THREE.MeshLambertMaterial({ color: 0xffffff })
    );
    mast.position.set(0, 24, -55);
    shipGroup.add(mast);

    const shipBeacon = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xef4444,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    shipBeacon.scale.set(8, 8, 1);
    shipBeacon.position.set(0, 29, -55);
    shipGroup.add(shipBeacon);

    // Cargo container stacks (spread across forward and aft deck)
    const contColors = [0x0891b2, 0xea580c, 0xfacc15, 0xd97706, 0xe11d48, 0x15803d];
    for (let row = -1; row <= 4; row++) {
      if (row === -1) continue; // leave space before bridge
      for (let col = -1; col <= 1; col++) {
        const stackHeight = ((row + col + 5) % 3) + 1; // 1 to 3 tiers
        for (let s = 0; s < stackHeight; s++) {
          const stackBox = new THREE.Mesh(
            new THREE.BoxGeometry(7.5, 5.5, 18),
            new THREE.MeshLambertMaterial({
              color: contColors[(row * 3 + col + s + 7) % contColors.length],
            })
          );
          stackBox.position.set(col * 8.0, 7.2 + s * 5.5, row * 20 - 10);
          stackBox.castShadow = true;
          shipGroup.add(stackBox);
        }
      }
    }
    shipGroup.position.set(-80, 0.2, 35);
    scene.add(shipGroup);

    // Lighthouse
    const lightGroup = new THREE.Group();
    const lhTower = new THREE.Mesh(
      new THREE.CylinderGeometry(4.0, 6.5, 48, 16),
      new THREE.MeshLambertMaterial({ color: 0xffffff })
    );
    lhTower.position.y = 24;
    lhTower.castShadow = true;

    const lhBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(3.0, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    lhBeacon.position.y = 50;

    const lhGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xfef08a,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    lhGlow.scale.set(32, 32, 1);
    lhGlow.position.y = 50;

    lightGroup.add(lhTower, lhBeacon, lhGlow);
    lightGroup.position.set(860, 0, 80);
    scene.add(lightGroup);

    // Horizon Tower
    const towerGroup = new THREE.Group();
    const towerMat = new THREE.MeshLambertMaterial({
      color: 0x0284c7,
    });
    const tower = new THREE.Mesh(new THREE.BoxGeometry(36, 125, 36), towerMat);
    tower.position.y = 62.5;
    tower.castShadow = true;

    const spire = new THREE.Mesh(
      new THREE.ConeGeometry(1.6, 28, 8),
      new THREE.MeshBasicMaterial({ color: 0xf8fafc })
    );
    spire.position.y = 139;

    const towerGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0x38bdf8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    towerGlow.scale.set(24, 24, 1);
    towerGlow.position.y = 145;

    towerGroup.add(tower, spire, towerGlow);
    towerGroup.position.set(560, 0, 520);
    scene.add(towerGroup);
  }

  function buildProps(props) {
    const palmTrunkMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
    const palmFrondMat = new THREE.MeshLambertMaterial({ color: 0x15803d });
    const lightPoleMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
    const lightBulbMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    for (let i = 0; i < props.length; i++) {
      const p = props[i];

      if (p.type === 'palm') {
        const palmGroup = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 8.0, 7), palmTrunkMat);
        trunk.position.y = 4.0;
        trunk.castShadow = true;

        // Palm fronds - lush tropical canopy casting readable shadows
        const crown = new THREE.Group();
        for (let f = 0; f < 6; f++) {
          const frond = new THREE.Mesh(new THREE.ConeGeometry(2.3, 1.4, 5), palmFrondMat);
          frond.rotation.z = 0.55;
          frond.rotation.y = (f * Math.PI) / 3;
          frond.position.y = 8.0;
          frond.castShadow = true;
          crown.add(frond);
        }
        palmGroup.add(trunk, crown);
        palmGroup.position.set(p.x, 0, p.z);
        scene.add(palmGroup);
      } else if (p.type === 'streetlight') {
        const poleGroup = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 7.5, 6), lightPoleMat);
        pole.position.y = 3.75;
        pole.castShadow = true;

        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.12), lightPoleMat);
        arm.position.set(0.7, 7.4, 0);

        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), lightBulbMat);
        bulb.position.set(1.4, 7.3, 0);

        const lampGlow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowTex,
            color: 0xfde047,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        lampGlow.scale.set(4.5, 4.5, 1);
        lampGlow.position.set(1.4, 7.3, 0);

        poleGroup.add(pole, arm, bulb, lampGlow);
        poleGroup.position.set(p.x, 0, p.z);
        scene.add(poleGroup);
      } else if (p.type === 'container') {
        const cGroup = new THREE.Group();
        const cMat = new THREE.MeshLambertMaterial({
          color: new THREE.Color(p.color),
        });
        for (let s = 0; s < p.stack; s++) {
          const cBox = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 6.5), cMat);
          cBox.position.set(0, 1.3 + s * 2.6, 0);
          cBox.castShadow = true;
          cGroup.add(cBox);
        }
        cGroup.position.set(p.x, 0, p.z);
        cGroup.rotation.y = p.angle || 0;
        scene.add(cGroup);
      }
    }
  }

  function buildTokens(tokens) {
    const tokenMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const geom = new THREE.CylinderGeometry(0.75, 0.75, 0.18, 14);
    geom.rotateX(Math.PI / 2);

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const mesh = new THREE.Mesh(geom, tokenMat);
      mesh.position.set(t.x, t.y, t.z);

      const tGlow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex,
          color: 0xfacc15,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      tGlow.scale.set(3, 3, 1);
      mesh.add(tGlow);

      scene.add(mesh);
      tokenMeshes.push({ mesh, token: t });
    }
  }

  const rendererObj = {
    scene,
    camera,
    renderer,
    sunLight, // Expose sunLight for custom shot raking angle
    lockSun: false,
    buildCityMeshes,
    updateVisuals: null,
    render,
  };

  function updateVisuals(dt, waypoint, playerX, playerZ) {
    for (let i = 0; i < tokenMeshes.length; i++) {
      const item = tokenMeshes[i];
      if (item.token.collected) {
        item.mesh.visible = false;
      } else {
        item.mesh.rotation.y += 2.8 * dt;
        item.mesh.position.y = 1.2 + Math.sin(Date.now() * 0.004 + i) * 0.2;
      }
    }

    if (waypoint) {
      beaconGroup.visible = true;
      beaconGroup.position.set(waypoint.x, 0, waypoint.z);
      beaconMarker.rotation.y += 3.0 * dt;
    } else {
      beaconGroup.visible = false;
    }

    // Default dynamic sun tracking (unless locked by screenshot staging)
    if (!rendererObj.lockSun) {
      sunLight.position.set(playerX + 80, 55, playerZ + 70);
      sunLight.target.position.set(playerX, 0, playerZ);
      sunLight.target.updateMatrixWorld(true);
      sunLight.shadow.camera.updateProjectionMatrix();
    }
  }

  rendererObj.updateVisuals = updateVisuals;

  function render(dt) {
    renderer.render(scene, camera);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  window.addEventListener('resize', onResize);

  return rendererObj;
}
