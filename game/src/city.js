import { CONFIG } from './config.js';
import { makeRng, deriveSeed } from './random.js';

/**
 * Calculates which district index (0-4) a world position (x, z) belongs to.
 * 0: Old Harbor (south waterfront)
 * 1: Marina Strip (west waterfront)
 * 2: Centro (middle)
 * 3: Barrio Alto (north-east)
 * 4: Industrial Flats (south-east)
 */
export function districtIndexAt(city, x, z) {
  const gridW = city.gridWidth || (city.width ? city.width - 2 * (city.waterMargin || 0) : 1142);
  const gridD = city.gridDepth || (city.depth ? city.depth - 2 * (city.waterMargin || 0) : 954);

  const u = Math.max(0, Math.min(1, x / gridW));
  const v = Math.max(0, Math.min(1, z / gridD));

  // South edge (v <= 0.22)
  if (v <= 0.22) {
    if (u >= 0.55) return 4; // Industrial Flats
    return 0; // Old Harbor
  }

  // West waterfront (u <= 0.22)
  if (u <= 0.22) return 1; // Marina Strip

  // North-East (u >= 0.5 && v >= 0.5)
  if (u >= 0.5 && v >= 0.5) return 3; // Barrio Alto

  // Industrial Flats extension (south-east lower block area)
  if (u >= 0.65 && v < 0.42) return 4; // Industrial Flats

  // Centro (middle)
  return 2;
}

/**
 * Helper to compute closest point on a line segment (ax, az) -> (bx, bz) to point (px, pz).
 */
function closestPointOnSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq === 0) return { x: ax, z: az, t: 0 };

  let t = ((px - ax) * dx + (pz - az) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));

  return {
    x: ax + t * dx,
    z: az + t * dz,
    t
  };
}

/**
 * Finds the nearest point on any road center line to (x, z) and returns its position and direction.
 */
export function nearestRoadPoint(city, x, z) {
  const roads = city.roads || city.roadSegments || [];
  let minDistSq = Infinity;
  let bestPoint = { x, z, direction: 'east-west', distance: 0 };

  for (let i = 0; i < roads.length; i++) {
    const r = roads[i];
    const pt = closestPointOnSegment(x, z, r.p1.x, r.p1.z, r.p2.x, r.p2.z);
    const distSq = (x - pt.x) * (x - pt.x) + (z - pt.z) * (z - pt.z);

    if (distSq < minDistSq) {
      minDistSq = distSq;
      bestPoint = {
        x: pt.x,
        z: pt.z,
        direction: r.direction,
        distance: Math.sqrt(distSq),
        segment: r
      };
    }
  }

  return bestPoint;
}

/**
 * Generates plain-data description of the whole city of Port Solano.
 */
