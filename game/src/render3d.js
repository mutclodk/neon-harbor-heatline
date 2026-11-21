import * as THREE from '../vendor/three.module.min.js';

// Deterministic pseudo-random helper keyed by numeric seed
function pseudoRandom(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Canvas-generated sky background texture
function createSkyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#10283c'); // deep teal-blue zenith
  grad.addColorStop(0.4, '#243b55');
  grad.addColorStop(0.7, '#d66d75'); // soft pink
  grad.addColorStop(0.9, '#f37335'); // warm orange
  grad.addColorStop(1.0, '#fdc830'); // horizon golden glow
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// Canvas-generated ground texture painted from city data
function createGroundTexture(city, config) {
  const gw = city.gridWidth || 1142;
  const gd = city.gridDepth || 954;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Base terrain fill
  ctx.fillStyle = '#25292c';
  ctx.fillRect(0, 0, 1024, 1024);

  const sx = 1024 / gw;
  const sz = 1024 / gd;

  // Blocks with district ground tints
  const blocks = city.blocks || [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const bnd = b.bounds || { xMin: b.x - b.width / 2, xMax: b.x + b.width / 2, zMin: b.z - b.depth / 2, zMax: b.z + b.depth / 2 };
    const distIdx = b.districtIndex || 0;
    const distCfg = (config.districts && config.districts[distIdx]) || {};
    const tint = distCfg.groundTint ? '#' + distCfg.groundTint.toString(16).padStart(6, '0') : '#33383d';

    ctx.fillStyle = tint;
    ctx.fillRect(bnd.xMin * sx, bnd.zMin * sz, (bnd.xMax - bnd.xMin) * sx, (bnd.zMax - bnd.zMin) * sz);

    // Sidewalk border
    ctx.strokeStyle = '#5a6168';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(bnd.xMin * sx, bnd.zMin * sz, (bnd.xMax - bnd.xMin) * sx, (bnd.zMax - bnd.zMin) * sz);
  }

  // Roads
  const roads = city.roads || city.roadSegments || [];
  const roadWidth = (config.city && config.city.roadWidth) || 14;
  ctx.lineCap = 'butt';

  // Road asphalt base
  ctx.strokeStyle = '#181b1e';
  ctx.lineWidth = roadWidth * sx;
  for (let i = 0; i < roads.length; i++) {
    const r = roads[i];
    ctx.beginPath();
    ctx.moveTo(r.p1.x * sx, r.p1.z * sz);
    ctx.lineTo(r.p2.x * sx, r.p2.z * sz);
    ctx.stroke();
  }

  // Pale lane dashed markings
  ctx.strokeStyle = '#c8c2a8';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 6]);
  for (let i = 0; i < roads.length; i++) {
    const r = roads[i];
    ctx.beginPath();
    ctx.moveTo(r.p1.x * sx, r.p1.z * sz);
    ctx.lineTo(r.p2.x * sx, r.p2.z * sz);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

// Canvas-generated building facade texture
function createFacadeTexture(districtIdx, baseHex, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const baseCol = '#' + baseHex.toString(16).padStart(6, '0');
  ctx.fillStyle = baseCol;
  ctx.fillRect(0, 0, 128, 256);

  // Vertical structural piers
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let x = 0; x < 128; x += 16) {
    ctx.fillRect(x, 0, 2, 256);
  }

  // Windows grid
  const cols = 6;
  const rows = 14;
  const padX = 4;
  const padY = 5;
  const winW = (128 - padX * (cols + 1)) / cols;
  const winH = (256 - padY * (rows + 1)) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = padX + c * (winW + padX);
      const wy = padY + r * (winH + padY);
      const winVal = pseudoRandom(seed * 31 + r * 13 + c * 7);

      if (winVal > 0.65) {
        // Lit warm window
        const warmRoll = pseudoRandom(seed + r * 3 + c);
        ctx.fillStyle = warmRoll > 0.5 ? '#ffe699' : '#ffb366';
        ctx.fillRect(wx, wy, winW, winH);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(wx + 1, wy + 1, winW - 2, winH / 2);
      } else {
        // Dark unlit glass
        ctx.fillStyle = districtIdx === 2 ? '#162b3d' : '#14181c';
        ctx.fillRect(wx, wy, winW, winH);
        // Reflection sheen
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(wx, wy, winW / 2, winH);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Canvas-generated neon sign text texture
function createNeonTexture(text, colorHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0a0d12';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = '#222830';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 60);

  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Glow halo
  ctx.shadowColor = colorHex;
  ctx.shadowBlur = 12;
  ctx.fillStyle = colorHex;
  ctx.fillText(text.toUpperCase(), 128, 32);
  ctx.fillText(text.toUpperCase(), 128, 32);

  // Crisp bright inner core
  ctx.shadowBlur = 2;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text.toUpperCase(), 128, 32);

  return new THREE.CanvasTexture(canvas);
}

// Additive glow sprite texture
function createGlowTexture(colorHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0.0, colorHex);
  grad.addColorStop(0.4, colorHex);
  grad.addColorStop(1.0, 'rgba(0,0,0,0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

// Additive smoke sprite texture
function createSmokeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0.0, 'rgba(30,30,35,0.85)');
  grad.addColorStop(0.5, 'rgba(50,50,55,0.4)');
  grad.addColorStop(1.0, 'rgba(20,20,25,0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

// Shared geometries and materials for static scene & furniture
function buildStaticScene(scene, city, config) {
  const gw = city.gridWidth || 1142;
  const gd = city.gridDepth || 954;
  const cx = gw / 2;
  const cz = gd / 2;

  // Sky Backdrop Sphere / Cylinder
  const skyGeo = new THREE.CylinderGeometry(1500, 1500, 1000, 32, 1, true);
  const skyMat = new THREE.MeshBasicMaterial({
    map: createSkyTexture(),
    side: THREE.BackSide,
    depthWrite: false
  });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.position.set(cx, 350, cz);
  scene.add(skyMesh);

  // Water plane
  const waterGeo = new THREE.PlaneGeometry(3500, 3500);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x0a3344,
    roughness: 0.15,
    metalness: 0.65
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(cx, -0.4, cz);
  waterMesh.receiveShadow = true;
  scene.add(waterMesh);

  // Additive sun-glint strip on water aligned south-west
  const glintGeo = new THREE.PlaneGeometry(160, 2400);
  const glintMat = new THREE.MeshBasicMaterial({
    color: 0xffaa44,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const glintMesh = new THREE.Mesh(glintGeo, glintMat);
  glintMesh.rotation.x = -Math.PI / 2;
  glintMesh.rotation.z = Math.PI / 4; // SW to NE sun angle
  glintMesh.position.set(cx - 200, -0.35, cz - 200);
  scene.add(glintMesh);

  // Ground Plane
  const groundGeo = new THREE.PlaneGeometry(gw, gd);
  const groundTex = createGroundTexture(city, config);
  const groundMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    roughness: 0.85,
    metalness: 0.1
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set(cx, 0, cz);
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // Lighting
  // Golden hour low directional sun over water south-west
  const sunLight = new THREE.DirectionalLight(0xffb070, 2.2);
  sunLight.position.set(-350, 220, -350);
  sunLight.target.position.set(cx, 0, cz);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 50;
  sunLight.shadow.camera.far = 1600;
  const d = 550;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Warm hemisphere fill
  const hemiLight = new THREE.HemisphereLight(0xffcaa0, 0x182838, 1.1);
  scene.add(hemiLight);

  // Gentle warm fog
  scene.fog = new THREE.FogExp2(0xf89b65, 0.00075);

  // Glow Sprite Material Cache
  const lampGlowTex = createGlowTexture('rgba(255, 220, 140, 1)');
  const lampGlowMat = new THREE.SpriteMaterial({
    map: lampGlowTex,
    color: 0xffeedd,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  // Buildings
  const buildings = city.buildings || [];
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x1e2226, roughness: 0.9 });
  const facadeMaterials = {};

  const neonWords = config.neonSignWords || ['harbour', 'marina', 'hotel', 'diner', 'casino', 'solano', 'neon', 'palms', 'motel', 'bar'];
  const neonColors = ['#ff2a85', '#00f0ff', '#ff8800', '#ffd700'];

  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const bx = b.x ?? b.position?.x ?? 0;
    const bz = b.z ?? b.position?.z ?? 0;
    const bw = b.width || 24;
    const bd = b.depth || 24;
    const bh = b.height || 18;
    const distIdx = b.districtIndex || 0;

    const distCfg = (config.districts && config.districts[distIdx]) || {};
    const colPalette = distCfg.facadeColours || [0x708090];
    const colHex = colPalette[i % colPalette.length];

    const matKey = `${distIdx}_${colHex}`;
    if (!facadeMaterials[matKey]) {
      const tex = createFacadeTexture(distIdx, colHex, i + 1);
      facadeMaterials[matKey] = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: distIdx === 2 ? 0.2 : 0.65,
        metalness: distIdx === 2 ? 0.6 : 0.15
      });
    }
    const fMat = facadeMaterials[matKey];

    const bGeo = new THREE.BoxGeometry(bw, bh, bd);
    const mats = [fMat, fMat, roofMat, roofMat, fMat, fMat];
    const bMesh = new THREE.Mesh(bGeo, mats);
    bMesh.position.set(bx, bh / 2, bz);
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    scene.add(bMesh);

    // Neon signs on Marina Strip (1) and Centro (2)
    if ((distIdx === 1 || distIdx === 2) && i % 4 === 0) {
      const word = neonWords[i % neonWords.length];
      const col = neonColors[i % neonColors.length];
      const neonTex = createNeonTexture(word, col);
      const signMat = new THREE.MeshBasicMaterial({ map: neonTex, transparent: true });

      const signGeo = new THREE.BoxGeometry(10, 3, 0.4);
      const signMesh = new THREE.Mesh(signGeo, signMat);

      const signY = Math.min(bh * 0.8, 24);
      signMesh.position.set(bx, signY, bz + bd / 2 + 0.3);
      scene.add(signMesh);

      // Sign soft glow sprite
      const signGlowTex = createGlowTexture(col);
      const signGlowMat = new THREE.SpriteMaterial({
        map: signGlowTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const sSprite = new THREE.Sprite(signGlowMat);
      sSprite.scale.set(18, 9, 1);
      sSprite.position.set(bx, signY, bz + bd / 2 + 0.5);
      scene.add(sSprite);
    }
  }

  // Harbour Pier, Gantry Cranes & Cargo Ship
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.8 });
  const pier = city.harbour?.pier || { x: gw * 0.25, z: -25, width: 36, depth: 70 };
  const pierMesh = new THREE.Mesh(new THREE.BoxGeometry(pier.width, 2.5, pier.depth), pierMat);
  pierMesh.position.set(pier.x, 1.0, pier.z);
  pierMesh.receiveShadow = true;
  pierMesh.castShadow = true;
  scene.add(pierMesh);

  // Two Gantry Cranes
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xe6a100, roughness: 0.4 });
  for (let c = 0; c < 2; c++) {
    const craneGroup = new THREE.Group();
    const cX = pier.x - 10 + c * 20;
    const cZ = pier.z - 15;

    // Legs
    const legGeo = new THREE.BoxGeometry(1.2, 28, 1.2);
    const leg1 = new THREE.Mesh(legGeo, craneMat);
    leg1.position.set(-6, 14, -8);
    const leg2 = new THREE.Mesh(legGeo, craneMat);
    leg2.position.set(6, 14, -8);
    const leg3 = new THREE.Mesh(legGeo, craneMat);
    leg3.position.set(-6, 14, 8);
    const leg4 = new THREE.Mesh(legGeo, craneMat);
    leg4.position.set(6, 14, 8);
    craneGroup.add(leg1, leg2, leg3, leg4);

    // Boom
    const boomGeo = new THREE.BoxGeometry(42, 2.2, 3.5);
    const boom = new THREE.Mesh(boomGeo, craneMat);
    boom.position.set(4, 28, 0);
    boom.castShadow = true;
    craneGroup.add(boom);

    // Cab
    const cabGeo = new THREE.BoxGeometry(4, 3.5, 4);
    const cabMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
    const cab = new THREE.Mesh(cabGeo, cabMat);
    cab.position.set(0, 25.5, 0);
    craneGroup.add(cab);

    craneGroup.position.set(cX, 0, cZ);
    scene.add(craneGroup);
  }

  // Cargo Ship at Berth
  const shipBerth = city.harbour?.shipBerth || { x: gw * 0.25 + 32, z: -45 };
  const shipGroup = new THREE.Group();
  // Hull
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x7a2222, roughness: 0.6 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(26, 9, 120), hullMat);
  hull.position.set(0, 3, 0);
  hull.castShadow = true;
  shipGroup.add(hull);

  // Deck
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x333b40, roughness: 0.7 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(24, 1.5, 116), deckMat);
  deck.position.set(0, 7.8, 0);
  shipGroup.add(deck);

  // Superstructure bridge
  const bridgeMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f5, roughness: 0.4 });
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(20, 14, 22), bridgeMat);
  bridge.position.set(0, 15, -40);
  bridge.castShadow = true;
  shipGroup.add(bridge);

  // Stacked containers on ship
  const containerPalette = config.containerColours || [0xbf360c, 0x006064, 0x1b5e20, 0xf57f17];
  const shipContGeo = new THREE.BoxGeometry(5.8, 4.8, 14);
  for (let row = 0; row < 3; row++) {
    for (let col = -1; col <= 1; col++) {
      for (let tier = 0; tier < 2; tier++) {
        const cMat = new THREE.MeshStandardMaterial({
          color: containerPalette[(row * 3 + col + tier + 5) % containerPalette.length],
          roughness: 0.5
        });
        const cMesh = new THREE.Mesh(shipContGeo, cMat);
        cMesh.position.set(col * 6.5, 10.5 + tier * 5, -15 + row * 16);
        cMesh.castShadow = true;
        shipGroup.add(cMesh);
      }
    }
  }
  shipGroup.position.set(shipBerth.x, 0, shipBerth.z);
  scene.add(shipGroup);

  // Props: Lamps, Palms, Crates, Containers
  const props = city.props || [];
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x444a50, metalness: 0.8, roughness: 0.3 });
  const headGeo = new THREE.BoxGeometry(0.6, 0.3, 0.8);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfffae0 });

  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.4, 7, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6e5138, roughness: 0.9 });
  const frondGeo = new THREE.ConeGeometry(3.2, 2.5, 5);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e6b35, roughness: 0.6 });

  const crateGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x9c7446, roughness: 0.8 });

  const yardContGeo = new THREE.BoxGeometry(3.2, 3.2, 7.5);

  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    const px = p.x ?? p.position?.x ?? 0;
    const pz = p.z ?? p.position?.z ?? 0;

    if (p.kind === 'lamp_post') {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(px, 3, pz);
      scene.add(pole);

      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(px, 6, pz);
      scene.add(head);

      const glow = new THREE.Sprite(lampGlowMat);
      glow.scale.set(6, 6, 1);
      glow.position.set(px, 6.2, pz);
      scene.add(glow);
    } else if (p.kind === 'palm_tree') {
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(px, 3.5, pz);
      trunk.rotation.z = (pseudoRandom(i) - 0.5) * 0.15;
      trunk.castShadow = true;
      scene.add(trunk);

      const crown = new THREE.Mesh(frondGeo, frondMat);
      crown.position.set(px, 7.5, pz);
      crown.castShadow = true;
      scene.add(crown);
    } else if (p.kind === 'crate') {
      const crate = new THREE.Mesh(crateGeo, crateMat);
      crate.position.set(px, 0.8, pz);
      crate.rotation.y = pseudoRandom(i) * Math.PI;
      crate.castShadow = true;
      scene.add(crate);
    } else if (p.kind === 'container') {
      const cCol = p.containerColour ?? containerPalette[i % containerPalette.length];
      const cMat = new THREE.MeshStandardMaterial({ color: cCol, roughness: 0.5 });
      const stackH = 1 + Math.floor(pseudoRandom(i * 17) * 2.5); // 1 to 3 containers high
      for (let s = 0; s < stackH; s++) {
        const cont = new THREE.Mesh(yardContGeo, cMat);
        cont.position.set(px, 1.6 + s * 3.2, pz);
        cont.rotation.y = (pseudoRandom(i + s) > 0.5 ? 0 : Math.PI / 2);
        cont.castShadow = true;
        scene.add(cont);
      }
    }
  }

  return { glintMesh };
}

