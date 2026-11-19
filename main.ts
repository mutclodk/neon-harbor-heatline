// NEON HARBOR: HEATLINE — Official Entry for Bounty gta6-01 "Make GTA 6"
// A complete, original 3D open-world crime action game set in sun-soaked Port Solano.
// Built with procedural geometry, custom arcade vehicle physics, traffic AI, pedestrians,
// a 5-star wanted heat escalation system, 7 story jobs, combat, HUD with real-time minimap radar,
// procedural WebAudio sound synthesizer, and career results dossier.
//
// Standalone runner & grader entrypoint (Node 22, standard library only):
// Copies static game/ assets and screenshots/ to /output and compiles the canonical dossier.json.
// Local testing:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// 1. Prepare target directories
mkdirSync(outputDir, { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });

// 2. Transfer game assets and automated screenshot captures
cpSync(join(rootDir, 'game'), join(outputDir, 'game'), { recursive: true });
if (existsSync(join(rootDir, 'screenshots'))) {
  cpSync(join(rootDir, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// 3. Generate canonical dossier.json conforming to competition.yaml gate limits:
//    - Screenshots: exactly 4 JPEGs (each <= 256 KiB)
//    - Game files: max 993 files/dirs (<= 48 MiB total)
//    - Dossier text: max 160 KiB (163,840 bytes)
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
