/**
 * Entrypoint script that packages the NEON HARBOR: HEATLINE browser game from the
 * game directory into the designated output location and generates dossier.json
 * for automated grading. To serve and play the game locally, run serve.ts instead.
 */

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const rootDir = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(outputDir, { recursive: true });

const gameSrc = join(rootDir, 'game');
const gameDst = join(outputDir, 'game');
cpSync(gameSrc, gameDst, { recursive: true });

const screenshotsSrc = join(rootDir, 'screenshots');
if (existsSync(screenshotsSrc)) {
  const screenshotsDst = join(outputDir, 'screenshots');
  cpSync(screenshotsSrc, screenshotsDst, { recursive: true });
}

const capsOptions = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const dossierContent = buildDossier(outputDir, capsOptions);
writeFileSync(join(outputDir, 'dossier.json'), dossierContent, 'utf-8');