export function generateCity(config = CONFIG, seed = config?.citySeed ?? 20261124) {
  const cfg = config.city || CONFIG.city;

  const blocksX = cfg.blocksX || 12;
  const blocksZ = cfg.blocksZ || 10;
  const blockSize = cfg.blockSize || 80;
  const roadWidth = cfg.roadWidth || 14;
  const sidewalkWidth = cfg.sidewalkWidth || 3;

  const waterMargin = 120;
  const gridWidth = blocksX * (blockSize + roadWidth) + roadWidth;
  const gridDepth = blocksZ * (blockSize + roadWidth) + roadWidth;
  const totalWidth = gridWidth + 2 * waterMargin;
  const totalDepth = gridDepth + 2 * waterMargin;

  // Derive independent seeded RNG streams
  const blockRng = makeRng(deriveSeed(seed, 100));
  const buildingRng = makeRng(deriveSeed(seed, 1));
  const propRng = makeRng(deriveSeed(seed, 2));
  const carRng = makeRng(deriveSeed(seed, 3));

  // Intersections
  const intersections = [];
  const intersectionGrid = [];

  for (let j = 0; j <= blocksZ; j++) {
    intersectionGrid[j] = [];
    const z = j * (blockSize + roadWidth) + roadWidth / 2;
    for (let i = 0; i <= blocksX; i++) {
      const x = i * (blockSize + roadWidth) + roadWidth / 2;
      const intersection = {
        id: `int_${i}_${j}`,
        gridX: i,
        gridZ: j,
        x,
        z
      };
      intersections.push(intersection);
      intersectionGrid[j][i] = intersection;
    }
  }

  // Road segments
  const roads = [];
  const laneOffset = roadWidth / 4; // 3.5m offset from centerline

  // Horizontal roads (East-West)
  for (let j = 0; j <= blocksZ; j++) {
    const z = j * (blockSize + roadWidth) + roadWidth / 2;
    for (let i = 0; i < blocksX; i++) {
      const x1 = i * (blockSize + roadWidth) + roadWidth / 2;
      const x2 = (i + 1) * (blockSize + roadWidth) + roadWidth / 2;

      roads.push({
        id: `road_ew_${i}_${j}`,
        p1: { x: x1, z },
        p2: { x: x2, z },
        direction: 'east-west',
        laneOffset,
        lanes: {
          forward: { offset: laneOffset, dir: { x: 1, z: 0 } },
          reverse: { offset: -laneOffset, dir: { x: -1, z: 0 } }
        }
      });
    }
  }

  // Vertical roads (North-South)
  for (let i = 0; i <= blocksX; i++) {
    const x = i * (blockSize + roadWidth) + roadWidth / 2;
    for (let j = 0; j < blocksZ; j++) {
      const z1 = j * (blockSize + roadWidth) + roadWidth / 2;
      const z2 = (j + 1) * (blockSize + roadWidth) + roadWidth / 2;

      roads.push({
        id: `road_ns_${i}_${j}`,
        p1: { x, z: z1 },
        p2: { x, z: z2 },
        direction: 'north-south',
        laneOffset,
        lanes: {
          forward: { offset: laneOffset, dir: { x: 0, z: 1 } },
          reverse: { offset: -laneOffset, dir: { x: 0, z: -1 } }
        }
      });
    }
  }

  // Helper for district lookup in generator context
  const dummyCityObj = { gridWidth, gridDepth, waterMargin, width: totalWidth, depth: totalDepth };
  const getDistrictIndex = (x, z) => districtIndexAt(dummyCityObj, x, z);

  // Blocks & Buildings
  const blocks = [];
  const buildings = [];
  const districtConfigs = config.districts || CONFIG.districts;

  for (let bz = 0; bz < blocksZ; bz++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const xMin = roadWidth + bx * (blockSize + roadWidth);
      const xMax = xMin + blockSize;
      const zMin = roadWidth + bz * (blockSize + roadWidth);
      const zMax = zMin + blockSize;

      const cx = xMin + blockSize / 2;
      const cz = zMin + blockSize / 2;

      const districtIndex = getDistrictIndex(cx, cz);
      const distCfg = districtConfigs[districtIndex] || districtConfigs[0];

      // Skip lots on a few randomly chosen blocks for open parking / lot areas
      const isOpenLot = blockRng.chance(0.12);

      const blockObj = {
        gridX: bx,
        gridZ: bz,
        bounds: { xMin, xMax, zMin, zMax },
        center: { x: cx, z: cz },
        districtIndex,
        isOpenLot
      };
      blocks.push(blockObj);

      if (isOpenLot) {
        continue;
      }

      // Generate 2 to 4 building lots
      const lotLayoutPattern = buildingRng.int(0, 3); // 0: 2 lots (H/V), 1: 3 lots, 2: 4 lots
      const lotMargin = sidewalkWidth + 1; // 4m margin from block road edge
      const usableSize = blockSize - 2 * lotMargin; // 72m usable

      let lotRects = [];

      if (lotLayoutPattern === 0) {
        // 2 lots
        if (buildingRng.chance(0.5)) {
          // 2 vertical split lots (side by side in X)
          const w = usableSize / 2 - 1;
          const d = usableSize;
          lotRects.push({
            cx: xMin + lotMargin + w / 2,
            cz: zMin + lotMargin + d / 2,
            w,
            d
          });
          lotRects.push({
            cx: xMin + lotMargin + w * 1.5 + 2,
            cz: zMin + lotMargin + d / 2,
            w,
            d
          });
        } else {
          // 2 horizontal split lots (top/bottom in Z)
          const w = usableSize;
          const d = usableSize / 2 - 1;
          lotRects.push({
            cx: xMin + lotMargin + w / 2,
            cz: zMin + lotMargin + d / 2,
            w,
            d
          });
          lotRects.push({
            cx: xMin + lotMargin + w / 2,
            cz: zMin + lotMargin + d * 1.5 + 2,
            w,
            d
          });
        }
      } else if (lotLayoutPattern === 1) {
        // 3 lots (1 large lot on one side, 2 smaller lots on the other side)
        const halfW = usableSize / 2 - 1;
        const halfD = usableSize / 2 - 1;
        lotRects.push({
          cx: xMin + lotMargin + halfW / 2,
          cz,
          w: halfW,
          d: usableSize
        });
        lotRects.push({
          cx: xMin + lotMargin + halfW * 1.5 + 2,
          cz: zMin + lotMargin + halfD / 2,
          w: halfW,
          d: halfD
        });
        lotRects.push({
          cx: xMin + lotMargin + halfW * 1.5 + 2,
          cz: zMin + lotMargin + halfD * 1.5 + 2,
          w: halfW,
          d: halfD
        });
      } else {
        // 4 lots (2x2 grid)
        const halfW = usableSize / 2 - 1;
        const halfD = usableSize / 2 - 1;
        lotRects.push({
          cx: xMin + lotMargin + halfW / 2,
          cz: zMin + lotMargin + halfD / 2,
          w: halfW,
          d: halfD
        });
        lotRects.push({
          cx: xMin + lotMargin + halfW * 1.5 + 2,
          cz: zMin + lotMargin + halfD / 2,
          w: halfW,
          d: halfD
        });
        lotRects.push({
          cx: xMin + lotMargin + halfW / 2,
          cz: zMin + lotMargin + halfD * 1.5 + 2,
          w: halfW,
          d: halfD
        });
        lotRects.push({
          cx: xMin + lotMargin + halfW * 1.5 + 2,
          cz: zMin + lotMargin + halfD * 1.5 + 2,
          w: halfW,
          d: halfD
        });
      }

      // Create building objects from lots
      for (let lotIdx = 0; lotIdx < lotRects.length; lotIdx++) {
        // Occasionally skip individual lot
        if (buildingRng.chance(0.1)) continue;

        const lot = lotRects[lotIdx];
        const height = buildingRng.range(
          distCfg.minBuildingHeight,
          distCfg.maxBuildingHeight
        );
        const palette = distCfg.facadeColours || [0x888888];
        const facadeColourIndex = buildingRng.int(0, palette.length);
        const facadeColour = palette[facadeColourIndex];

        buildings.push({
          x: lot.cx,
          z: lot.cz,
          width: lot.w,
          depth: lot.d,
          height: Math.round(height * 10) / 10,
          facadeColourIndex,
          facadeColour,
          districtIndex,
          districtName: distCfg.name
        });
      }
    }
  }

  // Props
  const props = [];

  // 1. Street lamps along roads
  for (let r = 0; r < roads.length; r++) {
    const road = roads[r];
    const lampSpacing = 28; // every 28m
    const lampOffset = roadWidth / 2 + 0.8; // sidewalk placement

    if (road.direction === 'east-west') {
      const len = road.p2.x - road.p1.x;
      const count = Math.floor(len / lampSpacing);
      const startX = road.p1.x + (len % lampSpacing) / 2 + lampSpacing / 2;

      for (let k = 0; k < count; k++) {
        const lx = startX + k * lampSpacing;
        // North side
        props.push({ kind: 'street_lamp', position: { x: lx, z: road.p1.z - lampOffset }, x: lx, z: road.p1.z - lampOffset });
        // South side
        props.push({ kind: 'street_lamp', position: { x: lx, z: road.p1.z + lampOffset }, x: lx, z: road.p1.z + lampOffset });
      }
    } else {
      const len = road.p2.z - road.p1.z;
      const count = Math.floor(len / lampSpacing);
      const startZ = road.p1.z + (len % lampSpacing) / 2 + lampSpacing / 2;

      for (let k = 0; k < count; k++) {
        const lz = startZ + k * lampSpacing;
        // West side
        props.push({ kind: 'street_lamp', position: { x: road.p1.x - lampOffset, z: lz }, x: road.p1.x - lampOffset, z: lz });
        // East side
        props.push({ kind: 'street_lamp', position: { x: road.p1.x + lampOffset, z: lz }, x: road.p1.x + lampOffset, z: lz });
      }
    }
  }

  // 2. Palm trees clustered in Marina Strip and waterfront
  for (let bz = 0; bz < blocksZ; bz++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const cx = roadWidth + bx * (blockSize + roadWidth) + blockSize / 2;
      const cz = roadWidth + bz * (blockSize + roadWidth) + blockSize / 2;
      const distIdx = getDistrictIndex(cx, cz);

      // Marina Strip or waterfront edge
      if (distIdx === 1 || bz === 0 || bx === 0) {
        const palmCount = propRng.int(3, 8);
        for (let p = 0; p < palmCount; p++) {
          const px = cx + propRng.range(-blockSize / 2 + 4, blockSize / 2 - 4);
          const pz = cz + propRng.range(-blockSize / 2 + 4, blockSize / 2 - 4);
          props.push({
            kind: 'palm_tree',
            position: { x: px, z: pz },
            x: px,
            z: pz
          });
        }
      }
    }
  }

  // 3. Crates and container stacks in Old Harbor and Industrial Flats
  const containerPalette = config.containerColours || CONFIG.containerColours;
  for (let b = 0; b < blocks.length; b++) {
    const blk = blocks[b];
    if (blk.districtIndex === 0 || blk.districtIndex === 4) {
      // Harbor or Industrial
      const numContainers = propRng.int(2, blk.isOpenLot ? 10 : 5);
      for (let c = 0; c < numContainers; c++) {
        const cx = propRng.range(blk.bounds.xMin + 6, blk.bounds.xMax - 6);
        const cz = propRng.range(blk.bounds.zMin + 6, blk.bounds.zMax - 6);
        const containerColourIndex = propRng.int(0, containerPalette.length);

        props.push({
          kind: propRng.chance(0.6) ? 'container' : 'crate',
          position: { x: cx, z: cz },
          x: cx,
          z: cz,
          containerColourIndex,
          containerColour: containerPalette[containerColourIndex]
        });
      }
    }
  }

  // Parked Cars along kerbs
  const parkedCars = [];
  const numVehicles = (config.vehicles || CONFIG.vehicles).length;

  for (let r = 0; r < roads.length; r++) {
    const road = roads[r];
    if (carRng.chance(0.65)) {
      const kerbOffset = roadWidth / 2 - 1.8; // offset to kerb lane
      const distIdx = getDistrictIndex((road.p1.x + road.p2.x) / 2, (road.p1.z + road.p2.z) / 2);

      // Determine vehicle class index bias by district
      let vehicleClassIndex = 0;
      const roll = carRng.next();
      if (distIdx === 1) {
        // Marina Strip: high chance of sports cars (Vela GT index 2, Barracuda-9 index 3)
        vehicleClassIndex = roll < 0.4 ? 2 : roll < 0.7 ? 3 : carRng.int(0, 2);
      } else if (distIdx === 0 || distIdx === 4) {
        // Harbor/Industrial: high chance of trucks (Dockmaster index 4) & sedans
        vehicleClassIndex = roll < 0.5 ? 4 : roll < 0.8 ? 1 : 0;
      } else {
        // Centro / Barrio Alto: ordinary cars (0, 1, 2)
        vehicleClassIndex = roll < 0.4 ? 0 : roll < 0.75 ? 1 : 2;
      }
      vehicleClassIndex = Math.min(vehicleClassIndex, numVehicles - 1);

      if (road.direction === 'east-west') {
        const carX = carRng.range(road.p1.x + 10, road.p2.x - 10);
        const side = carRng.chance(0.5) ? 1 : -1;
        const carZ = road.p1.z + side * kerbOffset;
        const heading = side === 1 ? 0 : Math.PI;

        parkedCars.push({
          position: { x: carX, z: carZ },
          x: carX,
          z: carZ,
          heading,
          vehicleClassIndex,
          districtIndex: distIdx
        });
      } else {
        const carZ = carRng.range(road.p1.z + 10, road.p2.z - 10);
        const side = carRng.chance(0.5) ? 1 : -1;
        const carX = road.p1.x + side * kerbOffset;
        const heading = side === 1 ? Math.PI / 2 : (3 * Math.PI) / 2;

        parkedCars.push({
          position: { x: carX, z: carZ },
          x: carX,
          z: carZ,
          heading,
          vehicleClassIndex,
          districtIndex: distIdx
        });
      }
    }
  }

  // Landmarks
  const landmarks = {
    harbourCraneYard: {
      name: 'Harbour Crane Yard',
      x: gridWidth * 0.25,
      z: gridDepth * 0.08,
      districtIndex: 0
    },
    marinaLighthousePoint: {
      name: 'Marina Lighthouse Point',
      x: gridWidth * 0.08,
      z: gridDepth * 0.6,
      districtIndex: 1
    },
    centroTowerPlaza: {
      name: 'Centro Tower Plaza',
      x: gridWidth * 0.48,
      z: gridDepth * 0.48,
      districtIndex: 2
    },
    altoMiradorLookout: {
      name: 'Alto Mirador Lookout',
      x: gridWidth * 0.8,
      z: gridDepth * 0.8,
      districtIndex: 3
    },
    flatsSmokestacks: {
      name: 'Flats Smokestacks',
      x: gridWidth * 0.8,
      z: gridDepth * 0.1,
      districtIndex: 4
    }
  };

  // Harbour area
  const harbour = {
    pier: {
      x: gridWidth * 0.25,
      z: -25,
      width: 36,
      depth: 70,
      minX: gridWidth * 0.25 - 18,
      maxX: gridWidth * 0.25 + 18,
      minZ: -60,
      maxZ: 10
    },
    shipBerth: {
      x: gridWidth * 0.25 + 32,
      z: -45
    },
    name: 'Old Harbor Pier'
  };

  return {
    width: totalWidth,
    depth: totalDepth,
    waterMargin,
    gridWidth,
    gridDepth,
    blocks,
    buildings,
    roads,
    roadSegments: roads,
    intersections,
    props,
    parkedCars,
    landmarks,
    harbour
  };
}
