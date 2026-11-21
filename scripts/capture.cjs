const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const shotsPath = path.join(rootDir, 'shots.json');
  const screenshotsDir = path.join(rootDir, 'screenshots');

  if (!fs.existsSync(shotsPath)) {
    console.error('shots.json not found');
    process.exit(1);
  }

  const shots = JSON.parse(fs.readFileSync(shotsPath, 'utf8'));
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const c1255 = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
  const c1255_alt = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux/chrome';
  const chromePath = '/home/hatch/.cache/ms-playwright/chromium-1193/chrome-linux/chrome';

  let browser;
  try {
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-crash-reporter',
        '--disable-breakpad',
        '--no-zygote'
      ]
    };
    if (chromePath) {
      launchOptions.executablePath = chromePath;
    }
    browser = await chromium.launch(launchOptions);
  } catch (err) {
    console.error('Failed to launch browser:', err.message);
    process.exit(1);
  }

  const results = [];

  for (const shot of shots) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    page.on('pageerror', err => {
      console.error(`Page error on ${shot.name}:`, err.message);
    });

    const queryString = shot.query ? (shot.query.startsWith('?') ? shot.query : `?${shot.query}`) : '';
    const url = `http://localhost:8080/${queryString}`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    } catch (err) {
      if (err.message.includes('ECONNREFUSED') || err.message.includes('net::ERR_CONNECTION_REFUSED')) {
        console.error(`Server connection refused at ${url}`);
      } else {
        console.error(`Failed to navigate to ${url}:`, err.message);
      }
      await browser.close();
      process.exit(1);
    }

    try {
      await page.waitForFunction(() => window.__game && window.__game.ready, { timeout: 15000 });
    } catch (err) {
      console.error(`Timeout waiting for __game.ready on ${shot.name}:`, err.message);
    }

    try {
      await page.evaluate(() => {
        if (window.__game && typeof window.__game.tick === 'function') {
          for (let i = 0; i < 30; i++) {
            window.__game.tick();
          }
        }
      });
    } catch (err) {
      console.error(`Error ticking game on ${shot.name}:`, err.message);
    }

    const fileName = shot.name.endsWith('.jpg') || shot.name.endsWith('.jpeg') ? shot.name : `${shot.name}.jpg`;
    const outPath = path.join(screenshotsDir, fileName);

    await page.screenshot({
      path: outPath,
      type: 'jpeg',
      quality: 82,
      timeout: 180000
    });

    const stats = fs.statSync(outPath);
    console.log(`Captured ${shot.name}: ${outPath} (${stats.size} bytes)`);
    results.push({ name: shot.name, path: outPath, size: stats.size });

    await context.close();
  }

  await browser.close();
  console.log('Capture summary:');
  for (const r of results) {
    console.log(`  - ${r.name}: ${r.size} bytes`);
  }
}

main().catch(err => {
  console.error('Capture script failed:', err);
  process.exit(1);
});
