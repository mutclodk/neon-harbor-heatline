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
  const sunGrad = ctx.createRadialGradient(256, 230, 8, 256, 230, 110);
  sunGrad.addColorStop(0, 'rgba(255, 255, 245, 1)');
  sunGrad.addColorStop(0.25, 'rgba(254, 240, 138, 0.85)');
  sunGrad.addColorStop(0.65, 'rgba(249, 115, 22, 0.4)');
  sunGrad.addColorStop(1.0, 'rgba(249, 115, 22, 0)');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(256, 230, 110, 0, Math.PI * 2);
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
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');

    // Base building facade
    ctx.fillStyle = type === 'centro' ? '#1e293b' : (type === 'marina' ? '#2d1b36' : '#262626');
    ctx.fillRect(0, 0, 256, 256);

    const cols = 8;
    const rows = 16;
    const padX = 6;
    const padY = 4;
    const w = (256 - padX * (cols + 1)) / cols;
    const h = (256 - padY * (rows + 1)) / rows;

    for (let r = 0; r < rows; r++) {
      for (let cl = 0; cl < cols; cl++) {
        const isLit = (Math.sin(r * 19.3 + cl * 7.7) > -0.2);
        const x = padX + cl * (w + padX);
        const y = padY + r * (h + padY);

        if (isLit) {
          if (type === 'centro') {
            ctx.fillStyle = (cl + r) % 3 === 0 ? '#38bdf8' : '#fef08a'; // cyan or warm gold
          } else if (type === 'marina') {
            ctx.fillStyle = (cl + r) % 2 === 0 ? '#f472b6' : '#fef08a'; // neon pink or yellow
          } else {
            ctx.fillStyle = '#fbbf24'; // warm amber
          }
          ctx.fillRect(x, y, w, h);
        } else {
          ctx.fillStyle = '#0f172a'; // dark glass
          ctx.fillRect(x, y, w, h);
        }
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  sharedWindowTextures = {
    centro: makeTex('centro'),
    marina: makeTex('marina'),
    harbor: makeTex('harbor'),
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
  renderer.toneMappingExposure = 1.35;

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.5,
    950
  );

  // Lighting: High-contrast sunset illumination so shadows are clearly defined
  const hemiLight = new THREE.HemisphereLight(0xffedd5, 0x8b5cf6, 0.85);
  scene.add(hemiLight);

  const ambientLight = new THREE.AmbientLight(0xfdba74, 0.55);
  scene.add(ambientLight);

  // Directional Sun with high shadow contrast
  const sunLight = new THREE.DirectionalLight(0xffedd5, 3.8);
  sunLight.position.set(220, 85, 240);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 400;
  sunLight.shadow.camera.left = -60;
  sunLight.shadow.camera.right = 60;
  sunLight.shadow.camera.top = 60;
  sunLight.shadow.camera.bottom = -60;
  sunLight.shadow.bias = -0.0006;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Ocean Plane surrounding Port Solano
  const oceanGeom = new THREE.PlaneGeometry(3600, 3600);
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x0891b2,
    roughness: 0.06,
    metalness: 0.88,
  });
  const oceanMesh = new THREE.Mesh(oceanGeom, oceanMat);
  oceanMesh.rotation.x = -Math.PI / 2;
  oceanMesh.position.set(CITY_GRID.totalWidth / 2, -0.4, CITY_GRID.totalHeight / 2);
  scene.add(oceanMesh);

  // Ground base beneath city
  const groundGeom = new THREE.PlaneGeometry(CITY_GRID.totalWidth + 180, CITY_GRID.totalHeight + 180);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.85,
    metalness: 0.15,
  });
  const groundMesh = new THREE.Mesh(groundGeom, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set(CITY_GRID.totalWidth / 2, 0, CITY_GRID.totalHeight / 2);
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

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

    // 1. Roads: warm slate grey asphalt receiving shadows
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x475569, // warm slate grey
      roughness: 0.65,
      metalness: 0.15,
    });
    const roadGroup = new THREE.Group();

    const yellowLineMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const whiteLineMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });

    // Vertical streets
    for (let c = 0; c <= cols; c++) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(streetWidth, totalHeight), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(c * pitch, 0.02, totalHeight / 2);
      road.receiveShadow = true;
      roadGroup.add(road);

      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.35, totalHeight), yellowLineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(c * pitch, 0.03, totalHeight / 2);
      roadGroup.add(line);
    }

    // Horizontal streets
    for (let r = 0; r <= rows; r++) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(totalWidth, streetWidth), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(totalWidth / 2, 0.02, r * pitch);
      road.receiveShadow = true;
      roadGroup.add(road);

      const line = new THREE.Mesh(new THREE.PlaneGeometry(totalWidth, 0.35), yellowLineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(totalWidth / 2, 0.03, r * pitch);
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

    // 2. Concrete Sidewalks around each block (raised curbs)
    const sidewalkMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8, // clean light concrete curb!
      roughness: 0.8,
      metalness: 0.1,
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

    // 3. Buildings with glowing procedural window textures
    const buildings = city.buildings;
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      const bGroup = new THREE.Group();

      const winTex = windowTextures[b.district] || windowTextures.harbor;
      const mat = new THREE.MeshStandardMaterial({
        map: winTex,
        roughness: b.district === 'centro' ? 0.3 : 0.6,
        metalness: b.district === 'centro' ? 0.8 : 0.25,
        emissiveMap: winTex,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.5,
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
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 })
      );
      cornice.position.set(b.x, b.height + 0.22 + 0.3, b.z);
      bGroup.add(cornice);

      // Rooftop AC units
      const acMesh = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 1.8, 3.2),
        new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.5 })
      );
      acMesh.position.set(b.x, b.height + 1.1, b.z);
      acMesh.castShadow = true;
      bGroup.add(acMesh);

      // Neon rooftop signs with additive bloom sprites
      if (b.hasNeonSign) {
        const signGroup = new THREE.Group();
        const signMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(b.neonColor) });
        const sign = new THREE.Mesh(new THREE.BoxGeometry(b.width * 0.65, 2.6, 0.5), signMat);
        sign.position.set(b.x, b.height + 2.2, b.z + b.depth / 2 - 0.4);

        const signGlow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowTex,
            color: new THREE.Color(b.neonColor),
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        signGlow.scale.set(b.width * 0.9, 8.0, 1);
        signGlow.position.set(b.x, b.height + 2.2, b.z + b.depth / 2 - 0.2);

        signGroup.add(sign, signGlow);
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
    for (let cpos of [{ x: 120, z: 120 }, { x: 70, z: 200 }]) {
      const craneGroup = new THREE.Group();
      const steelMat = new THREE.MeshStandardMaterial({ color: 0xea580c, metalness: 0.85, roughness: 0.25 });

      for (let dx of [-9, 9]) {
        for (let dz of [-7, 7]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 42, 1.4), steelMat);
          leg.position.set(dx, 21, dz);
          leg.castShadow = true;
          craneGroup.add(leg);
        }
      }
      const boom = new THREE.Mesh(new THREE.BoxGeometry(55, 3.8, 5.5), steelMat);
      boom.position.set(0, 42, 0);
      boom.castShadow = true;
      craneGroup.add(boom);

      const beaconSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex,
          color: 0xef4444,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      beaconSprite.scale.set(7, 7, 1);
      beaconSprite.position.set(0, 45, 0);
      craneGroup.add(beaconSprite);

      craneGroup.position.set(cpos.x, 0, cpos.z);
      scene.add(craneGroup);
    }

    // Ship moored at docks
    const shipGroup = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.7 });
    const hullGeom = new THREE.BoxGeometry(32, 14, 180);
    const hull = new THREE.Mesh(hullGeom, hullMat);
    hull.position.set(0, 3, 0);
    hull.castShadow = true;
    shipGroup.add(hull);

    const bridgeGeom = new THREE.BoxGeometry(26, 22, 28);
    const bridgeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
    const bridge = new THREE.Mesh(bridgeGeom, bridgeMat);
    bridge.position.set(0, 15, -60);
    bridge.castShadow = true;
    shipGroup.add(bridge);

    const contColors = [0x0891b2, 0xea580c, 0xfacc15, 0xd97706];
    for (let row = -1; row <= 2; row++) {
      for (let col = -1; col <= 1; col++) {
        const stackBox = new THREE.Mesh(
          new THREE.BoxGeometry(8, 9, 20),
          new THREE.MeshStandardMaterial({ color: contColors[(row + col + 4) % contColors.length] })
        );
        stackBox.position.set(col * 9, 13, row * 24 + 10);
        stackBox.castShadow = true;
        shipGroup.add(stackBox);
      }
    }
    shipGroup.position.set(-60, 0, 140);
    scene.add(shipGroup);

    // Lighthouse
    const lightGroup = new THREE.Group();
    const lhTower = new THREE.Mesh(
      new THREE.CylinderGeometry(4.0, 6.5, 48, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
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
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.95,
      roughness: 0.1,
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
    const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const palmFrondMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4 });
    const lightPoleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 });
    const lightBulbMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    for (let i = 0; i < props.length; i++) {
      const p = props[i];

      if (p.type === 'palm') {
        const palmGroup = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 8.0, 7), palmTrunkMat);
        trunk.position.y = 4.0;
        trunk.castShadow = true;

        // Palm fronds - reduced scale (~30% smaller) so canopies do not overwhelm the view
        const crown = new THREE.Group();
        for (let f = 0; f < 6; f++) {
          const frond = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.3, 5), palmFrondMat);
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
        lampGlow.scale.set(7.0, 7.0, 1);
        lampGlow.position.set(1.4, 7.3, 0);

        poleGroup.add(pole, arm, bulb, lampGlow);
        poleGroup.position.set(p.x, 0, p.z);
        scene.add(poleGroup);
      } else if (p.type === 'container') {
        const cGroup = new THREE.Group();
        const cMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(p.color),
          roughness: 0.55,
          metalness: 0.3,
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

    // Default dynamic sun tracking
    sunLight.position.set(playerX + 110, 85, playerZ + 120);
    sunLight.target.position.set(playerX, 0, playerZ);
    sunLight.target.updateMatrixWorld();
    sunLight.shadow.camera.updateProjectionMatrix();
  }

  function render(dt) {
    renderer.render(scene, camera);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  window.addEventListener('resize', onResize);

  return {
    scene,
    camera,
    renderer,
    sunLight, // Expose sunLight for custom shot raking angle
    buildCityMeshes,
    updateVisuals,
    render,
  };
}