// Dynamic Actor Pools: Vehicles & Pedestrians
function createActorPools(scene, config) {
  const smokeTex = createSmokeTexture();
  const smokeMat = new THREE.SpriteMaterial({
    map: smokeTex,
    transparent: true,
    opacity: 0.75,
    depthWrite: false
  });

  // Vehicle Light Cone Texture
  const coneCanvas = document.createElement('canvas');
  coneCanvas.width = 64;
  coneCanvas.height = 128;
  const coneCtx = coneCanvas.getContext('2d');
  const cGrad = coneCtx.createLinearGradient(32, 0, 32, 128);
  cGrad.addColorStop(0.0, 'rgba(255, 250, 220, 0.45)');
  cGrad.addColorStop(0.5, 'rgba(255, 230, 160, 0.15)');
  cGrad.addColorStop(1.0, 'rgba(255, 200, 120, 0.0)');
  coneCtx.fillStyle = cGrad;
  coneCtx.beginPath();
  coneCtx.moveTo(24, 0);
  coneCtx.lineTo(40, 0);
  coneCtx.lineTo(64, 128);
  coneCtx.lineTo(0, 128);
  coneCtx.closePath();
  coneCtx.fill();
  const coneTex = new THREE.CanvasTexture(coneCanvas);

  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfffae0 });
  const tailLightOffMat = new THREE.MeshBasicMaterial({ color: 0x440000 });
  const tailLightOnMat = new THREE.MeshBasicMaterial({ color: 0xff1100 });
  const policeRedMat = new THREE.MeshBasicMaterial({ color: 0xff0022 });
  const policeBlueMat = new THREE.MeshBasicMaterial({ color: 0x0044ff });
  const policeOffMat = new THREE.MeshBasicMaterial({ color: 0x111122 });

  // 1. Vehicle Pool
  const vehicleMeshes = [];
  const maxCars = 64;
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });

  for (let i = 0; i < maxCars; i++) {
    const group = new THREE.Group();

    // Body
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3388ff, metalness: 0.4, roughness: 0.3 });
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 4.2), bodyMat);
    bodyMesh.position.y = 0.55;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Cabin
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.2 });
    const cabinMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.2), cabinMat);
    cabinMesh.position.set(0, 1.15, -0.2);
    cabinMesh.castShadow = true;
    group.add(cabinMesh);

    // 4 Wheels
    const wFL = new THREE.Mesh(wheelGeo, wheelMat);
    wFL.position.set(-0.95, 0.38, 1.25);
    const wFR = new THREE.Mesh(wheelGeo, wheelMat);
    wFR.position.set(0.95, 0.38, 1.25);
    const wRL = new THREE.Mesh(wheelGeo, wheelMat);
    wRL.position.set(-0.95, 0.38, -1.25);
    const wRR = new THREE.Mesh(wheelGeo, wheelMat);
    wRR.position.set(0.95, 0.38, -1.25);
    group.add(wFL, wFR, wRL, wRR);

    // Headlights
    const hlGeo = new THREE.BoxGeometry(0.28, 0.16, 0.1);
    const hlL = new THREE.Mesh(hlGeo, headlightMat);
    hlL.position.set(-0.68, 0.6, 2.12);
    const hlR = new THREE.Mesh(hlGeo, headlightMat);
    hlR.position.set(0.68, 0.6, 2.12);
    group.add(hlL, hlR);

    // Headlight additive light beams
    const beamGeo = new THREE.PlaneGeometry(3.5, 12);
    beamGeo.rotateX(Math.PI / 2);
    const beamMat = new THREE.MeshBasicMaterial({
      map: coneTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const beamL = new THREE.Mesh(beamGeo, beamMat);
    beamL.position.set(-0.68, 0.5, 7.5);
    const beamR = new THREE.Mesh(beamGeo, beamMat);
    beamR.position.set(0.68, 0.5, 7.5);
    group.add(beamL, beamR);

    // Tail / Brake Lights
    const tlGeo = new THREE.BoxGeometry(0.32, 0.16, 0.1);
    const tlL = new THREE.Mesh(tlGeo, tailLightOffMat);
    tlL.position.set(-0.68, 0.6, -2.12);
    const tlR = new THREE.Mesh(tlGeo, tailLightOffMat);
    tlR.position.set(0.68, 0.6, -2.12);
    group.add(tlL, tlR);

    // Police lightbar
    const barGeo = new THREE.BoxGeometry(0.4, 0.15, 0.15);
    const barL = new THREE.Mesh(barGeo, policeOffMat);
    barL.position.set(-0.35, 1.5, -0.2);
    const barR = new THREE.Mesh(barGeo, policeOffMat);
    barR.position.set(0.35, 1.5, -0.2);
    barL.visible = false;
    barR.visible = false;
    group.add(barL, barR);

    // Wreck smoke sprite
    const smokeSprite = new THREE.Sprite(smokeMat);
    smokeSprite.scale.set(4, 4, 1);
    smokeSprite.position.set(0, 2.8, 0);
    smokeSprite.visible = false;
    group.add(smokeSprite);

    group.visible = false;
    scene.add(group);

    vehicleMeshes.push({
      group,
      bodyMat,
      cabinMat,
      wFL,
      wFR,
      wRL,
      wRR,
      tlL,
      tlR,
      barL,
      barR,
      smokeSprite
    });
  }

  // 2. Pedestrian Pool
  const pedMeshes = [];
  const maxPeds = 48;
  const shirtPalette = [0xffffff, 0x228be6, 0xfa5252, 0x40c057, 0xfd7e14, 0xbe4bdb, 0x15aabf];

  for (let i = 0; i < maxPeds; i++) {
    const group = new THREE.Group();

    // Torso / Shirt
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtPalette[i % shirtPalette.length], roughness: 0.6 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.3), shirtMat);
    torso.position.y = 1.15;
    torso.castShadow = true;
    group.add(torso);

    // Head
    const headMat = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.8 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), headMat);
    head.position.y = 1.68;
    group.add(head);

    // Legs
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x22262a, roughness: 0.7 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.22), pantsMat);
    legL.position.set(-0.16, 0.4, 0);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.22), pantsMat);
    legR.position.set(0.16, 0.4, 0);
    group.add(legL, legR);

    group.visible = false;
    scene.add(group);

    pedMeshes.push({
      group,
      shirtMat,
      torso,
      head,
      legL,
      legR
    });
  }

  return {
    vehicleMeshes,
    pedMeshes,
    tailLightOffMat,
    tailLightOnMat,
    policeRedMat,
    policeBlueMat,
    policeOffMat
  };
}

