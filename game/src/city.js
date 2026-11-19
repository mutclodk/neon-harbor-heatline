// City layout generator: deterministic road graph, building lots, districts, landmarks, and prop placements.
import { CITY_GRID, DISTRICTS, VEHICLE_CLASSES } from './config.js';
import { createRandom } from './random.js';

export function getDistrictAt(x, z) {
  const col = Math.floor(x / CITY_GRID.pitch);
  const row = Math.floor(z / CITY_GRID.pitch);

  for (let i = 0; i < DISTRICTS.length; i++) {
    const d = DISTRICTS[i];
    if (col >= d.colStart && col <= d.colEnd && row >= d.rowStart && row <= d.rowEnd) {
      return d;
    }
  }
  return DISTRICTS[0]; // fallback
}

export function generateCity(seed = 20261124) {
  const rng = createRandom(seed);
  const cityRng = rng.fork(44021);

  const buildings = [];
  const roadNodes = [];
  const roadEdges = [];
  const parkedCars = [];
  const props = [];
  const tokens = [];

  const { cols, rows, blockSize, streetWidth, pitch } = CITY_GRID;

  // 1. Build road network graph
  // Nodes at every intersection
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const x = c * pitch;
      const z = r * pitch;
      const id = r * (cols + 1) + c;
      const district = getDistrictAt(x, z);
      roadNodes.push({ id, c, r, x, z, district: district.id });
    }
  }

  // Edges between adjacent intersection nodes (Manhattan grid)
  let edgeId = 0;
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const fromId = r * (cols + 1) + c;
      const fromNode = roadNodes[fromId];

      // Horizontal edge (East)
      if (c < cols) {
        const toId = r * (cols + 1) + (c + 1);
        const toNode = roadNodes[toId];
        roadEdges.push({
          id: edgeId++,
          from: fromId,
          to: toId,
          x1: fromNode.x,
          z1: fromNode.z,
          x2: toNode.x,
          z2: toNode.z,
          length: pitch,
          dirX: 1,
          dirZ: 0,
        });
        // West return edge
        roadEdges.push({
          id: edgeId++,
          from: toId,
          to: fromId,
          x1: toNode.x,
          z1: toNode.z,
          x2: fromNode.x,
          z2: fromNode.z,
          length: pitch,
          dirX: -1,
          dirZ: 0,
        });
      }

      // Vertical edge (South)
      if (r < rows) {
        const toId = (r + 1) * (cols + 1) + c;
        const toNode = roadNodes[toId];
        roadEdges.push({
          id: edgeId++,
          from: fromId,
          to: toId,
          x1: fromNode.x,
          z1: fromNode.z,
          x2: toNode.x,
          z2: toNode.z,
          length: pitch,
          dirX: 0,
          dirZ: 1,
        });
        // North return edge
        roadEdges.push({
          id: edgeId++,
          from: toId,
          to: fromId,
          x1: toNode.x,
          z1: toNode.z,
          x2: fromNode.x,
          z2: fromNode.z,
          length: pitch,
          dirX: 0,
          dirZ: -1,
        });
      }
    }
  }

  // 2. Generate buildings for each block
  let buildingId = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const blockX = c * pitch + streetWidth / 2;
      const blockZ = r * pitch + streetWidth / 2;
      const district = getDistrictAt(blockX + blockSize / 2, blockZ + blockSize / 2);

      // Split block into 2x2 lots or single large lot
      const subDivide = district.id === 'centro' || district.id === 'marina' ? cityRng.next() > 0.35 : cityRng.next() > 0.6;

      if (!subDivide) {
        // Single prominent building occupying the lot
        const margin = 4;
        const width = blockSize - margin * 2;
        const depth = blockSize - margin * 2;
        const x = blockX + margin;
        const z = blockZ + margin;
        const height = cityRng.float(district.minHeight, district.maxHeight);

        buildings.push({
          id: buildingId++,
          x: x + width / 2,
          z: z + depth / 2,
          minX: x,
          maxX: x + width,
          minZ: z,
          maxZ: z + depth,
          width,
          depth,
          height,
          district: district.id,
          hasNeonSign: district.id === 'marina' || (district.id === 'centro' && cityRng.next() > 0.4),
          neonColor: cityRng.choice(['#f43f5e', '#06b6d4', '#eab308', '#a855f7']),
        });
      } else {
        // 2x2 smaller lots
        const half = blockSize / 2;
        const margin = 3;
        for (let dr = 0; dr < 2; dr++) {
          for (let dc = 0; dc < 2; dc++) {
            const bx = blockX + dc * half + margin;
            const bz = blockZ + dr * half + margin;
            const width = half - margin * 2;
            const depth = half - margin * 2;
            const height = cityRng.float(district.minHeight, district.maxHeight * 0.85);

            buildings.push({
              id: buildingId++,
              x: bx + width / 2,
              z: bz + depth / 2,
              minX: bx,
              maxX: bx + width,
              minZ: bz,
              maxZ: bz + depth,
              width,
              depth,
              height,
              district: district.id,
              hasNeonSign: district.id === 'marina' && cityRng.next() > 0.5,
              neonColor: cityRng.choice(['#f43f5e', '#06b6d4', '#eab308', '#22c55e']),
            });
          }
        }
      }

      // Add parked cars along the block curbs
      if (cityRng.next() > 0.25) {
        const curbSide = cityRng.choice(['N', 'S', 'E', 'W']);
        let px = 0;
        let pz = 0;
        let angle = 0;
        const curbOffset = 4.2;

        if (curbSide === 'N') {
          px = blockX + cityRng.float(15, blockSize - 15);
          pz = blockZ - curbOffset;
          angle = 0;
        } else if (curbSide === 'S') {
          px = blockX + cityRng.float(15, blockSize - 15);
          pz = blockZ + blockSize + curbOffset;
          angle = Math.PI;
        } else if (curbSide === 'E') {
          px = blockX + blockSize + curbOffset;
          pz = blockZ + cityRng.float(15, blockSize - 15);
          angle = Math.PI / 2;
        } else {
          px = blockX - curbOffset;
          pz = blockZ + cityRng.float(15, blockSize - 15);
          angle = -Math.PI / 2;
        }

        // Pick vehicle class according to district
        let vClass = 'sedan';
        if (district.id === 'marina') {
          vClass = cityRng.choice(['sports', 'sedan', 'muscle']);
        } else if (district.id === 'harbor') {
          vClass = cityRng.choice(['truck', 'hatch', 'sedan']);
        } else if (district.id === 'centro') {
          vClass = cityRng.choice(['sedan', 'sports', 'muscle']);
        } else if (district.id === 'flats') {
          vClass = cityRng.choice(['truck', 'muscle', 'hatch']);
        } else {
          vClass = cityRng.choice(['hatch', 'sedan']);
        }

        parkedCars.push({
          x: px,
          z: pz,
          angle,
          vehicleClass: vClass,
        });
      }

      // Add props (streetlights, palm trees, containers)
      // Streetlights at block edges
      props.push({ type: 'streetlight', x: blockX - 2, z: blockZ - 2 });
      props.push({ type: 'streetlight', x: blockX + blockSize + 2, z: blockZ - 2 });
      props.push({ type: 'streetlight', x: blockX - 2, z: blockZ + blockSize + 2 });
      props.push({ type: 'streetlight', x: blockX + blockSize + 2, z: blockZ + blockSize + 2 });

      // District specific props
      if (district.id === 'marina' || (district.id === 'harbor' && r === 1)) {
        // Glowing streetlamps on both sides of the boulevard
        for (let lOffset of [20, 50]) {
          props.push({ type: 'streetlight', x: blockX + lOffset, z: blockZ - 2 });
          props.push({ type: 'streetlight', x: blockX + lOffset, z: blockZ + blockSize + 2 });
        }
        // Lush palm rows along the boulevard sidewalks right to the corners
        for (let offset of [3, 20, 40, 60, 77]) {
          props.push({ type: 'palm', x: blockX + offset, z: blockZ - 2.5 });
          props.push({ type: 'palm', x: blockX + offset, z: blockZ + blockSize + 2.5 });
        }
      }

      // Coastal avenue palm trees along both sidewalks (c = 0)
      if (c === 0 && (district.id === 'harbor' || district.id === 'marina')) {
        // Promenade palms along the harbour quayside edge
        for (let zOffset of [14, 38, 62, 86]) {
          props.push({ type: 'palm', x: -7.2, z: blockZ + zOffset });
        }
        // East sidewalk palms
        for (let zOffset of [18, 42, 66]) {
          props.push({ type: 'palm', x: blockX - 2.5, z: blockZ + zOffset });
        }
      }

      if (district.id === 'centro') {
        // Plaza palm trees at block frontages
        props.push({ type: 'palm', x: blockX + blockSize / 2, z: blockZ - 2.5 });
        props.push({ type: 'palm', x: blockX + blockSize / 2, z: blockZ + blockSize + 2.5 });
      } else if (district.id === 'harbor') {
        // Cargo containers
        if (cityRng.next() > 0.3) {
          props.push({
            type: 'container',
            x: blockX + cityRng.float(10, blockSize - 10),
            z: blockZ + cityRng.float(10, blockSize - 10),
            color: cityRng.choice(['#0891b2', '#ea580c', '#e11d48', '#facc15']),
            angle: cityRng.choice([0, Math.PI / 2]),
            stack: cityRng.choice([1, 2, 3]),
          });
        }
      }
    }
  }

  // 3. Generate 20 Sol Token collectible locations across the 5 districts
  const tokenDistricts = ['harbor', 'marina', 'centro', 'alto', 'flats'];
  for (let i = 0; i < 20; i++) {
    const targetDistrictId = tokenDistricts[i % tokenDistricts.length];
    const targetDistrict = DISTRICTS.find((d) => d.id === targetDistrictId);
    const col = cityRng.int(targetDistrict.colStart, targetDistrict.colEnd);
    const row = cityRng.int(targetDistrict.rowStart, targetDistrict.rowEnd);

    const bx = col * pitch + streetWidth / 2;
    const bz = row * pitch + streetWidth / 2;
    tokens.push({
      id: i + 1,
      x: bx + cityRng.float(8, blockSize - 8),
      z: bz + cityRng.float(8, blockSize - 8),
      y: 1.2,
      collected: false,
    });
  }

  return {
    roadNodes,
    roadEdges,
    buildings,
    parkedCars,
    props,
    tokens,
    districts: DISTRICTS,
  };
}
