/**
 * Game configuration tuneables for NEON HARBOR: HEATLINE.
 */

export const CONFIG = {
  // Default seed derived from deadline date 24 November 2026
  citySeed: 20261124,

  // City layout measurements (in metres where applicable)
  city: {
    blocksX: 12,
    blocksZ: 10,
    blockSize: 80,
    roadWidth: 14,
    sidewalkWidth: 3
  },

  // Simulation tuning parameters
  simulation: {
    fixedStep: 1 / 60,
    maxTrafficCars: 24,
    maxPoliceCars: 6,
    maxPedestrians: 20
  },

  // Player movement on foot
  playerOnFoot: {
    walkSpeed: 3.2,
    sprintSpeed: 6.0,
    stamina: 100
  },

  // Districts of Port Solano in specified order
  districts: [
    {
      name: 'Old Harbor',
      facadeColours: [0xc85a32, 0xd2691e, 0x008080, 0x20b2aa, 0x3b7a57],
      minBuildingHeight: 8,
      maxBuildingHeight: 18,
      groundTint: 0x3a3d40,
      trafficDensity: 0.6,
      landmark: 'Harbour Crane'
    },
    {
      name: 'Marina Strip',
      facadeColours: [0xffb6c1, 0xffa07a, 0x98ff98, 0x7fffd4, 0xe0ffff],
      minBuildingHeight: 18,
      maxBuildingHeight: 36,
      groundTint: 0x2d3538,
      trafficDensity: 1.0,
      landmark: 'Marina Lighthouse'
    },
    {
      name: 'Centro',
      facadeColours: [0x4682b4, 0x5f9ea0, 0x708090, 0x2f4f4f, 0x87ceeb],
      minBuildingHeight: 40,
      maxBuildingHeight: 110,
      groundTint: 0x22252a,
      trafficDensity: 1.2,
      landmark: 'Centro Tower'
    },
    {
      name: 'Barrio Alto',
      facadeColours: [0xe06d53, 0xcd5c5c, 0xf5f5f5, 0xfaebd7, 0xd2b48c],
      minBuildingHeight: 6,
      maxBuildingHeight: 16,
      groundTint: 0x423832,
      trafficDensity: 0.5,
      landmark: 'Alto Mirador'
    },
    {
      name: 'Industrial Flats',
      facadeColours: [0x555555, 0x696969, 0xe6b800, 0xcc9900, 0x444444],
      minBuildingHeight: 10,
      maxBuildingHeight: 22,
      groundTint: 0x2b2b2b,
      trafficDensity: 0.7,
      landmark: 'Flats Smokestacks'
    }
  ],

  // Vehicle classes in specified order
  vehicles: [
    {
      name: 'Sol Hatch',
      topSpeed: 32.0,
      acceleration: 14.0,
      grip: 0.85,
      health: 90,
      length: 3.8,
      width: 1.8,
      bodyColour: 0x3388ff,
      cabinColour: 0x111122
    },
    {
      name: 'Meridian 4D',
      topSpeed: 38.0,
      acceleration: 13.0,
      grip: 0.80,
      health: 110,
      length: 4.6,
      width: 1.9,
      bodyColour: 0x44aa77,
      cabinColour: 0x112211
    },
    {
      name: 'Vela GT',
      topSpeed: 48.0,
      acceleration: 20.0,
      grip: 0.95,
      health: 80,
      length: 4.4,
      width: 2.0,
      bodyColour: 0xff2244,
      cabinColour: 0x110000
    },
    {
      name: 'Barracuda-9',
      topSpeed: 44.0,
      acceleration: 18.0,
      grip: 0.72,
      health: 120,
      length: 4.8,
      width: 2.0,
      bodyColour: 0xff8800,
      cabinColour: 0x221100
    },
    {
      name: 'Dockmaster',
      topSpeed: 26.0,
      acceleration: 9.0,
      grip: 0.70,
      health: 180,
      length: 6.2,
      width: 2.4,
      bodyColour: 0x885533,
      cabinColour: 0x221100
    },
    {
      name: 'CPD Interceptor',
      topSpeed: 45.0,
      acceleration: 19.0,
      grip: 0.90,
      health: 140,
      length: 4.7,
      width: 1.9,
      bodyColour: 0x111111,
      cabinColour: 0x222233
    }
  ],

  // Palettes & Neon signs
  containerColours: [0xbf360c, 0x006064, 0x1b5e20, 0xf57f17, 0x311b92, 0x4e342e],
  extraCarPaintColours: [0xd32f2f, 0x1976d2, 0x388e3c, 0xfbc02d, 0x7b1fa2, 0x00796b, 0xe64a19, 0x455a64, 0x212121, 0xfafafa],
  neonSignWords: ['harbour', 'marina', 'hotel', 'diner', 'casino', 'solano', 'neon', 'palms', 'motel', 'bar'],

  // Wanted system tuning
  wanted: {
    heatMax: 500,
    heatPerStar: 100,
    decayRates: {
      onFoot: 5,
      inCar: 2,
      hidden: 15
    },
    offences: {
      stealCar: 40,
      hitAndRun: 35,
      knockPedestrian: 60,
      ramPolice: 80,
      propertyDamage: 8
    }
  }
};
