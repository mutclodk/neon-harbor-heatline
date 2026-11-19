// Automated screenshot capture script for NEON HARBOR: HEATLINE
// Loads the 4 required scenes (?shot=cover/onfoot/chase/mission) and saves JPEGs to screenshots/

let chromium;
try {
  chromium = require('playwright-core').chromium;
} catch {
  chromium = require('/home/hatch/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core').chromium;
}
const fs = require('node:fs');
const path = require('node:path');

const SHOTS = [
  { name: '1-cover.jpg', query: '?shot=cover&seed=20261124' },
  { name: '2-onfoot.jpg', query: '?shot=onfoot&seed=20261124' },
  { name: '3-chase.jpg', query: '?shot=chase&seed=20261124' },
  { name: '4-mission.jpg', query: '?shot=mission&seed=20261124' },
];

const CHROMIUM_PATH = process.env.CHROMIUM_PATH ||
  path.join(process.env.HOME, '.cache/ms-playwright/chromium-1255/chrome-linux64/chrome');

const requestedShots = process.argv.slice(2);
const filteredShots = requestedShots.length > 0
  ? SHOTS.filter((s) => requestedShots.some((r) => s.name.includes(r) || s.query.includes(r)))
  : SHOTS;

async function captureAll() {
  console.log('Launching headless Chromium from:', CHROMIUM_PATH);
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    args: [
      '--headless',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  });

  const screenshotsDir = path.resolve(__dirname, '../screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  for (const shot of filteredShots) {
    console.log(`\nCapturing ${shot.name} via ${shot.query}...`);
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
    });

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.error(`  [CONSOLE ERROR]:`, msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
      console.error(`  [PAGE ERROR]:`, err.message);
    });

    const url = `http://localhost:8080/${shot.query}`;
    await page.goto(url, { waitUntil: 'networkidle' });

    // Wait for the game's internal signal that scene is staged and frames are painted
    await page.waitForFunction(() => window.__shotReady === true, { timeout: 15000 });

    // Extra brief pause for any dynamic transitions/animations to settle
    await page.waitForTimeout(500);

    const outPath = path.join(screenshotsDir, shot.name);
    // JPEG quality 85 produces crisp visuals well within the 256 KiB cap
    await page.screenshot({
      path: outPath,
      type: 'jpeg',
      quality: 85,
    });

    const stats = fs.statSync(outPath);
    const sizeKiB = (stats.size / 1024).toFixed(1);
    console.log(`  Saved ${shot.name} (${sizeKiB} KiB)`);
    if (stats.size > 262144) {
      throw new Error(`Screenshot ${shot.name} exceeds 256 KiB cap: ${stats.size} bytes`);
    }

    await page.close();
  }

  await browser.close();
  console.log('\nAll 4 screenshots captured successfully.');
}

captureAll().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