// Main 3D Renderer Factory
export function createRenderer(canvas, city, config = {}) {
  const scene = new THREE.Scene();

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window?.devicePixelRatio || 1, 1.5));
  renderer.setSize(canvas.clientWidth || 800, canvas.clientHeight || 600, false);

  const camera = new THREE.PerspectiveCamera(52, 1, 1, 2500);

  // Static world geometry
  const { glintMesh } = buildStaticScene(scene, city, config);

  // Dynamic actor pools
  const pools = createActorPools(scene, config);

  // Stored framing cameras
  const shotCameras = {};

  // Camera smoothing state
  const smoothCam = {
    pos: new THREE.Vector3(city.gridWidth / 2 || 500, 18, (city.gridDepth / 2 || 500) + 24),
    target: new THREE.Vector3(city.gridWidth / 2 || 500, 1.5, city.gridDepth / 2 || 500),
    initialized: false
  };

  const extraPaints = config.extraCarPaintColours || [0xd32f2f, 0x1976d2, 0x388e3c, 0xfbc02d];

  return {
    setShotCamera(name, position, lookAt) {
      if (!name) return;
      shotCameras[name] = {
        position: new THREE.Vector3(position.x ?? 0, position.y ?? 0, position.z ?? 0),
        lookAt: new THREE.Vector3(lookAt.x ?? 0, lookAt.y ?? 0, lookAt.z ?? 0)
      };
    },

    resize(width, height) {
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    },

    render(world, cameraDesc = {}, tick = 0) {
      const currentTick = world?.tick ?? tick ?? 0;

      // Subtle water glint shimmer keyed off tick
      if (glintMesh) {
        glintMesh.material.opacity = 0.28 + 0.1 * Math.sin(currentTick * 0.05);
      }

      // 1. Update Vehicles
      const vehicles = world?.vehicles || [];
      const numVehicles = Math.min(vehicles.length, pools.vehicleMeshes.length);

      for (let i = 0; i < pools.vehicleMeshes.length; i++) {
        const vm = pools.vehicleMeshes[i];
        if (i < numVehicles) {
          const v = vehicles[i];
          vm.group.visible = true;

          const vx = v.x ?? v.position?.x ?? 0;
          const vz = v.z ?? v.position?.z ?? 0;
          const vy = v.y ?? 0;
          const heading = v.heading ?? 0;
          const speed = v.speed ?? 0;
          const isBraking = !!v.braking;
          const health = v.health ?? 100;
          const kind = v.kind || 'traffic';
          const classIdx = v.vehicleClassIndex ?? v.classIndex ?? 0;

          vm.group.position.set(vx, vy, vz);
          vm.group.rotation.y = heading;

          // Paint color
          const vCfg = (config.vehicles && config.vehicles[classIdx]) || {};
          let carColor = vCfg.bodyColour || 0x3388ff;
          if (v.paintIndex !== undefined && v.paintIndex >= 0) {
            carColor = extraPaints[v.paintIndex % extraPaints.length];
          }
          vm.bodyMat.color.setHex(carColor);

          // Wheels rotation
          const wAngle = currentTick * speed * 0.18;
          vm.wFL.rotation.x = wAngle;
          vm.wFR.rotation.x = wAngle;
          vm.wRL.rotation.x = wAngle;
          vm.wRR.rotation.x = wAngle;

          // Brake lights
          vm.tlL.material = isBraking ? pools.tailLightOnMat : pools.tailLightOffMat;
          vm.tlR.material = isBraking ? pools.tailLightOnMat : pools.tailLightOffMat;

          // Police lightbar
          if (kind === 'police') {
            vm.barL.visible = true;
            vm.barR.visible = true;
            const flash = Math.floor(currentTick / 6) % 2 === 0;
            vm.barL.material = flash ? pools.policeRedMat : pools.policeBlueMat;
            vm.barR.material = flash ? pools.policeBlueMat : pools.policeRedMat;
          } else {
            vm.barL.visible = false;
            vm.barR.visible = false;
          }

          // Wreck smoke
          vm.smokeSprite.visible = health <= 25;
        } else {
          vm.group.visible = false;
        }
      }

      // 2. Update Pedestrians
      const peds = world?.pedestrians || [];
      const numPeds = Math.min(peds.length, pools.pedMeshes.length);

      for (let i = 0; i < pools.pedMeshes.length; i++) {
        const pm = pools.pedMeshes[i];
        if (i < numPeds) {
          const p = peds[i];
          pm.group.visible = true;

          const px = p.x ?? p.position?.x ?? 0;
          const pz = p.z ?? p.position?.z ?? 0;
          const heading = p.heading ?? 0;
          const speed = p.speed ?? 0;
          const state = p.state || 'walking';

          pm.group.position.set(px, 0, pz);
          pm.group.rotation.y = heading;

          if (state === 'down') {
            pm.group.rotation.x = -Math.PI / 2;
            pm.group.position.y = 0.25;
            pm.legL.rotation.x = 0;
            pm.legR.rotation.x = 0;
          } else {
            pm.group.rotation.x = 0;
            pm.group.position.y = 0;
            // Leg swing animation
            const legSwing = Math.sin(currentTick * 0.3 * Math.max(1, speed)) * 0.55;
            pm.legL.rotation.x = legSwing;
            pm.legR.rotation.x = -legSwing;
          }
        } else {
          pm.group.visible = false;
        }
      }

      // 3. Camera Framing
      const camMode = cameraDesc.mode || 'follow';

      if (camMode === 'shot') {
        const shotName = cameraDesc.shotName || cameraDesc.name;
        if (shotName && shotCameras[shotName]) {
          const s = shotCameras[shotName];
          camera.position.copy(s.position);
          camera.lookAt(s.lookAt);
        } else if (cameraDesc.position && cameraDesc.lookAt) {
          camera.position.set(cameraDesc.position.x, cameraDesc.position.y, cameraDesc.position.z);
          camera.lookAt(cameraDesc.lookAt.x, cameraDesc.lookAt.y, cameraDesc.lookAt.z);
        }
      } else {
        // Follow modes: on foot or driving
        const player = world?.player || {};
        const isDriving = player.mode === 'driving';

        const tgtX = cameraDesc.target?.x ?? player.x ?? 0;
        const tgtZ = cameraDesc.target?.z ?? player.z ?? 0;
        const heading = cameraDesc.heading ?? player.heading ?? 0;

        const dist = cameraDesc.distance ?? (isDriving ? 11.5 : 6.5);
        const height = cameraDesc.height ?? (isDriving ? 4.2 : 3.0);

        // Desired camera position behind player/car
        const desiredX = tgtX - Math.sin(heading) * dist;
        const desiredZ = tgtZ - Math.cos(heading) * dist;
        const desiredY = height;

        const targetPos = new THREE.Vector3(tgtX, 1.4, tgtZ);
        const desiredCamPos = new THREE.Vector3(desiredX, desiredY, desiredZ);

        if (!smoothCam.initialized) {
          smoothCam.pos.copy(desiredCamPos);
          smoothCam.target.copy(targetPos);
          smoothCam.initialized = true;
        } else {
          smoothCam.pos.lerp(desiredCamPos, 0.12);
          smoothCam.target.lerp(targetPos, 0.18);
        }

        camera.position.copy(smoothCam.pos);
        camera.lookAt(smoothCam.target);
      }

      renderer.render(scene, camera);
    }
  };
}
